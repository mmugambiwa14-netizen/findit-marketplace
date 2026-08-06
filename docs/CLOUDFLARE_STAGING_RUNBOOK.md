# PeekaListing Cloudflare Staging Runbook

## Purpose

This runbook provisions the external infrastructure required by the critical/high architecture foundation without changing live application traffic.

## Required GitHub environment

Create the protected GitHub environment:

`cloudflare-staging`

Add required reviewers before deployment and configure these secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token must be restricted to the PeekaListing account and only the permissions required for Workers, Queues, R2 and KV provisioning.

## Provisioning

Run the GitHub Actions workflow:

`Provision Cloudflare Staging`

Choose `staging` and enter `PROVISION`.

The workflow creates or confirms:

- `peekalisting-staging-peek-source`
- `peekalisting-staging-peek-derivatives`
- `peekalisting-staging-listing-media`
- `peekalisting-staging-lightweight-jobs`
- `peekalisting-staging-lightweight-jobs-dlq`
- a staging platform-config KV namespace

The provisioning workflow does not route traffic and does not deploy secrets.

## Worker deployment preparation

1. Copy `infrastructure/cloudflare/wrangler.toml.example` to a deployment-only Wrangler configuration.
2. Insert the real KV namespace identifier.
3. Confirm queue and R2 bucket names.
4. Set the staging media hostname.
5. Configure the worker route.
6. Set secrets through Wrangler or the Cloudflare dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MEDIA_SIGNING_SECRET`
7. Deploy the worker. The first deployment applies the Durable Object migration.
8. Confirm `/health` reports the staging environment and a trace ID.

## Turnstile

Create a distinct staging widget. Do not reuse the production widget.

Configure only controlled staging hostnames. Set these Supabase Edge Function secrets:

- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_ALLOWED_ORIGINS`
- `TURNSTILE_ALLOWED_HOSTNAMES`

Deploy `verify-turnstile`, then verify:

- approved origin succeeds with a valid token,
- unknown origin is rejected,
- wrong action is rejected,
- wrong hostname is rejected,
- expired and reused tokens are rejected,
- missing configuration fails closed.

## Media worker

Build from `workers/media/Dockerfile` and deploy one staging replica initially.

Required secrets:

- `FINDIT_SUPABASE_URL`
- `FINDIT_SUPABASE_SECRET_KEY`
- `FINDIT_EXPECTED_PROJECT_REF`

Required configuration:

- `FINDIT_TOUR_PROCESSOR_BATCH_SIZE=5`
- `PEEKALISTING_WORKER_POLL_SECONDS=5`

The legacy variable prefix remains temporarily because the existing runner consumes those names. Rename only through a backwards-compatible migration.

## Certification before traffic cutover

The following must pass:

- queue retry and dead-letter behavior,
- duplicate-job idempotency,
- invalid payload rejection,
- media cleanup path validation,
- worker restart and lease recovery,
- FFmpeg processing of a real staging Peek,
- R2 source and derivative access controls,
- signed derivative playback,
- trace continuity across request, queue, worker and database,
- Turnstile origin, action and hostname enforcement,
- rollback to the existing Supabase Storage path.

## Activation boundary

Do not route new uploads or notifications through Cloudflare until certification is recorded in `docs/PRODUCT_PROGRESS.md` and `docs/MIGRATION_LEDGER.md` where applicable.
