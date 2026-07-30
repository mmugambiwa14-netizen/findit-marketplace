# Staging Migration Ledger Reconciliation 0090

Date: 2026-07-30
Target: FindIt Staging (`bwgklpxoetrrkutottdb`)
Production impact: none
Status: completed and verified

## Reason

Repository migration `0090_seller_profile_identifier_privacy.sql` was applied
to staging only after the release candidate, migration and recommendation
database suites all passed on branch head
`6c38a2358b7c93661d12a5ecc11d460dd2a01c61`.

The migration removes public account-email seller lookup and replaces it with
an opaque UUID contract. The privileged implementation lives in the
non-exposed `private` schema, and the public RPC is a locked
`SECURITY INVOKER` wrapper. A profile is returned only when the seller is active
and has at least one publicly eligible, non-suspended listing in a browsable
country. Property, vehicle, machinery and service detail routes now link by
seller or provider UUID rather than email.

The hosted migration application completed concurrently and recorded generated
version `20260730195624` instead of the repository's canonical version `0090`.
A subsequent duplicate apply attempt failed closed after detecting the already
created UUID wrapper; it did not create an alternate schema state.

## Verified source identity

| Field | Value |
|---|---|
| Generated version | `20260730195624` |
| Name | `seller_profile_identifier_privacy` |
| Statement count | 1 |
| Statement MD5 | `c90a4e5942969979fafe8ef7b02e812b` |
| Statement length | 8212 |

## Repair

The only ledger repair executed was:

`supabase/maintenance/reconcile_staging_migration_history_0090.sql`

The script verifies the exact name, statement hash and statement length,
refuses an occupied canonical version or unexpected source version, changes
only the migration ledger version, and executes no function, grant, route or
application-data statement. It is idempotent after completion.

## Completion evidence

Post-repair verification returned:

| Check | Result |
|---|---:|
| Canonical migration rows | 90 |
| Last version | `0090` |
| Remaining generated versions | 0 |
| Private UUID seller-profile definers | 1 |
| Public UUID invoker wrappers | 1 |
| Legacy email overloads | 0 |
| `PUBLIC` execute grants | 0 |
| Existing eligible staging sellers | 1 |

Anonymous hosted verification returned a real eligible seller profile with
exactly the fields `id`, `full_name`, `bio` and `avatar_url`. No email field was
present. Unknown and null UUIDs returned no profile. The hosted Security Advisor
no longer reports the seller-profile RPC as an anonymous- or
authenticated-executable `SECURITY DEFINER` function, clearing two targeted
warnings.

Production was not queried or changed by this migration or reconciliation and
remains at migration `0049`.
