# Staging Migration Ledger Reconciliation 0088

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration `0088_private_authorization_helper_implementations.sql`
was applied to staging only after the release candidate, migration and
recommendation database suites all passed on branch head
`349445cb590fa3f6eb9e426f75c805fd53663d3b`.

The migration preserves the public signatures of `is_active_user()`,
`is_admin()` and `is_super_admin()` while moving their privileged
`SECURITY DEFINER` implementations into the non-exposed `private` schema.
Public compatibility functions remain as locked `SECURITY INVOKER` wrappers.
All 102 dependent RLS policies remain attached to the original private
function identities.

The managed apply-migration API recorded generated version
`20260730191129` instead of the repository's canonical version `0088`.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730191129` |
| Name | `private_authorization_helper_implementations` |
| Statement count | 1 |
| Statement MD5 | `2c4078e78456c67bd0b308674c2569ff` |
| Statement length | 9200 |

## Repair

The only ledger repair executed was:

`supabase/maintenance/reconcile_staging_migration_history_0088.sql`

The script verifies the exact name, statement hash and statement length,
refuses an occupied canonical version or unexpected source version, changes
only the migration ledger version, and executes no function, policy, grant or
application-data statement. It is idempotent after completion.

## Completion evidence

Post-repair verification returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 88 |
| Last version | `0088` |
| Remaining generated versions | 0 |
| Private authorization definers | 3 |
| Public invoker compatibility wrappers | 3 |
| Active-user policy dependencies | 27 |
| Admin policy dependencies | 75 |
| `PUBLIC` execute grants on these functions | 0 |

Anonymous execution of all three public wrappers completed safely and returned
`false` without exposing privileged data. The hosted Security Advisor no longer
reports `is_active_user`, `is_admin`, or `is_super_admin` as browser-executable
`SECURITY DEFINER` functions.

Production was not queried or changed by this migration or reconciliation and
remains at migration `0049`.
