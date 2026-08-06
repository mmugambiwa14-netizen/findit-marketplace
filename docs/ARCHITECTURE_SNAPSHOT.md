# Architecture snapshot

<!--
  GENERATED FILE -- do not edit by hand.
  Run `npm run docs:architecture` to regenerate.
  tests/architectureSnapshotContracts.test.mjs fails when this drifts.
-->

Derived from the repository on each run of `npm run docs:architecture`.

## Database

| Measure | Count |
|---|---|
| Migrations | 154 |
| Tables created | 96 |
| Tables with RLS enabled | 96 |
| Views | 5 |
| `create policy` statements | 223 |
| `security definer` functions | 346 |
| `set search_path` pins | 399 |
| pgTAP suites | 50 |

Every table created in a migration has row level security enabled.

## Edge Functions (23)

- `contextual-ecosystem`
- `contextual-ecosystem-health`
- `delete-account`
- `essential-notification-fanout`
- `listing-expiry-worker`
- `listing-image-upload`
- `marketplace-image-upload`
- `media-lifecycle-cleanup`
- `personalized-recommendations`
- `recommendation-maintenance`
- `recommendation-service-health`
- `recommendations`
- `tour-admin-review-access`
- `tour-cache-invalidation`
- `tour-feed`
- `tour-lifecycle-cleanup`
- `tour-observability-monitor`
- `tour-playback-access`
- `tour-processing-callback`
- `tour-processing-worker`
- `tour-upload-complete`
- `tour-upload-intent`
- `web-push-dispatch`

## GitHub workflows (8)

- `deploy-staging-pages.yml`
- `maintenance-workers.yml`
- `migration-gates.yml`
- `recommendation-database-gates.yml`
- `release-candidate-gates.yml`
- `release-certification.yml`
- `staging-tour-processing-on-push.yml`
- `tours-staging-acceptance.yml`

## First and last migration

- First: `0001_extensions_and_enums.sql`
- Last: `20260806140000_close_default_public_execute_and_table_grants.sql`
