# Staging migration-ledger reconciliation — 0099

Date: 2026-07-31 (Europe/Istanbul)

## Scope

Staging-only canonicalization and hosted certification of:

`0099_private_personalization_preference_implementations.sql`

Target: FindIt Staging (`bwgklpxoetrrkutottdb`). Production was not queried or changed and remains locked at migration `0049`.

## Managed apply identity

| Field | Verified value |
| --- | --- |
| Generated version | `20260730234710` |
| Migration name | `private_personalization_preference_implementations` |
| Statement count | 1 |
| Statement MD5 | `312c6f522a12cfed915b679ede33bf59` |
| Statement length | 9571 |

The guarded reconciliation changes only the migration-ledger version after exact name, hash, length and timestamp-version verification.

## Canonical ledger result

| Check | Hosted result |
| --- | --- |
| Canonical rows | 99 |
| First version | `0001` |
| Last version | `0099` |
| Sequence mismatches | 0 |
| Generated versions remaining | 0 |
| Canonical identity recheck | One exact canonical row; zero noncanonical source rows |

## Function boundary

| Check | Hosted result |
| --- | --- |
| Private `SECURITY DEFINER` implementations | 3 |
| Public `SECURITY INVOKER` wrappers | 3 |
| Get preference | Stable / jsonb |
| Set preference | Volatile / jsonb |
| Clear account-linked activity | Volatile / jsonb |
| `PUBLIC` execute grants | 0 |
| Authenticated and service-role grants | Preserved |
| Anonymous execution | Denied |

## Hosted semantic matrix

Two rollback-only accounts, two preferences and two account-linked recommendation events were used.

| Semantic check | Result |
| --- | --- |
| No stored preference returns default-off | Passed |
| Private enable observed through public get | Passed |
| Public disable observed correctly | Passed |
| Private re-enable | Passed |
| Public clear result | `cleared=true`, one owner event removed, personalization disabled |
| Private get after clear | Disabled state observed |
| Owner preference retained disabled | Passed |
| Other account preference | Unchanged |
| Other account event | Unchanged |
| Owner event | Removed |
| Cross-account preference visibility | Blocked by RLS |
| Suspended-account update | Rejected with SQLSTATE `42501` |
| Residual preferences after rollback | 0 |
| Residual events after rollback | 0 |
| Residual users after rollback | 0 |

The active client retains the exact get, set and clear RPC identities and bounded privacy-setting failure messages.

## Security Advisor result

The Advisor no longer reports these authenticated-callable `SECURITY DEFINER` functions:

- `public.get_my_recommendation_personalization_v1`
- `public.set_my_recommendation_personalization_v1`
- `public.clear_my_recommendation_personalization_data_v1`

The anonymous-callable definer category remains at zero. Remaining function warnings are separate authenticated admin, owner, messaging, media and notification-query boundaries. Provider-side leaked-password protection and MFA notices also remain.

## CI note

GitHub Actions continues to fail before runner steps or logs are created. Migration 0099 was therefore certified through fail-closed hosted execution and rollback-only semantic transactions. The focused boundary matrix and complete personalization privacy matrix remain wired for conventional clean-database CI when runners recover.
