# FLOW-11 — Messaging
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/chats`, `/chats/:conversationId` (auth + `featureFlags.messaging`, `App.jsx:193-194`) → `Inquiries.jsx` → `messagingRepository`: `start_listing_conversation` (`:15`), `send_conversation_message` (`:22`), `message_inbox` (`:29`, `p_limit`), `message_conversation` (`:38`), `findMessageThread(conversationId, limit = 200)` (`:43`).
Legacy `/messages*` redirect to `/chats*` (`App.jsx:180-181`).

## Assessment
| Aspect | State |
|---|---|
| Participant authorization | PASS — `conversations_participant_read`: `is_active_user() and (buyer_id = auth.uid() or seller_id = auth.uid() …)` |
| Write boundary | PASS — all writes via RPC; no direct table insert path |
| Bounded pagination | PASS — `p_limit` on inbox and conversation; thread capped at 200 |
| Realtime | **Not used.** `@supabase/realtime-js` is aliased to a throwing stub (`vite.config.js:70`, `src/lib/noRealtimeClient.js`) and `supabase/config.toml` disables Realtime. Messaging is poll/refetch based. |
| Reporting | `conversation_reports` table present |

## Gaps
- Realtime being stubbed out is a deliberate, documented decision, but combined with `refetchOnWindowFocus:false` and `refetchOnReconnect:false` (`query-client.js:9-10`) a user may not see a new message until a manual navigation. **F-031 (P2)** — for a marketplace whose primary contact channel competes with WhatsApp, silent message latency is a product risk.
- `feature/peek-threads-phase-3` (156 commits ahead) and `develop` (434 ahead) may hold the deferred real-time work — **UNRECONCILED BRANCH DELTA**, see Phase 0 §0.3.
