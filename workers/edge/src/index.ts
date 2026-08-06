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
  SUPABASE_SERVICE_ROLE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

type PlatformJobType =
  | 'notification.dispatch'
  | 'email.dispatch'
  | 'web_push.dispatch'
  | 'media.cleanup'
  | 'search.sync'
  | 'analytics.record';

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
  'search.sync',
  'analytics.record',
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

async function processJob(job: PlatformJob, env: Env): Promise<void> {
  const log = (event: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ event, traceId: job.traceId, jobId: job.id, jobType: job.type, ...extra }));

  log('platform_job_started');

  switch (job.type) {
    case 'media.cleanup': {
      const bucketName = String(job.payload.bucket || '');
      const key = mediaKey(job.payload.key);
      await mediaBucket(env, bucketName).delete(key);
      log('media_cleanup_completed', { bucket: bucketName, key });
      return;
    }
    case 'notification.dispatch':
    case 'email.dispatch':
    case 'web_push.dispatch':
    case 'search.sync':
    case 'analytics.record':
      // Never acknowledge a job until its domain handler is implemented and
      // certified as idempotent. Retrying eventually moves it to the DLQ.
      throw new Error(`Platform job handler not configured: ${job.type}`);
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
