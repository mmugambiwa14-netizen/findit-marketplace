# Peek Threads Phase 3 — Read API Handoff

Status: implemented on `feature/peek-threads-phase-3`.
Base: `claude/findit-hardening-listing-012cf0` at `4c94842`.

## Delivered

- `0118_peek_thread_read_api.sql` adds one bounded public read function over the existing Phase 1 tables.
- Exactly one listing or service parent is required.
- Filters: `all`, `answered`, `pending`.
- Sorts: `most_wanted`, `newest`.
- Keyset pagination uses supporter count, creation time and UUID; no offsets or exact counts.
- Page size is clamped to 50 and the database reads `limit + 1` to derive continuation.
- Buyer identity is never returned; public copy is always `a buyer`.
- Answered requests are hidden unless their current Response Peek is still a published, approved `listing_tours` row with `peek_kind = response`.
- The API returns only `current_response_id`. It does not return a storage path or playback URL. Explicit playback remains on the existing `tour-playback-access` boundary.
- `src/domain/peekThreads/readContracts.js` normalizes parent, filters, sort, cursor and page output.
- `src/repositories/peekThreadsRepository.js` is the only Supabase read adapter.
- `src/services/peekThreadsService.js` exposes the UI-facing page operation.
- `tests/peekThreadReadContracts.test.mjs` covers defaults, bounds, cursor normalization, privacy and migration invariants.

## Deliberate limits

This phase does not create, support, merge, answer or decline requests. Those are Phase 4 writes.
It does not add listing-page or seller-dashboard UI. That is Phase 5.
It does not mint playback URLs or duplicate the existing Peek pipeline.

## Next phase

Phase 4 should add narrow RPCs for:

1. Create request with cooldown and duplicate candidate lookup.
2. Add/remove `I want this too` support idempotently.
3. Seller decline.
4. Seller/admin merge with supporter transfer and cycle prevention.
5. Bind one processed Response Peek to one or more requests atomically, superseding old bindings without touching `listing_tour_slots`.

Every write must keep requester identity private, enforce parent ownership in the database and produce durable events for Phase 6 notification fan-out.
