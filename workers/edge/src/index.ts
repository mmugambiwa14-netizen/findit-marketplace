export interface Env {
  APP_ENV: string;
  MEDIA_DELIVERY_HOST: string;
  LIGHTWEIGHT_JOBS: Queue<PlatformJob>;
  PLATFORM_CONFIG: KVNamespace;
  RATE_LIMITS: DurableObjectNamespace;
  PEEK_SOURCE_MEDIA: R2Bucket;
  PEEK_DERIVATIVE_MEDIA: R2Bucket;
  LISTING_MEDIA: R2Bucket;
  SUPABASE_URL: string;
  // Narrow-purpose dispatch tokens, each matching the same-named secret already
  // configured on its canonical Supabase Edge Function. The Worker never holds
  // the database service-role credential: that stays inside the Edge Functions
  // that actually touch the database.
  FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET: string;
  EMAIL_DISPATCH_TOKEN: string;
  PUSH_DISPATCH_TOKEN: string;
  TURNSTILE_SECRET_KEY: string;
}

// search.sync and analytics.record are intentionally not accepted: no canonical
// destination with durable, idempotent semantics exists for them yet. Adding
// them back requires implementing a real handler alongside a producer-side
// contract, not just re-adding the string here.
type PlatformJobType =
  | 'notification.dispatch'
  | 'email.dispatch'
  | 'web_push.dispatch'
  | 'media.cleanup';

interface PlatformJob {
  id: string;
  type: PlatformJobType;
  traceId: string;
  createdAt: string;
  attempt?: number;
  payload: Record<string, unknown>;
}

const JOB_TYPES = new Set<PlatformJobType>([
  'notification.dispatch',
  'email.dispatch',
  'web_push.dispatch',
  'media.cleanup',
]);

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function validIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(value);
}

function validateJob(value: unknown): PlatformJob {
  if (!value || typeof value !== 'object') throw new Error('Invalid platform job envelope');
  const job = value as Partial<PlatformJob>;
  if (!validIdentifier(job.id)) throw new Error('Invalid platform job id');
  if (!validIdentifier(job.traceId)) throw new Error('Invalid platform job trace id');
  if (typeof job.type !== 'string' || !JOB_TYPES.has(job.type as PlatformJobType)) {
    throw new Error('Unsupported platform job type');
  }
  if (typeof job.createdAt !== 'string' || !Number.isFinite(Date.parse(job.createdAt))) {
    throw new Error('Invalid platform job creation timestamp');
  }
  if (!job.payload || typeof job.payload !== 'object' || Array.isArray(job.payload)) {
    throw new Error('Invalid platform job payload');
  }
  return job as PlatformJob;
}

function traceId(request?: Request): string {
  const inbound = request?.headers.get('x-request-id')?.trim();
  return validIdentifier(inbound) ? inbound : crypto.randomUUID();
}

function mediaBucket(env: Env, bucket: unknown): R2Bucket {
  switch (bucket) {
    case 'source':
      return env.PEEK_SOURCE_MEDIA;
    case 'derivative':
      return env.PEEK_DERIVATIVE_MEDIA;
    case 'listing':
      return env.LISTING_MEDIA;
    default:
      throw new Error('media.cleanup requires an allowed bucket');
  }
}

function mediaKey(value: unknown): string {
  if (typeof value !== 'string' || value.length < 3 || value.length > 1024) {
    throw new Error('media.cleanup requires a valid key');
  }
  if (value.startsWith('/') || value.includes('..') || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('media.cleanup key is unsafe');
  }
  return value;
}

// Worker-level idempotency is a fast, best-effort skip on redelivery. The
// authoritative idempotency boundary is the claim/lease RPCs each dispatch
// Edge Function already calls (claim_*_delivery_*, complete_*, fail_*), so a
// KV read/write failure here must never block a job from being processed.
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 3;

function idempotencyKey(job: PlatformJob): string {
  return `job-complete:${job.type}:${job.id}`;
}

async function alreadyProcessed(env: Env, job: PlatformJob): Promise<boolean> {
  try {
    return (await env.PLATFORM_CONFIG.get(idempotencyKey(job))) !== null;
  } catch {
    return false;
  }
}

async function markProcessed(env: Env, job: PlatformJob): Promise<void> {
  try {
    await env.PLATFORM_CONFIG.put(idempotencyKey(job), '1', { expirationTtl: IDEMPOTENCY_TTL_SECONDS });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'platform_job_idempotency_marker_failed',
      traceId: job.traceId,
      jobId: job.id,
      jobType: job.type,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

// A dispatch job carries no per-record identity: it tells a canonical Supabase
// Edge Function to drain whatever it can currently claim. `limit` is the only
// payload field these jobs accept.
const DISPATCH_TIMEOUT_MS = 20_000;
const MAX_DISPATCH_LIMIT = 100;

function dispatchLimit(payload: Record<string, unknown>): number | undefined {
  if (payload.limit === undefined) return undefined;
  const value = Number(payload.limit);
  if (!Number.isInteger(value) || value < 1 || value > MAX_DISPATCH_LIMIT) {
    throw new Error(`dispatch limit must be an integer between 1 and ${MAX_DISPATCH_LIMIT}`);
  }
  return value;
}

type DispatchOutcome =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; classification: 'transient' | 'permanent'; detail: string };

// Cloudflare Queues has no "send straight to the dead-letter queue" primitive
// for an individual message: the only per-message actions are ack() and
// retry(). A permanent classification is therefore still surfaced through
// retry() (bounded by wrangler.toml max_retries) so the failure produces
// dead-letter evidence instead of silently vanishing on ack().
function classifyDispatchStatus(status: number): 'transient' | 'permanent' {
  if (status === 401 || status === 403) return 'permanent';
  if (status === 429 || status >= 500) return 'transient';
  return 'permanent';
}

async function callDispatchFunction(
  env: Env,
  job: PlatformJob,
  functionName: string,
  authHeaders: Record<string, string>,
  limit: number | undefined,
): Promise<DispatchOutcome> {
  if (!env.SUPABASE_URL) {
    return { ok: false, classification: 'permanent', detail: 'supabase_url_not_configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${env.SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': job.traceId,
        ...authHeaders,
      },
      body: JSON.stringify(limit === undefined ? {} : { limit }),
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      classification: 'transient',
      detail: timedOut ? 'dispatch_timeout' : 'dispatch_network_error',
    };
  } finally {
    clearTimeout(timer);
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    // A non-JSON body is only expected alongside a non-2xx status below.
  }

  if (response.status >= 200 && response.status < 300) return { ok: true, body };
  if (response.status === 207) return { ok: true, body };
  return { ok: false, classification: classifyDispatchStatus(response.status), detail: `dispatch_http_${response.status}` };
}

async function processJob(job: PlatformJob, env: Env): Promise<void> {
  const log = (event: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ event, traceId: job.traceId, jobId: job.id, jobType: job.type, ...extra }));

  if (await alreadyProcessed(env, job)) {
    log('platform_job_duplicate_skipped');
    return;
  }

  log('platform_job_started');

  switch (job.type) {
    case 'media.cleanup': {
      const bucketName = String(job.payload.bucket || '');
      const key = mediaKey(job.payload.key);
      await mediaBucket(env, bucketName).delete(key);
      await markProcessed(env, job);
      log('media_cleanup_completed', { bucket: bucketName, key });
      return;
    }
    case 'notification.dispatch': {
      const limit = dispatchLimit(job.payload);
      const outcome = await callDispatchFunction(
        env,
        job,
        'essential-notification-fanout',
        { authorization: `Bearer ${env.FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET || ''}` },
        limit,
      );
      if (!outcome.ok) {
        log('notification_dispatch_failed', { classification: outcome.classification, detail: outcome.detail });
        throw new Error(`notification.dispatch ${outcome.classification}: ${outcome.detail}`);
      }
      await markProcessed(env, job);
      log('notification_dispatch_completed', {
        claimedJobs: outcome.body.claimedJobs ?? null,
        completedJobs: outcome.body.completedJobs ?? null,
        requeuedJobs: outcome.body.requeuedJobs ?? null,
        failedJobs: outcome.body.failedJobs ?? null,
      });
      return;
    }
    case 'email.dispatch': {
      const limit = dispatchLimit(job.payload);
      const outcome = await callDispatchFunction(
        env,
        job,
        'transactional-email-dispatch',
        { authorization: `Bearer ${env.EMAIL_DISPATCH_TOKEN || ''}` },
        limit,
      );
      if (!outcome.ok) {
        log('email_dispatch_failed', { classification: outcome.classification, detail: outcome.detail });
        throw new Error(`email.dispatch ${outcome.classification}: ${outcome.detail}`);
      }
      await markProcessed(env, job);
      log('email_dispatch_completed', {
        claimed: outcome.body.claimed ?? null,
        sent: outcome.body.sent ?? null,
        failed: outcome.body.failed ?? null,
      });
      return;
    }
    case 'web_push.dispatch': {
      const limit = dispatchLimit(job.payload);
      const outcome = await callDispatchFunction(
        env,
        job,
        'web-push-dispatch',
        { 'x-push-dispatch-token': env.PUSH_DISPATCH_TOKEN || '' },
        limit,
      );
      if (!outcome.ok) {
        log('web_push_dispatch_failed', { classification: outcome.classification, detail: outcome.detail });
        throw new Error(`web_push.dispatch ${outcome.classification}: ${outcome.detail}`);
      }
      await markProcessed(env, job);
      log('web_push_dispatch_completed', {
        processed: outcome.body.processed ?? null,
        delivered: outcome.body.delivered ?? null,
        failed: outcome.body.failed ?? null,
      });
      return;
    }
    default: {
      const neverJob: never = job.type;
      throw new Error(`Unsupported platform job: ${neverJob}`);
    }
  }
}

export class RateLimitCoordinator implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const limit = Math.max(1, Math.min(10_000, Number(url.searchParams.get('limit') || 20)));
    const windowSeconds = Math.max(1, Math.min(86_400, Number(url.searchParams.get('window') || 60)));
    if (!key || key.length > 256) return json({ error: 'valid key is required' }, 400);

    const now = Date.now();
    const current = (await this.state.storage.get<{ count: number; resetAt: number }>(key)) || {
      count: 0,
      resetAt: now + windowSeconds * 1000,
    };
    const value = current.resetAt <= now ? { count: 0, resetAt: now + windowSeconds * 1000 } : current;
    value.count += 1;
    await this.state.storage.put(key, value, { expiration: Math.ceil(value.resetAt / 1000) });

    return json({
      allowed: value.count <= limit,
      remaining: Math.max(0, limit - value.count),
      resetAt: value.resetAt,
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = traceId(request);
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, environment: env.APP_ENV, traceId: id }, 200, { 'x-request-id': id });
    }
    return json({ error: 'not_found', traceId: id }, 404, { 'x-request-id': id });
  },

  async queue(batch: MessageBatch<PlatformJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      let job: PlatformJob | null = null;
      try {
        job = validateJob(message.body);
        await processJob(job, env);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({
          event: 'platform_job_failed',
          traceId: job?.traceId || null,
          jobId: job?.id || null,
          attempts: message.attempts,
          error: error instanceof Error ? error.message : String(error),
        }));
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env, PlatformJob>;
