# Production Readiness

## Scope limit stated up front

This audit ran offline with no database, no Docker and no hosted project. It can
therefore assess **design readiness** — whether the pagination, indexing,
cleanup and idempotency mechanisms exist and are correctly shaped — but it
cannot measure throughput.

**No claim is made anywhere in this document about the number of users,
listings, tours or messages the application can sustain.** Every load-bearing
smoke script in the repository requires infrastructure that was unavailable;
those are listed in EXTERNAL_BLOCKERS.md and must be run before any capacity
statement is credible.

## Design readiness by concern

| Concern | Status | Evidence |
|---|---|---|
| Pagination | **Strong** | Keyset pagination in 39 modules; `src/services/keysetPagination.js` is the shared primitive; `useCursorStack` for admin tables |
| Cursor design | **Strong** | Composite cursors (`{createdAt,id}`, `{id,publishedAt}`) — stable under insert, no offset drift |
| Index/cursor alignment | **Strong** | `conversations_buyer_inbox (buyer_id, last_message_at desc, id desc)` matches the cursor exactly; likewise seller inbox |
| Indexing | **Strong** | 125 indexes / 49 tables; listings 17, tours 7, reports 6 |
| Query selectivity | **Good** | RLS predicates are `auth.uid()`-anchored and index-backed |
| N+1 avoidance | **Good** | `attachPublicTourSummaries` batches by id array; `tour-feed` signs assets in one bounded batch |
| Unbounded queries | **Good** | `config.toml` `max_rows = 1000` caps PostgREST; feeds are cursor-limited |
| Background cleanup | **Strong** | `media-lifecycle-cleanup`, `tour-lifecycle-cleanup`, `tour_asset_cleanup_queue`, `listing-expiry-worker` |
| Idempotency | **Good** | Lease-based job claiming (`p_lease_seconds: 120`); queue tables keyed per asset; bucket inserts `on conflict do update` |
| Duplicate-event handling | **Good** | Upload **intents** are recorded then matched, so a replayed upload cannot create a second tour |
| Observability | **Good** | `tour-observability-monitor`, `operational_metric_buckets`, `operational_alerts`, correlation IDs, `shouldSample()` |
| Media delivery | **Good** | Private buckets + short-lived signed URLs (300 s playback / 3600 s cards) |
| CDN | **Partial** | Purge hook exists (`tour-cache-invalidation`) but `TOUR_CACHE_PURGE_URL` is optional and unconfigured; no CDN is provisioned |
| Upload retry / resumability | **Partial** | Retry exists at the processing-worker layer; **browser uploads are not resumable** — a dropped 250 MB upload restarts |
| Realtime | **N/A** | Realtime is disabled (`config.toml`) and no `.channel()` subscription exists in `src/`. Chat updates via React Query refetch. No subscription-leak risk; latency is poll-bound |
| Connection pressure | **Unknown** | `db.pooler` disabled locally; hosted pooling not configurable from this tree |
| Rate limiting | **Partial** | Supabase auth limits configured; no application-level per-user quota (S-03) |
| Abuse resistance | **Good** | RLS blocks enumeration; `conversations_one_buyer_per_listing` bounds thread spam; structured error codes leak no schema |
| Caching | **Good** | React Query with `canonicalQueryInvalidation` performing deliberate prefix invalidation |
| Backup / restore | **Documented, unverified** | `docs/BACKUP_AND_RECOVERY.md` and `docs/BACKUP_AND_DISASTER_RECOVERY.md` exist; no restore has been exercised |

## Blocking issues

### P-01 (High) — production build fails its budget gate — **fixed**

`npm run build` used to exit 1. `vite build` itself succeeds and both Base44
boundary gates pass; the failure was `scripts/verify-build-budget.mjs`:

| Metric | Before | After | Budget |
|---|---|---|---|
| entryRawBytes | 589,483 | **531,885** | 573,440 |
| entryGzipBytes | 173,563 | **156,683** | 174,080 |

Every route is already lazy-loaded, so the weight sat in the eagerly-imported
shell: `App.jsx` → `AuthProvider` → `authService` → `supabaseClient` pulls the
Supabase SDK into the entry chunk. A per-module size report identified the
actual cause: `createClient()` unconditionally instantiates a `RealtimeClient`,
pulling in `@supabase/realtime-js` and its Phoenix websocket transport
(~151 KB pre-minify) even though realtime is disabled (`config.toml`) and
nothing in `src/` calls `.channel()` (row above, "Realtime").

Vendor-chunk splitting was tried first and rejected — it breaks scope-hoisting
and grows the true initial payload (entry + modulepreload) from 589 KB/173 KB
to 752 KB/218 KB gzip. See `vite.config.js` and F-14 in `AUDIT_SUMMARY.md`.

*Correction applied:* `src/lib/noRealtimeClient.js` stubs the four methods
`SupabaseClient` actually calls on its realtime instance (`setAuth`,
`getChannels`, `removeChannel`, `removeAllChannels`), aliased over
`@supabase/realtime-js` in `vite.config.js` `resolve.alias` (browser build
only — Node scripts and Edge Functions still get the real package).
`channel()` throws rather than no-op'ing, so real future realtime use fails
loudly at the call site instead of silently doing nothing.

*Verified:* `npm run build` exits 0; `npm run lint`, `npm run test:contracts`
(239/239) and `npm run audit:extensive` (twice in succession) all pass
unchanged.

*Blocked (before fix):* GitHub no · fresh Supabase no · staging yes · production yes.

### P-02 (High) — `audit:extensive` cannot be run twice — **fixed**

The top-level product gate is not idempotent. `extensive-product-audit.mjs:104`
writes `artifacts/extensive-audit/extensive-audit-verification.json` containing
captured `node --test` output, which includes the U+2714 check-mark glyph.
`verify-repository-hygiene.mjs:5` ignores only `.git`, `node_modules`, `dist`
and `coverage` — **not `artifacts/`** — and forbids pictographic symbols.

First run passes hygiene, then writes the artifact. The next run fails:

```
[FAIL] repository hygiene
- artifacts\extensive-audit\extensive-audit-verification.json:14: prohibited emoji or pictographic symbol U+2714
```

Reproduced by running the command twice; the first run of this audit passed the
hygiene gate and the second failed on the artifact the first had written.

*Impact:* the gate intended to certify the product surface produces a false
failure on every repeat run, which trains reviewers to ignore it and masks real
regressions. It is also non-deterministic across environments, since the glyphs
depend on the test reporter.

*Correction (choose one, deliberately):*
1. Normalise runner status glyphs to ASCII before serialising the artifact —
   preserves the hygiene rule's reach over generated files; or
2. Exclude generated artifact paths from the pictographic rule **only**, keeping
   secret and merge-marker scanning active there.

Not fixed in Phase 9; fixed in remediation round 1 (option 1: runner status
glyphs normalised to ASCII before serialisation). Verified by running
`npm run audit:extensive` twice in succession with identical `[PASS]` results.

*Blocked (before fix):* GitHub no · fresh Supabase no · staging yes · production yes.

### P-03 (Medium) — dead-end on the missing-profile screen — **fixed**

`ProtectedRoute.jsx:81` renders `<UserNotRegisteredError onRetry={checkUserAuth} />`
with no `onSignOut`. `UserNotRegisteredError.jsx:31` renders its sign-out button
conditionally (`{onSignOut && …}`), so the button disappears. `App.jsx:115`
passes both props — the inconsistency is only on the protected-route path.

*Impact:* a signed-in user whose profile row is missing, arriving at any
protected route, sees only "Try again". If the profile stays missing they cannot
sign out and cannot leave — recovery requires clearing browser storage.

*Correction:* pass `onSignOut={logout}` at `ProtectedRoute.jsx:81`, matching
`App.jsx`. One line.

*Blocks:* GitHub no · fresh Supabase no · staging no · **production yes**.

## Not blocking, but do before public launch

- **S-03** — add per-user rate limiting inside the mutation RPCs.
- **P-04 (Medium)** — browser uploads are not resumable. A 250 MB tour upload on
  an unstable mobile connection restarts from zero. Given the target market this
  is a real completion-rate risk. Consider chunked/resumable upload.
- **P-05 (Low)** — no CDN provisioned. Signed 300 s playback URLs are served
  directly from Supabase Storage; the purge hook is built but unwired.
- **P-06 (Low)** — restore has never been exercised. A documented backup
  procedure that has not been restored from is an untested assumption.

## What is genuinely production-shaped

Worth stating plainly, because it is unusual at this stage: pagination is keyset
throughout with cursors that match their indexes; cleanup queues are
lease-based and idempotent; uploads are intent-mediated so replays cannot
duplicate; observability has correlation IDs and sampling; and the entire
authorization model is enforced in the database. These are the parts that are
expensive to retrofit, and they are already right.

The blockers above are, by contrast, cheap: a bundle split, a gate fix and a
one-line prop.
