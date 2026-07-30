# Staging Migration Ledger Reconciliation 0085

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration `0085_rls_auth_initialization_plans.sql` was applied to
staging only after all three branch CI suites passed. The migration fingerprints
the complete pre-change `USING` and `WITH CHECK` expressions of the exact 36
policies reported by Supabase's `auth_rls_initplan` advisor, changes only direct
`auth.uid()` calls to one-time scalar initialization plans, and proves all
non-auth predicates remain unchanged after PostgreSQL deparses the policies.

The managed apply-migration API recorded generated version `20260730163946`
instead of the repository's canonical version `0085`.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730163946` |
| Name | `rls_auth_initialization_plans` |
| Statement count | 1 |
| Statement MD5 | `ac1a27efc299f4e77fe7bc585ff9278a` |
| Statement length | 11544 |

## Repair

The only ledger repair executed was:

`supabase/maintenance/reconcile_staging_migration_history_0085.sql`

The script verifies the exact name, statement hash and statement length, refuses
an occupied canonical version or unexpected source version, changes only the
migration ledger version, and executes no policy, schema or application-data
statement. It is idempotent after completion.

## Completion evidence

A post-repair query returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 85 |
| First version | `0001` |
| Last version | `0085` |
| Sequence mismatches | 0 |
| Remaining generated `20260730...` versions | 0 |
| Policies using initialized `auth.uid()` | 36 |
| Policies retaining direct `auth.uid()` | 0 |

The hosted Supabase performance advisor no longer reports any
`auth_rls_initplan` finding. The remaining advisor warnings concern multiple
permissive policies and low-traffic unused-index observations; those are separate
hardening boundaries and are not evidence that the initialization-plan migration
failed.

Production was not queried or changed by this migration or reconciliation and
remains at migration `0049`.
