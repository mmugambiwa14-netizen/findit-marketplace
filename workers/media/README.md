# PeekaListing Media Worker

This worker is the only runtime allowed to perform long-running Peek media work such as FFmpeg validation, transcoding, thumbnail generation and derivative publication.

## Runtime contract

The worker:

1. Uses the existing `claim_tour_processing_jobs` lease RPC.
2. Processes only jobs it successfully leases.
3. Persists completion or failure through the existing processing RPCs.
4. Never runs inside a user-facing HTTP request or Supabase Edge Function.
5. May be deployed to Cloud Run Jobs, ECS/Fargate, Fly.io, Railway, Render Worker or another container platform.

## Required environment

- `FINDIT_SUPABASE_URL`
- `FINDIT_SUPABASE_SECRET_KEY`
- `FINDIT_EXPECTED_PROJECT_REF`
- `FINDIT_TOUR_PROCESSOR_BATCH_SIZE` (1-20, default 5)
- `PEEKALISTING_WORKER_POLL_SECONDS` (default 5)

The legacy `FINDIT_*` names remain temporarily because they are existing infrastructure identifiers. Product-facing text must use PeekaListing and Peeks.

## Deployment safety

- Run at least two replicas only after lease expiry and heartbeat behavior have been load-tested.
- Set CPU and memory limits suitable for FFmpeg.
- Use an instance concurrency of one for predictable memory usage.
- Send structured stdout/stderr logs to the platform log collector.
- Alert on repeated non-zero exits, growing queue age and processing leases that expire before completion.
- Keep the Supabase secret key in the deployment secret manager, never in repository variables or image layers.

## Build

```bash
docker build -f workers/media/Dockerfile -t peekalisting-media-worker .
```
