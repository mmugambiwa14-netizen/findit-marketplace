# Peek Threads Phase 4 — write API handoff

Status: repository implementation complete; hosted database verification pending.

## Delivered

- `0119_peek_thread_write_api.sql`
- create request RPC with active-account, public-parent, owner-self-request and bounded cooldown checks
- idempotent “I want this too” support and withdrawal
- seller decline with bounded reason
- seller-controlled duplicate merge with supporter transfer
- Response Peek binding to 1–25 requests
- replacement history through `peek_request_responses.is_current`
- client write contracts, repository adapters and service functions
- rollback capsule and contract tests

## Preserved boundaries

- No new video table, storage path or processing path was introduced.
- A Response Peek must already be an approved, published `listing_tours` row with `peek_kind = 'response'`.
- Binding never reads or writes `listing_tour_slots`, so the Main Listing Peek cannot be replaced.
- Playback URLs remain behind the existing explicit `tour-playback-access` path.
- Notification fan-out is not performed synchronously here; Phase 6 owns durable delivery.

## Hosted verification required

Apply migrations through `0119` to an isolated Supabase environment and prove with buyer, stranger, owner and service-provider accounts:

1. buyer can create on a public parent; owner cannot create demand on own parent
2. inactive account and private/sold parent fail closed
3. support is one row per buyer and self-support fails
4. withdrawal decrements exactly once
5. only parent owner can decline or merge
6. merge transfers unique supporters and preserves the source pointer
7. only approved published response Peeks bind
8. cross-parent binding fails atomically
9. replacing a response keeps old binding history and one current row
10. Main Listing Peek slot remains unchanged

## Next phase

Phase 5: listing-detail Peek Thread UI, duplicate-aware request composer, thread cards and filters, seller request queue, and the upload binding selection step.
