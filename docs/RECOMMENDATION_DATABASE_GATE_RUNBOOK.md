# Recommendation Database Gate Runbook

## Purpose

This runbook closes the executable database gate for the recommendation foundation and independent recommendation services. It verifies actual PostgreSQL, PostGIS, worker, cache, service-policy and RLS behaviour; source-contract tests alone are not a substitute.

The authoritative CI workflow is `.github/workflows/migration-gates.yml`. It contains both the frontend/source job and the clean local Supabase database job.

## Authoritative database sequence

On pull requests and pushes to `main`, the database job must:

1. start a clean local Supabase stack;
2. apply all migrations through `0061_recommendation_service_runtime_policy_and_cache.sql`;
3. run database lint at error level;
4. run `v1_recommendation_foundation.sql`;
5. run `v1_recommendation_projection_queue.sql`;
6. run `v1_recommendation_eligibility_geospatial.sql`;
7. run `v1_recommendation_publication_boundary.sql`;
8. run `v1_recommendation_services.sql`;
9. run `v1_recommendation_scale.sql`;
10. stop the local stack without persisting test state.

The job must pass before Phase 2 can be declared certified or Phase 3 can be treated as safely enabled.

## Local equivalent

Use the exact Supabase CLI version and commands recorded in `.github/workflows/migration-gates.yml`. Run the same migration startup, lint and six pgTAP suites against a disposable local stack only.

The repository command is:

```bash
npm run certify:recommendation-phase2-local
```

## Evidence required

Record:

- the tested commit SHA;
- migration reset success through `0061`;
- database lint success;
- all six pgTAP suite results;
- source contract, lint, typecheck and production build results;
- GitHub Actions run URL or equivalent local transcript;
- confirmation that no production or staging database was targeted.

## Failure handling

Do not advance certification when:

- any migration fails;
- database lint reports an error;
- any pgTAP assertion fails;
- service-role, browser-role or policy boundaries are not proven;
- a recommendation service can make listing delivery fail;
- personalized output enters shared cache;
- a test uses a hosted database;
- the evidence commit SHA differs from the current PR head.

A zero-job `startup_failure` is an external runner or repository Actions condition, not passing test evidence. Resolve the repository Actions condition or run the local equivalent and attach the complete transcript before changing certification status.
