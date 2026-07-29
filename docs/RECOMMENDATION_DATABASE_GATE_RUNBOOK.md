# Recommendation Database Gate Runbook

## Purpose

This runbook closes the executable Phase 1 database gate for the recommendation foundation. It verifies the actual PostgreSQL and RLS behavior; source-contract tests alone are not a substitute.

The authoritative CI workflow is `.github/workflows/migration-gates.yml`. It contains both the frontend/source job and the clean local Supabase database job. There is no second overlapping recommendation workflow.

## Automated gate

On pull requests and pushes to `main`, the database job must:

1. start a clean local Supabase stack;
2. apply all migrations through `0057_recommendation_eligibility_geospatial_and_deletion_closure.sql`;
3. run database lint at error level;
4. run `v1_recommendation_foundation.sql`;
5. run `v1_recommendation_projection_queue.sql`;
6. run `v1_recommendation_eligibility_geospatial.sql`;
7. run `v1_recommendation_scale.sql`;
8. stop the local stack without persisting test state.

The job must pass before Phase 2 begins.

## Manual equivalent

Use Node.js 20 or newer, Docker Desktop and Supabase CLI `2.84.2`.

```bash
npx --yes supabase@2.84.2 start
npx --yes supabase@2.84.2 db lint --local --level error
npx --yes supabase@2.84.2 test db supabase/tests/v1_recommendation_foundation.sql --local
npx --yes supabase@2.84.2 test db supabase/tests/v1_recommendation_projection_queue.sql --local
npx --yes supabase@2.84.2 test db supabase/tests/v1_recommendation_eligibility_geospatial.sql --local
npx --yes supabase@2.84.2 test db supabase/tests/v1_recommendation_scale.sql --local
npx --yes supabase@2.84.2 stop --no-backup
```

## Evidence required

Record:

- the tested commit SHA;
- migration reset success through `0057`;
- database lint success;
- all four pgTAP suite results;
- GitHub Actions run URL or equivalent local transcript;
- confirmation that no production or staging database was targeted.

## Failure handling

Do not advance to Phase 2 when:

- GitHub Actions reports `startup_failure` before jobs are created;
- Docker or Supabase services fail to start;
- any migration fails;
- database lint reports an error;
- any pgTAP assertion fails;
- a test uses a hosted database;
- the evidence commit SHA differs from the current PR head.

A zero-job `startup_failure` is an external runner or repository Actions condition, not passing test evidence. Resolve the repository Actions condition or run the manual equivalent and attach the complete transcript before changing the Phase 1 status.