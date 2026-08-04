# Peek Threads — implementation record and handoff

Living document. Updated as each phase lands, so this work can be continued by
someone (or something) else without re-deriving the analysis.

**Status: Phase 2 of 6 complete.** See the phase table at the bottom.

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
| 2 | Domain + contracts: request/response validation, ranking, lifecycle rules | **Done** — `src/domain/peekThreads/` |
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

### Phase 2 — done

`src/domain/peekThreads/`, covered by `tests/peekThreadContracts.test.mjs`
(41 tests). These modules are **pure** — no Supabase client, no React — so the
API layer (phase 3/4) and the UI (phase 5) can both use them, and so they are
testable without a database.

| Module | Holds |
|---|---|
| `categories.js` | The nine request categories with labels and composer hints, plus `SUGGESTED_REQUESTS` per listing kind |
| `requestContracts.js` | Length bounds, lifecycle transitions, request normalisation, duplicate detection |
| `ranking.js` | Buyer-facing demand ordering, seller queue priority, responsiveness summary |

**They are not yet imported by any route.** That is expected at this phase, not
an oversight — phases 3 to 5 are what consume them. The tests are what keep
them honest in the meantime; do not let a future cleanup pass mistake them for
dead code before phase 5 lands.

#### The decisions, and why

**Bounds are copied from the migration, and the test reads the migration.**
`REQUEST_BODY_MIN`/`MAX` are 8 and 280 because
`peek_requests_body_length` says `between 8 and 280`. The test parses
`0116_peek_threads_foundation.sql` and compares, rather than hardcoding the
numbers twice. If someone widens the CHECK without touching the client, the
test fails. Drift here is not cosmetic: a body the client accepts and Postgres
rejects arrives as a bare `23514` with no field attribution, which a buyer
experiences as an unexplained failure after typing their request.

The same test parses both enums. A category present in JavaScript but absent
from `peek_request_category` fails the insert with `22P02`.

**Over-long input is truncated, not rejected.** 300 characters of genuine
detail is not an error worth throwing away; 4 characters is. So the maximum
truncates and the minimum refuses.

**Transitions are an explicit map, not free movement.** `answered` cannot go
back to `pending` — that would strip a Response Peek from a public thread with
no trace. `answered -> answered` *is* allowed, because a seller replacing a
Response Peek with a better one supersedes the binding rather than reverting
the state. `declined -> answered` and `expired -> answered` are allowed, since
both are changes of heart in the buyer's favour. `merged` and `removed` are
terminal apart from moderation.

**Duplicate detection is Jaccard overlap of significant tokens, not fuzzy
string distance.** "Show the front tyres" and "Show the rear tyres" are one
short word apart by edit distance and would merge under any Levenshtein
threshold loose enough to be useful — but they are genuinely different
questions, and merging them destroys the one a buyer asked. Token overlap
scores that pair at 0.5, below the 0.6 threshold. Stopwords are stripped first,
including marketplace-specific noise (`show`, `see`, `photo`, `peek`), because
without that every request looks 60% similar to every other.

A candidate must also share the asker's category: "show the tyres" under
Condition asks about wear, under Measurements asks about size.

Only `pending` and `answered` requests are redirect targets. Pointing a buyer
at a request that was declined or removed is worse than letting them ask.

**Ranking constants, so they can be tuned knowingly:**

| Constant | Value | Reasoning |
|---|---|---|
| Demand half-life | ~14 days | A six-month-old request with 30 supporters must not permanently own the top slot |
| Answered multiplier | 0.4 | Answered threads still rank, but below pending ones of equal demand — the point of the list is surfacing what still needs an answer |
| Seller queue | `supporters*2 + sqrt(waitingDays)*3 + listingPriority` | Waiting grows without bound so an ignored request always eventually rises, but sub-linearly so one ancient request cannot bury a popular new one |
| Duplicate threshold | 0.6 | Tuned against the brief's own example requests |

The brief lists "interest count, age, listing priority and pending time" as
four inputs. Age and pending time are the same clock for a pending request, so
waiting is counted once and weighted heavily rather than twice.

**Sorting is deterministic on ties, tie-broken by id.** An unstable comparator
under a "load more" button duplicates or skips rows between pages. The test
asserts that reversing the input does not change the output.

**`summariseResponsiveness` returns `null`, not zeroes, for a seller with no
settled requests.** Publishing "answers 0% of requests" about someone who has
simply not been asked yet is a punishing default. It also reports the **median**
response time rather than the mean, so one request a seller took three months
to answer does not define how they are described.

#### Verified, not assumed

```
node --test tests/peekThreadContracts.test.mjs     41 pass, 0 fail
npm run test:contracts                            624 pass, 0 fail
npm run typecheck                                 clean
npm run typecheck:active                          249 source modules
npm run lint                                      clean
npm run verify:source-graph                       468 modules, 0 unresolved
npm run verify:hygiene                            939 files inspected
npm run verify:sql-boundary                       116 migrations, 87 rollbacks
npm run verify:deployment-security                pass
npm run build                                     pass (5 gates)
```

Tests that pass are weak evidence on their own, so each load-bearing assertion
was checked against a deliberately broken copy of the source:

| Mutation | Caught by |
|---|---|
| `close_up` renamed to `closeup` | categories match the enum |
| `REQUEST_BODY_MIN` changed 8 to 5 | bounds match the CHECK |
| duplicate detection stops comparing category | same wording, different category |
| `answered -> pending` added to the transition map | transitions are explicit |
| time decay removed from `demandScore` | demand decays |
| median replaced with mean | median, not mean |
| `settled.length === 0` early return removed | a seller nobody asked |

Seven mutations, seven failures, and the suite back to 41 passing once
reverted.

### Phase 3 — next, and how to start

The read API. Nothing in phases 3 to 6 should add a second video pipeline; a
Response Peek is still an ordinary `listing_tours` row.

Build `src/repositories/peekThreadsRepository.js`, modelled on
`src/repositories/publicListingsRepository.js`. Specifically:

- Threads are `peek_requests` rows plus their `peek_request_responses`. There
  is no `peek_threads` table — see the decision above.
- Pagination is **keyset**, not offset. `src/services/keysetPagination.js`
  already has `applyDescendingCreatedAtCursor`; the pattern of asking for
  `limit + 1` rows and deriving the next cursor from the extra one is in
  `publicListingsRepository.js` around line 158.
- The four filters are already defined as `THREAD_FILTERS` in `ranking.js`.
  `top` and `newest` need matching index support — migration `0116` created
  indexes for exactly this; check them before adding more.
- **Buyer privacy is a hard requirement.** `requester_id` is not granted to
  `anon`. The read path exposes `requested_by_label` ("a buyer"), never a
  profile. Do not select `requester_id` on the public path and filter it in
  JavaScript — that ships it to the browser.
- If a purpose-built RPC is needed for the ranked read, follow the existing
  `private.*` convention: `SECURITY DEFINER` with `set search_path to ''`, and
  `revoke execute ... from anon` explicitly. Note that this project has default
  privileges granting `EXECUTE` to `anon`, so `revoke ... from public` alone
  does **not** remove it — verify with `pg_proc.proacl` afterwards rather than
  trusting the migration's success return.

Phase 4 (write API) then needs `create`, `support`, `withdraw support`, `merge`,
`answer` and `decline`. Note that `answer` is the one that must bind a
`listing_tours` row via `peek_request_responses` and must **not** touch
`listing_tour_slots` — the slot guard from phase 1 will reject it with `22023`
if it tries, which is the safety net, not the design.

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
