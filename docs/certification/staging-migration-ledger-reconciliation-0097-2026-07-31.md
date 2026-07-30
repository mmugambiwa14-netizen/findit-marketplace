# Staging migration-ledger reconciliation — 0097

Date: 2026-07-31 (Europe/Istanbul)

## Scope

Staging-only canonicalization and hosted certification of:

`0097_private_public_listing_search_implementation.sql`

Target: FindIt Staging (`bwgklpxoetrrkutottdb`). Production was not queried or changed and remains locked at migration `0049`.

## Managed apply identity

| Field | Verified value |
| --- | --- |
| Generated version | `20260730232401` |
| Migration name | `private_public_listing_search_implementation` |
| Statement count | 1 |
| Statement MD5 | `6f4a8444625267fd9d2eaf440eff233d` |
| Statement length | 8908 |

The guarded reconciliation changes only the migration-ledger version after exact name, hash, length and timestamp-version verification.

## Canonical ledger result

| Check | Hosted result |
| --- | --- |
| Canonical rows | 97 |
| First version | `0001` |
| Last version | `0097` |
| Sequence mismatches | 0 |
| Generated versions remaining | 0 |
| Idempotent second execution | Passed |
| Canonical `0097` row preserved | Yes |

## Function boundary

| Check | Hosted result |
| --- | --- |
| Private stable `SECURITY DEFINER` | 1 |
| Public stable `SECURITY INVOKER` | 1 |
| Preserved default arguments | 14 |
| Preserved output fields | 31 |
| `PUBLIC` execute grants | 0 |
| `anon`, `authenticated`, `service_role` grants | Preserved |

The public identity remains the existing 15-argument keyset RPC and returns the complete listing, location and kind-specific detail projection. The implementation body and output type are independently fingerprinted.

## Hosted semantic matrix

Five rollback-only car fixtures were used: three visible rows, one draft row and one content-suspended row.

| Semantic check | Result |
| --- | --- |
| `limit + 1` overfetch | Passed |
| Newest keyset traversal | Three pages, no duplicate or skipped visible row |
| `newest` ordering | Passed |
| `price_asc` ordering | Passed |
| `price_desc` ordering | Passed |
| `most_viewed` ordering | Passed |
| Text query | Passed |
| Category filter | Passed |
| Brand/condition/fuel/transmission filters | Passed |
| Draft exclusion | Passed |
| Content-suspension exclusion | Passed |
| Public/private result parity | Passed |
| Exact output shape | 31 fields |
| Location projection | Passed |
| Car-detail projection | Passed |
| Malformed cursor | Rejected with SQLSTATE `22023` |
| Unpaired cursor components | Rejected with SQLSTATE `22023` |
| Invalid listing kind | Rejected with SQLSTATE `22023` |
| Residual listings after rollback | 0 |
| Residual locations after rollback | 0 |

The active repository continues to pass all 15 RPC arguments and consumes the existing `limit + 1` keyset contract.

## Security Advisor result

After migration 0097, the Security Advisor reports **zero** `anon_security_definer_function_executable` findings. The anonymous-callable definer hardening group is complete.

Remaining security notices are separate boundaries:

- authenticated/admin or owner RPC definers that enforce authenticated authorization internally
- RLS-enabled service-only or dormant tables without browser policies
- provider-side leaked-password protection
- provider-side MFA options

## CI note

GitHub Actions has recently failed before runner steps or logs were created. Migration 0097 was therefore certified through fail-closed hosted execution and rollback-only semantic transactions. The focused pgTAP matrix and active keyset source contracts remain wired for conventional clean-database CI when runners recover.
