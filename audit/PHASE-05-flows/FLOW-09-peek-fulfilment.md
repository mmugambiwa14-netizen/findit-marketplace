# FLOW-09 — Seller Peek fulfilment (accept → capture → process → bind → notify)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`accept_peek_request(uuid)` → `TourUploader.jsx` (`<input type=file accept="video/*" capture="environment">`, `:211`) → `tour-upload-intent` → `tour-upload-complete` → `tour-processing-worker` / `tour-processing-callback` → binding → buyer alert → playback via `tour-playback-access`.
Authoritative migration: `20260807020000_peek_request_fulfilment_lifecycle.sql`.

## Controls verified — this is a well-built state machine
| Control | Evidence |
|---|---|
| Active account | `is_active_user()` → `42501` (`:15`) |
| Request exists | → `P0002` (`:19`) |
| **Correct seller only** | `private.peek_request_parent_owner(v_request)` must equal `auth.uid()` → *"Only the listing owner can accept this Peek Request"* (`:20-22`) |
| Acceptable state | `status='pending'` and `moderation_status='approved'` → `22023` (`:24`) |
| No concurrent attempts | existing fulfilment in `accepted|uploading|processing` → rejected (`:32`) |
| Already completed | → `22023` (`:35-36`) |
| **Bounded retries** | *"Peek Request fulfilment retry limit reached"* (`:39`) |
| **Bounded expiry** | `expires_at = now() + interval '48 hours'` (`:50`) |
| Stale-attempt closure | `expire_stale_peek_request_fulfilments(integer)`; triggers on `listing_tours` status/moderation change and on `peek_requests` status change (`:82-88`) |
| Write boundary | `peek_request_fulfilments` has one SELECT policy only; all writes go through RPCs |

**Appendix C — "Only correct seller fulfils", "Abandoned attempts cannot answer later", "Retries bounded" = PASS.**

## Gaps
- **F-012/F-013 (P1)** — this is the migration whose rollback script breaks `verify:sql-boundary`, which is what turns all five CI workflows red and skips lint, typecheck, build and contracts. The most important new subsystem is the one that broke the gate.
- **F-014 (P2)** — the 10 typecheck errors are concentrated in `BuyerPeekRequestsQueue.jsx:112-126`, this flow's UI.
- **F-030 (P2)** — no top-level seller queue route; the notification deep-link points at the buyer page.
- Processing depends on an external worker whose deployment is unverified (**E-002**). If it is not running, fulfilments accept and then never complete.
