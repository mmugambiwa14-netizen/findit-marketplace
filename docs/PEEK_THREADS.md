# Peek Threads — implementation record and handoff

Living document. Updated as each phase lands, so this work can be continued by
someone (or something) else without re-deriving the analysis.

**Status: Phase 1 of 6 complete.** See the phase table at the bottom.

---

## What this is

Peek Threads turn a listing from a static advert into an evolving record of
visual evidence. A buyer asks for something specific ("show a cold engine
start"), other buyers add their weight to it, and the seller answers with a
short video that becomes public evidence attached to the listing.

It is **not** a comment system, and it is **not** a second video pipeline.

---

## The architecture it extends — read this before writing code

The repository already has a complete Peek (video) subsystem. Peek Threads
reuse all of it. These are the pieces and what they do:

| Table | Role |
|---|---|
| `listing_tours` | The video entity. Full lifecycle: upload → processing → ready → approved → published → superseded → removed. Holds storage paths, dimensions, codecs, moderation status, processing lease/retry machinery. |
| `listing_tour_slots` | **One slot per listing/service**, holding `current_tour_id` and `pending_tour_id`. This is what makes a Peek "the Main Listing Peek". |
| `listing_tour_events` | Append-only event log for every tour state change. |
| `listing_tour_upload_intents` | Idempotent upload intents, with orphan cleanup fields. |
| `tour_asset_cleanup_queue` | Deletes storage objects for removed/superseded tours. |
| `tour_cache_invalidations` | Fan-out queue for cache purges. |

Edge Functions already in place: `tour-upload-intent`, `tour-upload-complete`,
`tour-processing-worker`, `tour-processing-callback`, `tour-playback-access`,
`tour-admin-review-access`, `tour-feed`, `tour-lifecycle-cleanup`,
`tour-cache-invalidation`, `tour-observability-monitor`.

**None of the above is replaced. A Response Peek is an ordinary
`listing_tours` row that goes through the identical upload, processing and
moderation path.**

### The collision that shapes the design

`public.publish_listing_tour` (migration `0034`, around line 88) does this:

```sql
update public.listing_tour_slots
set current_tour_id = candidate.id, pending_tour_id = null
where id = slot_row.id;
-- ...then marks the previous tour 'superseded'
```

So the existing publish path **promotes a tour into the listing's single slot
and supersedes whatever was there**. If a Response Peek used that path
unchanged, answering "show the rear tyres" would silently destroy the seller's
main walkaround video.

Therefore:

- `listing_tours` gains a `peek_kind` discriminator (`'main'` | `'response'`),
  defaulting to `'main'` so **every existing row keeps its current meaning**.
- Slot promotion is guarded to reject `peek_kind = 'response'`.
- Response Peeks are published by binding them to requests, never to the slot.

---

## Data model

### Decision: there is no `peek_threads` table

The brief lists "Peek Threads" among the tables to introduce. It was
deliberately not created. A thread is exactly "a request plus its responses" —
a `peek_threads` row would carry no column that `peek_requests` does not
already have, and every read would pay an extra join for it. The *thread* is a
UI and API concept assembled from `peek_requests` + `peek_request_responses`.

If a thread ever acquires its own state (pinning, seller-authored topics,
per-thread moderation), add the table then.

### Tables added in migration `0116`

**`public.peek_requests`** — the question.

| Column | Notes |
|---|---|
| `id` | uuid pk |
| `listing_id` / `service_id` | exactly one is non-null, enforced by CHECK |
| `requester_id` | the buyer who asked |
| `category` | `peek_request_category` enum |
| `body` | the short request text, length-bounded |
| `status` | `pending` \| `answered` \| `declined` \| `expired` \| `merged` \| `removed` |
| `merged_into_id` | self-reference, set when a duplicate is merged |
| `supporter_count` | denormalized counter, trigger-maintained |
| `current_response_id` | the `listing_tours` row currently answering it |
| `moderation_status` | mirrors the tour moderation vocabulary |
| `answered_at`, `declined_at`, `decline_reason` | lifecycle timestamps |

**`public.peek_request_supporters`** — "I want this too".

Primary key `(request_id, user_id)` — that *is* the one-vote-per-buyer rule,
enforced by the database rather than by application code.

**`public.peek_request_responses`** — which Peek answers which request.

Many-to-many on purpose: one Response Peek may answer several requests, and a
request may accumulate several responses over time. `is_current` marks the live
one; superseded rows stay, which is how "future responses replace the public
one without losing history" is satisfied.

### Counters

`supporter_count` is maintained by trigger on insert/delete of a supporter row.
Counting supporters on read would be an N+1 across every thread card on a busy
listing. The counter is the cached value the ranking reads.

---

## Security model

Every new table has RLS enabled with explicit per-operation policies.

| Operation | Rule |
|---|---|
| Read requests | Public for non-removed, non-rejected requests on a publicly visible parent |
| Create request | Authenticated active user; `requester_id` forced to `auth.uid()`; rate-limited |
| Support request | Authenticated active user; own row only; cannot support own request |
| Withdraw support | Own row only |
| Answer request | Listing owner only, via RPC |
| Decline request | Listing owner only, via RPC |
| Moderate | Admin only |

**Buyer privacy (brief requirement):** requests are public but the requester is
not. The public read path exposes `requested_by_label` ("a buyer"), never the
requester's profile. `requester_id` is not granted to `anon`.

Consistent with migrations `0109`–`0115`, new tables must **not** carry
`TRUNCATE`/`TRIGGER`/`REFERENCES` grants to browser roles, and any column
holding personal data must not be granted to `anon`.

---

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | Database: enums, tables, counters, RLS, slot guard | **Done** — migration `0116` |
| 2 | Domain + contracts: request/response validation, ranking, lifecycle rules | Not started |
| 3 | Read API: thread retrieval, keyset pagination, filters (Answered / Pending / Most Wanted / Newest) | Not started |
| 4 | Write API: create, support, merge, answer, decline RPCs | Not started |
| 5 | UI: request composer with duplicate detection, thread cards, seller dashboard queue, upload binding step | Not started |
| 6 | Notifications: fan-out to requester + supporters, deduplicated per buyer | Not started |

### Phase 1 — done

Migration `0116_peek_threads_foundation.sql` and its rollback capsule.
Applied to staging and production.

**Verified on staging, not assumed:**

```
response peek cannot enter the Main Peek slot   22023 rejected
anon cannot read requester_id                   withheld
anon can read request body                      readable
anon has no TRUNCATE on peek_requests           none
anon cannot insert a request                    none
RLS enabled on all three tables                 3
existing tours all defaulted to main            6 of 6
```

The first line is the one that matters. Without the slot guard, publishing a
Response Peek would have promoted it into `listing_tour_slots` and superseded
the seller's Main Listing Peek.

- `peek_request_category` and `peek_request_status` enums
- `peek_requests`, `peek_request_supporters`, `peek_request_responses`
- `listing_tours.peek_kind` discriminator, defaulting to `'main'`
- Slot-promotion guard rejecting response peeks
- Supporter counter trigger
- RLS on all three tables
- Indexes for ranking and keyset pagination

### Phase 2 — next, and how to start

Create `src/domain/peekThreads/` mirroring `src/domain/listingSchema/`:

- `categories.js` — the nine categories with labels and ordering
- `requestContracts.js` — validation for request creation. Reuse
  `sanitizeSingleLine` from `src/lib/sanitizeText.js` for the body; bound it to
  the same length the CHECK constraint enforces.
- `ranking.js` — the ordering the brief specifies: interest count, age, listing
  priority, pending time.

Write the tests alongside, as `tests/peekThreadContracts.test.mjs`. The
existing `tests/listingSchemaRegistry.test.mjs` is the closest model.

### Conventions this repository enforces

Anything continuing this work must satisfy these, or CI fails:

- `npm run typecheck` and `npm run typecheck:active` — JSDoc types, `checkJs`
  is on. Do not add `any` to silence an error.
- `npm run verify:hygiene` — **no literal emoji in source**, and no
  TODO/FIXME/HACK/XXX markers.
- `npm run verify:sql-boundary` — every migration needs a rollback capsule in
  `supabase/rollback/`, rollbacks may not contain `drop table`, `truncate` or
  `delete from`, and the release-tip anchor is duplicated in
  `scripts/verify-sql-boundary.mjs` **and**
  `tests/currentReleaseBoundaryContracts.test.mjs` — bump both.
- `npm run build` runs five gates including a bundle secret scan.
- Tests are `node:test`, run with `npm run test:contracts`. Imports inside
  `src/services` and `src/domain` must be **relative**, not `@/`, or the tests
  cannot resolve them.
