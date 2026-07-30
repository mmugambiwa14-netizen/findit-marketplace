# Staging Migration Ledger Reconciliation

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none

## Reason

Repository migrations `0077` through `0082` were applied to staging through the
managed apply-migration API. The database objects and behaviour were correct,
but the managed API recorded generated timestamp versions instead of the
repository's canonical four-digit versions. This would cause a future CLI
migration comparison to treat the same changes as both pending and already
applied.

## Pre-repair evidence

| Canonical | Recorded version | Name | Statement MD5 | Length |
|---|---|---|---|---:|
| `0077` | `20260730032100` | `real_marketplace_view_counting` | `7912fa31d66a3d0ee88c08c1bd040bb3` | 1656 |
| `0078` | `20260730053011` | `service_catalog_recommendation_alignment` | `1b7e1cadd527e661c33f7af2e436746c` | 4618 |
| `0079` | `20260730053757` | `on_demand_recommendation_projection` | `e75c89ddee52cb538dc099259a9075db` | 1899 |
| `0080` | `20260730060045` | `listing_detail_related_services_context` | `12a1ad7ab6d477a7f8b79986ab07ba5b` | 1705 |
| `0081` | `20260730141354` | `public_business_profile_view_security` | `1e7fd9e2fe6f1c479ae91b163c3f0efa` | 2393 |
| `0082` | `20260730142631` | `pg_trgm_extension_schema_security` | `b717618066f5730b9f7887b2bdfbe0ed` | 423 |

Each source row contains one statement and the expected migration name. No
canonical `0077`-`0082` ledger row existed before repair.

## Repair

Run only:

`supabase/maintenance/reconcile_staging_migration_history_0077_0082.sql`

The script:

- locks only the migration ledger for the transaction;
- verifies exact migration name, statement MD5 and statement length;
- accepts only the known `20260730HHMMSS` source versions;
- refuses occupied canonical versions, duplicate source rows or content drift;
- changes only `supabase_migrations.schema_migrations.version`;
- executes no schema or data migration statement;
- is idempotent after successful reconciliation.

## Completion requirements

After the transaction:

- `supabase_migrations.schema_migrations` must contain exactly one row for every
  version from `0001` through `0082`;
- no generated `20260730...` migration version may remain;
- names `real_marketplace_view_counting` through
  `pg_trgm_extension_schema_security` must map to `0077` through `0082`;
- all three repository CI suites must remain green;
- hosted Security Advisor and the two new security matrices must remain green;
- production must remain unchanged at `0049`.

This is migration metadata reconciliation, not a production migration or schema
change.