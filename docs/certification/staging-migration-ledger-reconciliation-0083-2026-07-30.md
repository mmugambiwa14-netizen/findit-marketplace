# Staging Migration Ledger Reconciliation 0083

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration `0083_foreign_key_covering_indexes.sql` was applied to
staging only after all three branch CI suites passed and a rolled-back staging
rehearsal reported zero uncovered target foreign keys. The managed
apply-migration API recorded generated version `20260730152945` instead of the
repository's canonical version `0083`.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730152945` |
| Name | `foreign_key_covering_indexes` |
| Statement count | 1 |
| Statement MD5 | `1a5b9aba07f6fd7307d8ea6f9cb9bcc9` |
| Statement length | 4801 |

## Repair

The only ledger repair executed was:

`supabase/maintenance/reconcile_staging_migration_history_0083.sql`

The script verifies the exact name, statement hash and statement length, refuses
an occupied canonical version or unexpected source version, changes only the
migration ledger version, and executes no application schema or data statement.
It is idempotent after completion.

## Completion evidence

A post-repair query returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 83 |
| First version | `0001` |
| Last version | `0083` |
| Sequence mismatches | 0 |
| Remaining generated `20260730...` versions | 0 |

The 43 dedicated `idx_fk_*` indexes are present on staging. The original set of
hosted advisor foreign-key warnings addressed by `0083` is cleared. A later
advisor refresh surfaced a separate recommendation-partition subset, which is
outside `0083` and must be handled by a new migration rather than rewriting this
applied migration.

Production was not queried or changed by this repair and remains at migration
`0049`.