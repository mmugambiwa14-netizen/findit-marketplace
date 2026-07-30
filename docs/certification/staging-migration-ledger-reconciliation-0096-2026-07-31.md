# Staging migration-ledger reconciliation — 0096

Date: 2026-07-31 (Europe/Istanbul)

## Scope

Staging-only canonicalization and hosted verification of:

`0096_private_recommendation_event_implementation.sql`

Target: FindIt Staging (`bwgklpxoetrrkutottdb`). Production was not queried or changed and remains locked at migration `0049`.

## Managed apply identity

| Field | Verified value |
| --- | --- |
| Generated version | `20260730231129` |
| Migration name | `private_recommendation_event_implementation` |
| Statement count | 1 |
| Statement MD5 | `954932bc89a0e80ac7e73c277b6edf0b` |
| Statement length | 7054 |

The guarded repair changes only the migration-ledger version after exact name, hash, length and timestamp-version verification.

## Canonical ledger result

| Check | Hosted result |
| --- | --- |
| Canonical rows | 96 |
| Last version | `0096` |
| Sequence mismatches | 0 |
| Generated versions remaining | 0 |

## Function boundary

| Check | Hosted result |
| --- | --- |
| Private volatile `SECURITY DEFINER` | 1 |
| Public volatile `SECURITY INVOKER` | 1 |
| Preserved default arguments | 7 |
| `PUBLIC` execute grants | 0 |
| Browser/service role grants | Preserved |

Public identity remains:

`public.record_recommendation_event(text, uuid DEFAULT NULL, uuid DEFAULT NULL, uuid DEFAULT NULL, uuid DEFAULT NULL, text DEFAULT NULL, text DEFAULT NULL, jsonb DEFAULT '{}') -> uuid`

## Hosted semantic matrix

| Semantic check | Result |
| --- | --- |
| Anonymous public-wrapper view | Passed |
| Anonymous direct-private search | Passed |
| Listing seller attribution | Correct |
| Search event excludes listing/seller | Correct |
| Anonymous raw-event read | Denied |
| Invasive context field | Rejected with SQLSTATE `22023` |
| Anonymous save event | Rejected with SQLSTATE `42501` |
| Unsafe stored context | 0 rows |
| Residual listings | 0 |
| Residual events | 0 |
| Residual locations | 0 |

The existing full recommendation-foundation matrix remains wired to certify authenticated events, suspended-account rejection, seller-spoof prevention, event RLS and taxonomy isolation in clean-database CI.

## Security Advisor result

The Advisor no longer reports `public.record_recommendation_event` as anonymous-callable `SECURITY DEFINER`.

The only remaining anonymous-callable definer finding is:

- `public.public_listing_search_page`

Provider-side Auth warnings for leaked-password protection and MFA remain separate release work.

## CI note

GitHub Actions has been failing before runner steps or logs are created. Migration 0096 was therefore certified using fail-closed hosted execution and rollback-only semantic transactions. Conventional clean-database CI remains required when runners recover.
