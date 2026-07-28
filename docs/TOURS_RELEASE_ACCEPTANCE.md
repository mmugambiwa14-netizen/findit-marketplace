# Tours Release Acceptance

Use this checklist for staging and production promotion. Do not infer acceptance from local contracts alone.

## Staging prerequisites

- Migrations `0031`–`0042` applied in order.
- Separate private Tour source, playback and thumbnail buckets confirmed.
- Processing, cleanup, cache, observability and notification fan-out worker secrets configured.
- Processor callback HMAC and allowed origins configured.
- `VITE_FEATURE_TOURS=true`, `TOURS_BACKEND_ENABLED=true` in staging only.
- Public production flags remain closed.

## Automated acceptance

Run the manual `Tours staging acceptance` workflow. It must pass:

- locked install, environment validation, source graph and complete contracts;
- lint, all typechecks, build and production dependency audit;
- upload, processing, seller workflow, listing integration, discovery and moderation smokes;
- substantial Tour and public-listing cursor traversal with no duplicates or skips;
- 75-conversation inbox and 126-message thread traversal;
- notification cursor traversal and bounded saved-listing fan-out;
- operational metric privacy, scheduler authentication, retention and deterministic alerts.

Retain `artifacts/tours-staging-acceptance.json`. Its `acceptanceId` is the only valid production value for `FINDIT_TOURS_ACCEPTANCE_ID`.

## Manual mobile and failure acceptance

Verify on real Safari and Chrome devices:

- 320 px through modern phone widths;
- explicit play, no automatic sound and no full-file preload;
- low-data and interrupted-network behavior;
- expired signed URL refresh;
- missing thumbnail/playback fallback;
- portrait and landscape playback;
- seller interruption recovery and atomic replacement;
- report/removal during playback;
- sold, expired and deleted parent propagation;
- back navigation restores Tours filters, cursor and scroll position;
- keyboard, focus, labels, reduced motion and screen-reader flow.

## Operational acceptance

- No open critical operational alerts.
- Processing failure rate below 10% over at least ten dispatches.
- No cleanup, cache or notification fan-out dead letters.
- No stale notification claims or unexplained fan-out backlog.
- Feed and message maximum latency below the configured two-second warning threshold during acceptance.
- Source retention and cleanup verified with real storage objects.
- Alert destination and named human owner configured outside the application.
- Backup and restore evidence attached to the release record.

## Rollback rehearsal

1. Set `VITE_FEATURE_TOURS=false` and disable backend Tour writes/public reads.
2. Pause processing, observability and notification fan-out workers; do not mass-delete source or derived objects.
3. Deploy the last accepted Milestone 6 frontend before removing Milestone 7 cursor RPCs.
4. Confirm listings, Saved and Chats remain available on that frontend.
5. Apply targeted rollbacks in reverse order: `0042`, `0041`, then `0040`.
6. Preserve operational metric buckets, operational alerts, fan-out jobs, audit logs and Tour rows for investigation.
7. Re-run classic marketplace smoke suites before reopening traffic.

## Production promotion

Set all of the following together:

```text
VITE_FEATURE_TOURS=true
VITE_FEATURE_TOURS_PREVIEW=false
TOURS_BACKEND_ENABLED=true
FINDIT_TOURS_RELEASE_ACCEPTED=true
FINDIT_TOURS_ACCEPTANCE_ID=<exact accepted staging artifact ID>
```

Promotion is invalid if any value is missing or the acceptance record cannot be retrieved.
