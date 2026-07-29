# Recommendation Database Gate Runbook

## Purpose

This runbook closes the executable Phase 1 database gate for the recommendation foundation. It verifies actual PostgreSQL, PostGIS, worker and RLS behaviour; source-contract tests alone are not a substitute.

The authoritative CI workflow is `.github/workflows/migration-gates.yml`. It contains both the frontend/source job and the clean local Supabase database job. There is no second overlapping recommendation workflow.

## Automated gate

On pull requests and pushes to `main`, the database job must:

1. start a clean local Supabase stack;
2. apply all migrations through `0058_recommendation_publication_fail_open_closure.sql`;
3. run database lint at error level;
4. run `v1_recommendation_foundation.sql`;
5. run `v1_recommendation_projection_queue.sql`;
6. run `v1_recommendation_eligibility_geospatial.sql`;
7. run `v1_recommendation_publication_boundary.sql`;
8. run `v1_recommendation_scale.sql`;
9. stop the local stack without persisting test state.

The job must pass before Phase 2 begins.

## Local equivalent

Use the exact Supabase CLI version and commands recorded in `.github/workflows/migration-gates.yml`. Run the same migration startup, lint and five pgTAP suites against a disposable local stack only.

## Evidence required

Record:

- the tested commit SHA;
- migration reset success through `0058`;
- database lint success;
- all five pgTAP suite results;
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

A zero-job `startup_failure` is an external runner or repository Actions condition, not passing test evidence. Resolve the repository Actions condition or run the local equivalent and attach the complete transcript before changing the Phase 1 status.