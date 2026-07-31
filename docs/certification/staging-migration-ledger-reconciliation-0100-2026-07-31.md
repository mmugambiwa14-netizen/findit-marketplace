# Staging Migration Ledger Reconciliation 0100

Date: 2026-07-31
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production: not queried or changed

## Repository migration

- Canonical version: `0100`
- File: `supabase/migrations/0100_release_control_consistency.sql`
- Name: `release_control_consistency`
- Rollback: `supabase/rollback/0100_release_control_consistency.rollback.sql`

## Hosted application

Supabase applied the migration under generated version `20260731013402`.
The stored migration statement identity was verified before reconciliation:

- statement MD5: `a33c974cd9ebb77ef3789342a202538e`
- statement length: `5042`
- matching rows: exactly one
- canonical `0100` rows before repair: zero

The guarded maintenance capsule changes only the migration ledger version after
locking `supabase_migrations.schema_migrations` and verifying all identity
fields. It does not modify marketplace data or schema objects.

## Hosted postconditions

- maps metadata names MapLibre GL JS `5.12.0`
- tile and geocoding provider is MapTiler Cloud
- public precision remains city-level
- current-location matching requires user consent and manual fallback
- recommendation metadata reflects seven enabled independent services
- personalization is recorded as available but remains default-off and consent-gated
- redundant anonymous and authenticated grants are removed from
  `recommendation_events_default`
- `service_role` access is preserved

## Validation

The migration passed a rollback-only hosted transaction before permanent
application. The rollback capsule is also exercised inside a hosted transaction
without persisting its changes. Clean-database CI remains required on the final
unchanged commit when GitHub Actions runners execute normally.
