# Recommendation Phase 2 Certification

Status: source implementation complete through migration `0062`; executable certification pending.

## Required secrets and variables

Hosted recommendation certification requires:

- `FINDIT_RECOMMENDATION_SMOKE_URL`: explicit Supabase project URL used only for the intended hosted target.
- `FINDIT_SUPABASE_ANON_KEY`: publishable key for public recommendation function calls.
- `FINDIT_RECOMMENDATION_HEALTH_SECRET`: dedicated random monitoring credential, at least 24 characters, stored in both the hosted Edge Function environment and the certification runner.
- `FINDIT_RECOMMENDATION_SMOKE_LISTING_ID`: optional eligible listing used to exercise subject-based services.

Never use a service-role or secret Supabase key in the hosted smoke harness.

## Local certification

Run against a disposable local Supabase stack:

```bash
npm run certify:recommendation-phase2-local
```

This verifies the migration sequence through `0062`, rollback pairing, source contracts, database reset, lint, foundation, queue, eligibility, publication, independent service, operational control and scale suites.

## Hosted certification

Deploy the seven recommendation functions and `recommendation-service-health`, configure the dedicated health secret, keep all recommendation service policies disabled, and run:

```bash
npm run certify:recommendation-phase2-hosted
```

Expected evidence:

- protected health endpoint returns exactly seven service records;
- all enabled-service counts reflect the intended rollout state;
- public recommendation endpoints return contract version `1` and fail soft;
- personalized recommendations reject unauthenticated callers;
- no hosted smoke request uses a privileged database key;
- listing pages remain available independently of every recommendation endpoint.

## Completion decision

Phase 2 may be marked executable-complete only when local and hosted certification pass against the same current commit SHA. Until then:

- service policies remain disabled;
- the pull request remains draft;
- Phase 3 implementation may be prepared only if the pending certification status remains explicit;
- no recommendation API is represented as production-certified.
