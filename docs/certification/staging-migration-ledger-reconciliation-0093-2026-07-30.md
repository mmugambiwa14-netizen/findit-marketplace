# Staging Migration Ledger Reconciliation 0093

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration `0093_private_marketplace_view_implementation.sql` was
applied to staging after its exact DDL and complete listing/service counter
semantics passed rollback-only hosted validation. It moves the volatile
`record_marketplace_view(text, uuid)` `SECURITY DEFINER` implementation into
the non-exposed `private` schema while preserving the public RPC signature
through a volatile `SECURITY INVOKER` wrapper.

GitHub Actions was unable to start runners for the latest branch head: failed
jobs contained no steps and no downloadable logs, including retries. This was
an execution-infrastructure failure rather than an executed test failure. The
same SQL had already passed the Release Candidate source boundary, and the
exact migration plus semantic fixtures were therefore validated directly on
staging inside transactions that were fully rolled back before permanent apply.

The managed apply-migration API recorded generated version `20260730204610`
instead of the repository's canonical version `0093`.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730204610` |
| Name | `private_marketplace_view_implementation` |
| Statement count | 1 |
| Statement MD5 | `0034925ba82386a9d2147fd09fa72de4` |
| Statement length | 7672 |

## Repair

The staging-only ledger capsule is:

`supabase/maintenance/reconcile_staging_migration_history_0093.sql`

It verifies the exact migration name, statement hash and statement length,
refuses an occupied canonical version or unexpected generated version, and
changes only the migration ledger version. It executes no function, grant,
view-counter or application-data statement. It is idempotent after completion
and explicitly excluded from production use.

## Completion evidence

Hosted structural verification returned:

| Check | Result |
|---|---:|
| Private volatile marketplace-view definers | 1 |
| Public volatile invoker wrappers | 1 |
| PUBLIC execute grants on either identity | 0 |
| `anon` public-wrapper execution | preserved |
| `authenticated` public-wrapper execution | preserved |
| `service_role` public-wrapper execution | preserved |
| `anon` private-implementation execution | preserved |
| Anonymous private-schema usage | preserved |

Rollback-only hosted fixtures proved:

| Semantic check | Result |
|---|---|
| Anonymous available-listing view | incremented 5 to 6 |
| Anonymous active-service view | incremented 7 to 8 |
| Listing-owner self view | remained 6 |
| Service-provider self view | remained 8 |
| Different authenticated listing viewer | incremented 6 to 7 |
| Different authenticated service viewer | incremented 8 to 9 |
| Paused listing | returned null; counter unchanged |
| Paused service | returned null; counter unchanged |
| Unknown parent | returned null |
| Unsupported parent type | rejected with SQLSTATE `22023` |
| Residual fixture rows after rollback | 0 |

Post-reconciliation verification returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 93 |
| First version | `0001` |
| Last version | `0093` |
| Sequence mismatches | 0 |
| Remaining generated versions | 0 |

The hosted Supabase Security Advisor no longer reports
`public.record_marketplace_view` as an anonymously executable exposed
`SECURITY DEFINER` function. Remaining findings concern separate public,
event, support, user and admin RPC boundaries and hosted Auth configuration.

Production was not queried or changed by migration 0093 or this ledger
reconciliation. The production project remains at migration `0049`.
