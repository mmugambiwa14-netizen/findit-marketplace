# Staging Migration Ledger Reconciliation 0084

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration `0084_recommendation_foreign_key_covering_indexes.sql` was
applied to staging only after all three branch CI suites passed and a rolled-back
staging rehearsal confirmed coverage for the partitioned recommendation-event
parent, all nine attached partitions, and the three non-partitioned targets. The
managed apply-migration API recorded generated version `20260730154827` instead
of the repository's canonical version `0084`.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730154827` |
| Name | `recommendation_foreign_key_covering_indexes` |
| Statement count | 1 |
| Statement MD5 | `07aa80888471117955790e5f04f6ae04` |
| Statement length | 877 |

## Repair

The only ledger repair executed was:

`supabase/maintenance/reconcile_staging_migration_history_0084.sql`

The script verifies the exact name, statement hash and statement length, refuses
an occupied canonical version or unexpected source version, changes only the
migration ledger version, and executes no application schema or data statement.
It is idempotent after completion.

## Completion evidence

A post-repair query returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 84 |
| First version | `0001` |
| Last version | `0084` |
| Sequence mismatches | 0 |
| Remaining generated `20260730...` versions | 0 |
| Non-partitioned targets left uncovered | 0 |
| Recommendation-event relations checked | 10 |
| Recommendation-event relations left uncovered | 0 |
| Explicitly named `idx_fk_*` indexes | 47 |

The hosted performance advisor no longer reports any
`unindexed_foreign_keys` finding. Newly created indexes may remain listed as
unused until representative production traffic exercises them; that is not a
reason to remove fresh foreign-key coverage.

Production was not queried or changed by this migration or reconciliation and
remains at migration `0049`.
