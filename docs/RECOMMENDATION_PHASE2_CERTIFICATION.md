# Recommendation Certification

Status: source-complete through migration `0074`; Phase 3 and Phase 7 hosted
staging certification passed on 2026-07-29. Production is unchanged and not
certified.

## Required configuration

Public transport smoke tests require:

- `FINDIT_SUPABASE_URL`
- `FINDIT_SUPABASE_ANON_KEY` containing the target's publishable browser key
- `FINDIT_EXPECTED_PROJECT_REF`
- `FINDIT_ALLOW_HOSTED_SMOKE=staging` for a hosted staging run
- `FINDIT_RECOMMENDATION_SMOKE_ORIGIN` containing an allowed browser origin

The guarded Phase 3 and Phase 7 fixture suites additionally require:

- `FINDIT_SUPABASE_SECRET_KEY` for disposable staging fixtures only
- `FINDIT_SUPABASE_ACCESS_TOKEN` for exact-project Management API checks
- `FINDIT_ALLOW_STAGING_FOUNDER_SESSION=staging`
- `FINDIT_ALLOW_STAGING_TIMEOUT_LOCK=staging` for the bounded Phase 3 lock test

Never print, log, commit, or place privileged values in browser code. The
fixture suites refuse non-staging hosted targets and restore policy state and
delete fixtures in `finally` cleanup.

Hosted health endpoints use dedicated values:

- `FINDIT_RECOMMENDATION_HEALTH_SECRET`
- `FINDIT_CONTEXTUAL_HEALTH_SECRET`
- `FINDIT_REQUEST_BUDGET_SALT`

## Local certification

Run the repository release gates:

```bash
npm run lint
npm run typecheck
npm run typecheck:edge-functions
npm run test:contracts
npm run verify:sql-boundary
npm run verify:hygiene
npm run verify:source-graph
npm run audit:product-surface
npm run audit:production
npm run build
```

Run the pgTAP suites through the pinned Supabase CLI commands in `package.json`
or rely on both clean-reset GitHub database jobs when local Docker is
unavailable.

## Hosted staging certification

With the exact staging guards and credentials set:

```bash
npm run certify:recommendation-phase3-staging
npm run certify:recommendation-phase7-staging
```

Required evidence includes browser CORS, anonymous and authenticated boundaries,
real fixture-backed results, PostgREST hydration, request-budget exhaustion,
consent and clear behavior, aggregate-only analytics, real abortable timeouts,
durable circuit isolation and recovery, canonical listing independence, policy
restoration, and complete fixture cleanup.

## Completion decision

Staging certification does not authorize production deployment. Until an
explicit production release is approved:

- PR #1 remains draft and unmerged.
- Exactly `recently_listed_service` remains enabled on staging.
- The six other policies remain disabled.
- Production migrations, functions, and policies remain unchanged.
