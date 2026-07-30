# Staging migration-ledger reconciliation — 0098

Date: 2026-07-31 (Europe/Istanbul)

## Scope

Staging-only canonicalization and hosted certification of:

`0098_private_notification_read_implementations.sql`

Target: FindIt Staging (`bwgklpxoetrrkutottdb`). Production was not queried or changed and remains locked at migration `0049`.

## Managed apply identity

| Field | Verified value |
| --- | --- |
| Generated version | `20260730233613` |
| Migration name | `private_notification_read_implementations` |
| Statement count | 1 |
| Statement MD5 | `75a707810d3c120b283a1d6688019d6d` |
| Statement length | 8451 |

The guarded reconciliation changes only the migration-ledger version after exact name, hash, length and timestamp-version verification.

## Canonical ledger result

| Check | Hosted result |
| --- | --- |
| Canonical rows | 98 |
| First version | `0001` |
| Last version | `0098` |
| Sequence mismatches | 0 |
| Generated versions remaining | 0 |
| Canonical identity precondition recheck | One exact canonical row; zero noncanonical source rows |

## Function boundary

| Check | Hosted result |
| --- | --- |
| Private `SECURITY DEFINER` implementations | 3 |
| Public `SECURITY INVOKER` wrappers | 3 |
| `notification_unread_count` volatility/result | Stable / bigint |
| `mark_notification_read` volatility/result | Volatile / boolean |
| `mark_all_notifications_read` volatility/result | Volatile / integer |
| `PUBLIC` execute grants | 0 |
| Authenticated and service-role grants | Preserved |
| Anonymous execution | Denied |

## Hosted semantic matrix

Two rollback-only users and four notifications were used.

| Semantic check | Result |
| --- | --- |
| Public unread-count path | Passed |
| Private unread-count path | Passed |
| Mark one notification read | Passed |
| Mark all remaining notifications read | Passed |
| Unread count transition `3 → 2 → 0` | Passed |
| Cross-user mark-read attempt | Returned false and changed no row |
| Owner `read_at` timestamps | Set for all three owner notifications |
| Suspended-account access | Rejected with SQLSTATE `42501` |
| Suspended-account message | `active account required` |
| Residual notifications after rollback | 0 |
| Residual users after rollback | 0 |

The active repository retains the same three RPC identities and bounded user-facing failure messages.

## Security Advisor result

The Advisor no longer reports these authenticated-callable `SECURITY DEFINER` functions:

- `public.notification_unread_count`
- `public.mark_notification_read`
- `public.mark_all_notifications_read`

The anonymous-callable definer category remains at zero. Remaining function warnings are separate authenticated admin, owner, messaging, media, notification-query and personalization boundaries. Provider-side leaked-password protection and MFA notices also remain.

## CI note

GitHub Actions continues to fail before runner steps or logs are created. Migration 0098 was therefore certified through fail-closed hosted execution and rollback-only semantic transactions. The focused boundary matrix and complete essential-notification matrix remain wired for conventional clean-database CI when runners recover.
