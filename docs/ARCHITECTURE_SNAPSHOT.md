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
| Migrations | 138 |
| Tables created | 90 |
| Tables with RLS enabled | 90 |
| Views | 5 |
| `create policy` statements | 218 |
| `security definer` functions | 317 |
| `set search_path` pins | 374 |
| pgTAP suites | 46 |

Every table created in a migration has row level security enabled.

## Edge Functions (28)

- `contextual-ecosystem`
- `contextual-ecosystem-health`
- `delete-account`
- `essential-notification-fanout`
- `listing-expiry-worker`
- `listing-image-upload`
- `marketplace-image-upload`
- `media-lifecycle-cleanup`
- `nearby-listings`
- `personalized-recommendations`
- `recently-listed`
- `recommendation-maintenance`
- `recommendation-service-health`
- `related-products`
- `related-services`
- `seller-recommendations`
- `similar-listings`
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
- Last: `20260805074500_database_lint_and_runtime_contract_repairs.sql`
