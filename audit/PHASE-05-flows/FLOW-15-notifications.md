# FLOW-15 — Notifications
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/notifications` (auth + `featureFlags.essentialNotifications`, `App.jsx:196`) → `NotificationCenter.jsx` → `notificationsRepository`: `notification_rows` (`:14`), `notification_rows_page` (`:23`), `notification_unread_count` (`:33`), `mark_notification_read` (`:37`).
Write side: `app_alerts` inserts from RPCs, e.g. the Peek Request owner alert (`20260804191200:44`).
Delivery: `essential-notification-fanout` and `web-push-dispatch` Edge Functions; `web_push_delivery_jobs` and `web_push_subscriptions` tables.

## Assessment
| Aspect | State |
|---|---|
| Bounded pagination | PASS — `notification_rows_page` |
| **Idempotency** | PASS — alert inserts use `source_key` + `on conflict do nothing`, so retries do not duplicate |
| Job table safety | PASS — `web_push_delivery_jobs` explicitly revoked from `anon, authenticated` and asserted unreachable by a `do $migration$` block (`20260806140000`) |
| Deep links | Present (`/peek-requests`) — but see F-030 |

## Gaps
- **F-030 (P2)** — seller Peek-request alerts deep-link to the buyer page.
- **F-008 (P3)** — `VITE_WEB_PUSH_PUBLIC_KEY` is undocumented and unvalidated, so a missing key fails only at runtime enrolment.
- Provider failure degradation and dedupe across channels are **UNVERIFIED — needs check** (requires hosted evidence, E-004).
