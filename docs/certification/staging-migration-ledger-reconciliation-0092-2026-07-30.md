# Staging Migration Ledger Reconciliation 0092

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration `0092_zimbabwe_province_hierarchy.sql` was applied to
staging while the implementation branch remained draft. It establishes a
canonical Zimbabwe location hierarchy with 10 provinces, 58 towns and the
existing seed cities attached to their correct provinces.

The managed apply-migration API recorded generated version `20260730202651`
instead of the repository's canonical version `0092`.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730202651` |
| Name | `zimbabwe_province_hierarchy` |
| Statement count | 1 |
| Statement MD5 | `d4abcc073bbd14b18cefa3ef33187d7b` |
| Statement length | 3983 |

## Repair

The staging-only ledger capsule is:

`supabase/maintenance/reconcile_staging_migration_history_0092.sql`

It verifies the exact migration name, statement hash and statement length,
refuses an occupied canonical version or unexpected generated version, and
changes only the migration ledger version. It executes no location inserts,
updates, deletes or schema statements. It is idempotent after completion and is
explicitly excluded from production use.

## Completion evidence

Post-reconciliation verification returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 92 |
| First version | `0001` |
| Last version | `0092` |
| Sequence mismatches | 0 |
| Remaining generated versions | 0 |
| Zimbabwe country rows | 1 |
| Active canonical provinces | 10 |
| Active canonical towns with active province | 58 |
| Correctly parented existing seed cities | 10 |
| Same-type Zimbabwe location-name duplicates | 0 |

The exact provinces are Bulawayo, Harare, Manicaland, Mashonaland Central,
Mashonaland East, Mashonaland West, Masvingo, Matabeleland North,
Matabeleland South and Midlands.

Production was not queried or changed by migration 0092 or this ledger
reconciliation. The production project remains at migration `0049`.
