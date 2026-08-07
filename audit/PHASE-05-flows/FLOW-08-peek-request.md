# FLOW-08 — Peek Request (buyer request → seller queue)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`PeekThreadsSection` / request composer → `peekThreadsRepository` → **`create_peek_request(...)`**, current definition `20260804191200_allow_peek_request_alert_events_and_fix_count.sql:36-45`.
Buyer view: `/peek-requests` → `BuyerPeekRequests.jsx` → `BuyerPeekRequestsQueue.jsx`.

## Controls verified
| Control | Evidence |
|---|---|
| Self-request blocked | `if v_owner=v_user then raise exception 'You cannot request a Peek from your own listing'` (`:38`) |
| Duplicate/rate limit | same category + same parent + `status='pending'` within **10 minutes** → rejected (`:39`) |
| Auto-approval | inserts `moderation_status='approved'` (`:41`) — **MVP-compliant, no human queue** |
| Supporter seeding | `peek_request_supporters` insert `on conflict do nothing` |
| Owner notification | `app_alerts` insert with `source_key='peek-request:'||id` and `on conflict do nothing` — **idempotent** |
| Public visibility | `peek_requests_public_read` requires `moderation_status='approved' and status <> 'removed'` |

## Gaps
- **F-026 (P2)** — the column default is `'pending'`; any insert path omitting `moderation_status` produces a request that is invisible publicly and unacceptable by the seller, with no error surfaced to the buyer.
- **F-030 (P2)** — the seller's "New Peek Request" alert deep-links to `/peek-requests` (`:44`), which `App.jsx:191` routes to `BuyerPeekRequests` — the buyer-side page. There is no top-level seller fulfilment route; the seller queue is `ResponsePeekBindingQueue` / `BuyerPeekRequestsQueue` reached from elsewhere. A seller following the notification may land on a page that does not show the request they were told about.
- Cancellation and expiry are covered in FLOW-09.
