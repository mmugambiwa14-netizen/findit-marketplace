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

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

function traceId(request?: Request): string {
  const inbound = request?.headers.get('x-request-id')?.trim();
  return inbound && inbound.length <= 128 ? inbound : crypto.randomUUID();
}

async function processJob(job: PlatformJob, env: Env): Promise<void> {
  const log = (event: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ event, traceId: job.traceId, jobId: job.id, jobType: job.type, ...extra }));

  log('platform_job_started');

  switch (job.type) {
    case 'notification.dispatch':
    case 'email.dispatch':
    case 'web_push.dispatch':
    case 'search.sync':
    case 'analytics.record':
      // The transport is now explicit. Domain-specific handlers must be added
      // incrementally and remain idempotent by job.id.
      log('platform_job_deferred_to_domain_handler');
      return;
    case 'media.cleanup': {
      const bucket = String(job.payload.bucket || '');
      const key = String(job.payload.key || '');
      if (!key) throw new Error('media.cleanup requires a key');
      const target = bucket === 'source' ? env.PEEK_SOURCE_MEDIA : env.PEEK_DERIVATIVE_MEDIA;
      await target.delete(key);
      log('media_cleanup_completed', { bucket, key });
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
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const limit = Math.max(1, Math.min(10_000, Number(url.searchParams.get('limit') || 20)));
    const windowSeconds = Math.max(1, Math.min(86_400, Number(url.searchParams.get('window') || 60)));
    if (!key) return json({ error: 'key is required' }, 400);

    const now = Date.now();
    const current = (await this.state.storage.get<{ count: number; resetAt: number }>(key)) || {
      count: 0,
      resetAt: now + windowSeconds * 1000,
    };
    const value = current.resetAt <= now ? { count: 0, resetAt: now + windowSeconds * 1000 } : current;
    value.count += 1;
    await this.state.storage.put(key, value, { expiration: Math.ceil(value.resetAt / 1000) });

    return json({ allowed: value.count <= limit, remaining: Math.max(0, limit - value.count), resetAt: value.resetAt });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = traceId(request);
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, environment: env.APP_ENV, traceId: id });
    return json({ error: 'not_found', traceId: id }, 404, { 'x-request-id': id });
  },

  async queue(batch: MessageBatch<PlatformJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processJob(message.body, env);
        message.ack();
      } catch (error) {
        console.error(JSON.stringify({
          event: 'platform_job_failed',
          traceId: message.body?.traceId,
          jobId: message.body?.id,
          error: error instanceof Error ? error.message : String(error),
        }));
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env, PlatformJob>;
