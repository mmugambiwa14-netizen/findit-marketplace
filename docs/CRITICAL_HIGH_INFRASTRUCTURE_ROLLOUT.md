# PeekaListing Critical and High Infrastructure Rollout

## Status

Implementation foundation added on `integration/critical-high-infrastructure`.

Nothing in this document authorizes enabling an external service before its secrets, limits, monitoring and rollback path are configured.

## Architecture decisions

### Heavy media processing

- FFmpeg, video validation, transcoding and thumbnail generation run only in the dedicated media-worker container.
- Supabase Edge Functions must not execute long-running media processing.
- PostgreSQL remains the authoritative source of job, lease and media lifecycle state.
- The existing claim/lease/fail/complete RPC boundary is retained.

### Lightweight asynchronous work

Cloudflare Queues are the target transport for:

- notification fan-out,
- transactional email dispatch,
- web push dispatch,
- media cleanup,
- search synchronization,
- analytics events.

Every message requires:

- immutable job ID,
- job type,
- trace ID,
- creation timestamp,
- idempotent handler behavior,
- bounded retries,
- dead-letter handling.

### Media storage

Target buckets:

- private Peek source media,
- processed Peek derivatives,
- listing media.

R2 is the target durable object store. Public delivery must use bounded derivatives and Cloudflare CDN. Raw private source media must never be exposed through permanent public URLs.

### Shared transient state

- Cloudflare Durable Objects are the target for consistent rate-limit counters, short-lived locks and idempotency coordination.
- Cloudflare KV is limited to configuration and cache data that tolerates eventual consistency.
- PostgreSQL remains authoritative for durable domain state.

### Bot protection

Cloudflare Turnstile server verification is introduced as a separate function boundary.

Initial protected actions:

1. registration abuse,
2. password recovery abuse,
3. business applications,
4. repeated listing submission,
5. repeated Peek Request creation,
6. excessive conversation initiation,
7. contact reveal when risk signals require a challenge.

Turnstile never replaces authentication, authorization, RLS, ownership validation or rate limiting.

### Traceability

All new external requests and queue jobs must carry `x-request-id`.

The trace ID must appear in:

- client logs,
- edge logs,
- queue messages,
- worker logs,
- failure records,
- Sentry events,
- delivery-attempt logs.

## Preview environment contract

GitHub Pages remains a public static demo only.

The required full-stack preview model is:

```text
Pull request
→ Cloudflare preview deployment
→ isolated Supabase branch for backend-changing PRs
→ preview-specific R2 buckets or prefixes
→ preview-specific queue names
→ automated teardown after PR closure
```

UI-only PRs may use shared staging when they do not change schemas, authorization, storage, Edge Functions or background jobs.

## Provisioning checklist

### Cloudflare

- Create preview, staging and production R2 buckets.
- Create lightweight job queues and dead-letter queues.
- Create KV namespaces.
- Deploy Durable Object migration.
- Configure custom media delivery host.
- Add WAF and Turnstile settings.
- Configure queue backlog and worker failure alerts.

### Media worker platform

- Build from `workers/media/Dockerfile`.
- Store Supabase secret key in platform secret manager.
- Set instance concurrency to one initially.
- Configure CPU, memory and execution limits for FFmpeg.
- Configure automatic restart and log collection.
- Alert on queue age, expired leases and repeated processing failures.

### Supabase

- Deploy `verify-turnstile`.
- Add `TURNSTILE_SECRET_KEY` to function secrets.
- Confirm existing processing RPC grants remain worker-only where intended.
- Add preview branch automation for backend-changing PRs.
- Preserve migration ordering and clean-database certification.

## Rollout stages

### Stage 1 — Foundation

- Merge contracts and deployable worker scaffolding.
- Add tests for trace helpers and queue payload validation.
- Keep all new external integrations disabled.

### Stage 2 — Staging provisioning

- Provision Cloudflare resources.
- Deploy one media worker replica.
- Deploy Turnstile verification.
- Mirror media to R2 while Supabase Storage remains authoritative.

### Stage 3 — Staging cutover

- Route new Peek source uploads to R2.
- Process them through the container worker.
- Serve processed derivatives through Cloudflare.
- Move lightweight notification and cleanup jobs to Cloudflare Queues.

### Stage 4 — Certification

Certify:

- upload persistence across worker restart,
- lease recovery,
- duplicate-job idempotency,
- dead-letter behavior,
- queue backlog recovery,
- signed media delivery,
- Turnstile failure and timeout behavior,
- trace continuity,
- preview isolation,
- storage cleanup.

### Stage 5 — Production

Production activation requires a documented rollback to the previous Supabase Storage and database-queue path until the new path has completed a stable staging observation period.

## Not included in this rollout

- dedicated external search engine,
- payment processing,
- third-party realtime provider,
- data warehouse,
- A/B testing platform,
- multi-cloud active-active deployment.

These do not block the current MVP.
