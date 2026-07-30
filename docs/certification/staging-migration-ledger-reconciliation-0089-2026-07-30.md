# Staging Migration Ledger Reconciliation 0089

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration `0089_private_country_helper_implementations.sql` was
applied to staging only after the release candidate, migration and
recommendation database suites all passed on branch head
`ff32c0f44e919dbf8702b4ecab62b68ac391eac0`.

The migration preserves the public signatures of `is_country_browsable(text)`,
`is_country_publishable(text)` and
`is_supported_listing_currency(text, text)` while moving their privileged
`SECURITY DEFINER` implementations into the non-exposed `private` schema.
Public compatibility functions remain locked `SECURITY INVOKER` wrappers.
The existing search and listing workflows retain all four stored call paths.

The managed apply-migration API recorded generated version
`20260730192815` instead of the repository's canonical version `0089`.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730192815` |
| Name | `private_country_helper_implementations` |
| Statement count | 1 |
| Statement MD5 | `4eec3db83666d4d91087d5b8083a92f8` |
| Statement length | 10477 |

## Repair

The only ledger repair executed was:

`supabase/maintenance/reconcile_staging_migration_history_0089.sql`

The script verifies the exact name, statement hash and statement length,
refuses an occupied canonical version or unexpected source version, changes
only the migration ledger version, and executes no function, grant or
application-data statement. It is idempotent after completion.

## Completion evidence

Post-repair verification returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 89 |
| Last version | `0089` |
| Remaining generated versions | 0 |
| Private country definers | 3 |
| Public invoker compatibility wrappers | 3 |
| Preserved stored call paths | 4 |
| `PUBLIC` execute grants on these functions | 0 |

Anonymous execution proved each public wrapper returned the same value as its
private implementation for Zimbabwe browsing, publishing and USD-listing
currency checks. The hosted Security Advisor no longer reports any of these
three functions as anonymous- or authenticated-executable `SECURITY DEFINER`
functions, clearing six targeted warnings.

Production was not queried or changed by this migration or reconciliation and
remains at migration `0049`.
