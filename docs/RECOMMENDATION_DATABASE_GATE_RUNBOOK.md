# Recommendation Database Gate Runbook

## Purpose

This runbook closes the executable database gates for the recommendation foundation and independent recommendation services. Source-contract tests alone are not a substitute for a clean PostgreSQL/PostGIS reset, lint and pgTAP execution.

The authoritative CI workflow is `.github/workflows/migration-gates.yml`.

## Automated gate

The database job must:

1. start a clean disposable Supabase stack;
2. apply every migration through `0062_recommendation_service_operations_and_audit.sql`;
3. run database lint at error level;
4. run `v1_recommendation_foundation.sql`;
5. run `v1_recommendation_projection_queue.sql`;
6. run `v1_recommendation_eligibility_geospatial.sql`;
7. run `v1_recommendation_publication_boundary.sql`;
8. run `v1_recommendation_services.sql`;
9. run `v1_recommendation_service_operations.sql`;
10. run `v1_recommendation_scale.sql`;
11. stop the local stack without preserving test state.

## Evidence required

Record the tested commit SHA, clean reset success through `0062`, database lint result, all seven pgTAP suite results, source-contract/typecheck/build results, and confirmation that no hosted staging or production database was targeted.

## Failure handling

Do not mark Phase 1 or Phase 2 certified when GitHub Actions reports `startup_failure`, Docker or Supabase fails to start, any migration or assertion fails, database lint reports an error, evidence targets a hosted database, or the tested SHA differs from the current PR head.

A zero-job `startup_failure` is an external account or runner condition, not passing evidence. Restore GitHub Actions billing or attach a complete equivalent local transcript before changing certification status.