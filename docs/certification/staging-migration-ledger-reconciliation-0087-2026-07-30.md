# Staging Migration Ledger Reconciliation 0087

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration `0087_private_policy_helper_boundary.sql` was applied to
staging only after the release, migration and recommendation database suites
passed. It moves six policy-only `SECURITY DEFINER` helpers from the exposed
`public` schema into non-exposed `private`, preserves the execution privileges
required by RLS, and explicitly qualifies all six dependent policies.

The managed apply-migration API recorded generated version `20260730182037`
instead of the repository's canonical version `0087`.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730182037` |
| Name | `private_policy_helper_boundary` |
| Statement count | 1 |
| Statement MD5 | `2a19735b6f615fd56d50745df38bdedb` |
| Statement length | 11463 |

## Repair

The only ledger repair executed was:

`supabase/maintenance/reconcile_staging_migration_history_0087.sql`

The script verifies the exact name, statement hash and statement length, refuses
an occupied canonical version or unexpected source version, changes only the
migration ledger version, and executes no function, policy, schema or
application-data statement. It is idempotent after completion.

## Completion evidence

A post-repair query returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 87 |
| First version | `0001` |
| Last version | `0087` |
| Sequence mismatches | 0 |
| Remaining generated `20260730...` versions | 0 |
| Target helpers remaining in `public` | 0 |
| Target `SECURITY DEFINER` helpers in `private` | 6 |
| Dependent policies explicitly using `private.*` | 6 |

The hosted Supabase security advisor no longer reports the six targeted exposed
policy-helper functions. Remaining function warnings concern separate public,
user and admin RPC boundaries and are being reviewed individually rather than
revoked indiscriminately.

Production was not queried or changed by this migration or reconciliation and
remains at migration `0049`.
