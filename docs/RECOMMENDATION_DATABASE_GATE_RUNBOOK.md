# Recommendation Database Gate Runbook

## Purpose

This runbook defines the executable database boundary for recommendation data,
services, contextual planning, personalization, analytics, and typed service
recommendations. Source contracts are not a substitute for a clean
PostgreSQL/PostGIS reset, lint, and pgTAP execution.

The authoritative workflows are:

- `.github/workflows/migration-gates.yml`
- `.github/workflows/recommendation-database-gates.yml`

Both workflows pin Supabase CLI `2.84.2`.

## Automated gate

The database jobs must:

1. Start a clean disposable Supabase stack.
2. Apply every migration through
   `0074_nearby_service_hosted_timeout_budget.sql`.
3. Run database lint at error level.
4. Run `v1_recommendation_foundation.sql`.
5. Run `v1_recommendation_projection_queue.sql`.
6. Run `v1_recommendation_eligibility_geospatial.sql`.
7. Run `v1_recommendation_publication_boundary.sql`.
8. Run `v1_recommendation_services.sql`.
9. Run `v1_recommendation_service_operations.sql`.
10. Run `v1_recommendation_scale.sql`.
11. Run `v1_contextual_ecosystem_intelligence.sql`.
12. Run `v1_recommendation_personalization.sql`.
13. Run `v1_recommendation_analytics.sql`.
14. Run `v1_recommendation_related_services.sql`.
15. Stop the local stack without preserving test state.

## Evidence required

Record the tested commit SHA, clean-reset result through `0074`, database lint,
all eleven pgTAP suite results, source contracts, application and Edge
typechecks, production build, and target classification.

Hosted certification must separately record the exact project ref, policy state,
fixture cleanup, transport evidence, timeout and circuit evidence, and whether
production was changed.

## Failure handling

Do not mark a phase certified when GitHub Actions reports `startup_failure`,
Docker or Supabase fails to start, any migration or assertion fails, database
lint reports an error, the tested SHA differs from the PR head, or hosted
evidence targets an ambiguous project.

A zero-job `startup_failure` is an external runner condition, not passing
evidence. Restore the runner or attach a complete equivalent clean-reset
transcript before changing certification status.
