# PeekaListing — dead and unused code

**Audit base:** `main` @ `28540ca`
**Method:** a module reachability graph resolved from the real entry point (`src/main.jsx`, following
`@/` and relative specifiers including dynamic `import()`), export-usage analysis across 631 consumer files
(app, tests, scripts and Edge Functions), and a SQL call graph that counts invocations in function bodies,
RLS policies, CHECK constraints and triggers while excluding `GRANT`/`REVOKE`/`COMMENT` lines and
name-as-string verification blocks.

Numbers below are what survived verification. Several first-pass results were wrong and are noted at the
end.

---

## Verdict

**The database is fully wired — no function is unreachable.** The dependency tree is clean: zero unused
production packages, zero environment variables declared but never read. That is a better result than most
codebases return.

The dead weight is in the **application layer and the shipped bundle**: 15 orphan modules totalling ~1,500
lines, 79 unused exports, and 264 KB of retired-brand assets shipping on every deploy.

Two findings are more than tidiness. **View counting is entirely disconnected** — the client code that
increments listing and Peek view counts is orphaned, so those numbers never move for real users. And
**five maintenance jobs have no scheduler**, so stale records are never cleaned up.

| # | Finding | Impact |
|---|---|---|
| 1 | View counting is disconnected end to end | **Feature silently broken** |
| 2 | Five maintenance jobs exist with no scheduler | **Operational** |
| 3 | The disposable-email signup guard is disabled | **Operational** |
| 4 | 15 orphan modules, ~1,500 lines | Dead weight |
| 5 | The realtime stub is dead *and* its premise is obsolete | Dead weight + stale doc |
| 6 | 79 exported symbols nobody imports | Dead weight |
| 7 | 9 superseded pre-pagination service functions | Dead weight |
| 8 | 264 KB of unreferenced assets ship every deploy | Bundle waste |
| 9 | 13 database functions called only by pgTAP tests | Dead weight |
| 10 | Tooling catches unused imports but not unused exports or files | Root cause |

---

## 1. View counting is disconnected — and this corrects an earlier finding

The client code that records views is **orphaned**:

```
src/hooks/useImmediatePeekView.js      (59 lines)  -> imported by nothing
src/hooks/useMarketplaceView.js        (27 lines)  -> imported by nothing
  └─ src/services/marketplaceViewsService.js (28)  -> imported only by the orphan above
```

Those are the only callers of `record_public_tour_view` and `record_marketplace_view`. And those RPCs are
the only writers of the counters:

- `listings.views` / `services.views` are incremented **only** inside `record_marketplace_view`
  (`0077_real_marketplace_view_counting.sql`).
- `tour_view_events` is inserted **only** inside `record_public_tour_view`.
- No Edge Function, worker or trigger calls either.

So **view counts never increment for any real user**. The `views` figure shown on listing cards and in the
admin marketplace table is permanently whatever it was seeded as. The migration is named
`0077_real_marketplace_view_counting.sql` — the feature was built, then disconnected.

**This corrects the repository audit.** I previously reported "anonymous, unlimited view-count inflation"
as a High severity finding, describing these as live paths. The abuse surface is real — both RPCs are
still granted to `anon` and callable directly against PostgREST with the public key, `record_marketplace_view`
still has no dedup or rate limit, and its owner-exclusion is still bypassed by signing out. But there is no
live user flow behind them. The accurate statement is narrower and stranger: **the counter only moves if
someone attacks it.**

**Fix.** Decide whether view counting is wanted. If yes, wire `useMarketplaceView` into the detail pages
and `useImmediatePeekView` into the Peek player, and add the rate limiting from the repository audit at the
same time. If no, drop the hooks, the services and both RPCs, and stop displaying a `views` column that is
always zero.

## 2. Five maintenance jobs have no scheduler

These functions exist, are granted, and are exercised by the pgTAP suite — but nothing in any workflow,
script or `supabase/maintenance/` invokes them, and **`pg_cron` is not installed at all**:

| function | what does not happen |
|---|---|
| `expire_stale_peek_request_fulfilments` | stale Peek fulfilments are never expired |
| `prune_abuse_rate_limit_buckets` | rate-limit buckets are never pruned |
| `purge_recommendation_request_budget_v1` | request-budget rows accumulate forever |
| `retry_recommendation_projection_dead_letter` | projection dead letters are never retried |
| `recommendation_analytics_health_v1` | analytics health is never evaluated |

The first four are unbounded-growth risks on tables that only grow. The dead-letter one is worse in kind:
a failed recommendation projection stays failed, silently, with a retry mechanism sitting unused beside it.

`prune_abuse_rate_limit_buckets` is a special case — the repository audit found the abuse rate limiter
itself is never called, so its buckets are empty and there is nothing to prune. Two halves of one unused
subsystem.

**Fix.** The repository already runs scheduled workflows (`maintenance-workers.yml`,
`maintenance-workers-production.yml`). Adding these five to an existing schedule is the smallest change.
`pg_cron` would be the sturdier answer and would also fix the Web Push delivery cadence flagged earlier.

## 3. The disposable-email signup guard is disabled

`20260805110000_reject_disposable_signup_emails.sql` defines `public.before_user_created_hook`, backed by
the `disposable_email_domains` table. Both are complete and tested.

The hook is wired through Supabase auth configuration, and in `supabase/config.toml` that block is
**commented out**:

```toml
# [auth.hook.before_user_created]
# enabled = true
# uri = "pg-functions://postgres/auth/before-user-created-hook"
```

So the guard never runs, and `disposable_email_domains` is one of the dormant zero-reference tables found
earlier — it is the hook's data, orphaned with it.

**Fix.** Uncomment and point the URI at the real function, or delete the migration, the table and the hook
together. Right now the repository looks like it screens disposable signup addresses and does not.

## 4. Fifteen orphan modules, ~1,500 lines

Never reached from the entry graph. Verified individually — each has zero importers, not merely zero
matches:

| module | lines | why it is dead |
|---|---|---|
| `components/tours/TourCard.jsx` | 293 | `Tours.jsx` uses only `ImmersivePeekSlide` |
| `components/tours/ImmersivePeekCard.jsx` | 226 | superseded by `ImmersivePeekSlide` |
| `components/admin/AdminTourQueue.jsx` | 194 | `AdminPeeks.jsx` implements its own queue inline |
| `components/ui/use-toast.jsx` | 164 | shadcn toast stack, superseded by `sonner` |
| `domain/peekThreads/ranking.js` | 163 | siblings in the same folder are used; this one is not |
| `components/ui/toast.jsx` | 125 | shadcn toast stack |
| `hooks/useImmediatePeekView.js` | 59 | see finding 1 |
| `lib/traceContext.js` | 47 | request-tracing helper, never wired |
| `lib/noRealtimeClient.js` | 41 | see finding 5 |
| `components/ui/toaster.jsx` | 33 | shadcn toast stack |
| `components/tours/TourCategoryChips.jsx` | 35 | superseded tour catalogue UI |
| `components/tours/TourCatalogueHeader.jsx` | 34 | superseded tour catalogue UI |
| `services/marketplaceViewsService.js` | 28 | see finding 1 |
| `hooks/useMarketplaceView.js` | 27 | see finding 1 |
| `components/ui/slider.jsx` | 24 | never imported |

**~1,493 lines.** They fall into four coherent groups: the superseded tour catalogue UI (588 lines), the
shadcn toast stack replaced by `sonner` (322), the disconnected view-tracking path (114), and the rest.

`src/types/runtime-extensions.d.ts` also appears as an orphan and is **not** dead — it is an ambient
TypeScript declaration, never imported by design.

## 5. The realtime stub is dead and its premise is obsolete

`src/lib/noRealtimeClient.js` is a hand-written stub of `RealtimeClient`. Its header says:

> *"Aliased over `@supabase/realtime-js` in vite.config.js… Realtime is disabled for this project and no
> file in `src/` ever calls `supabase.channel(...)`… ~150 KB of dead weight in the initial bundle
> (measured; see docs/audit/AUDIT_SUMMARY.md, finding F-01)."*

Two things are now false:

1. **There is no such alias.** `vite.config.js` aliases only `'@' → ./src`. `git log -S"noRealtimeClient" --
   vite.config.js` returns no commit. The stub is not wired into anything.
2. **Realtime is genuinely used now.** Two components subscribe to `postgres_changes`:
   `ForegroundNotificationListener` (the notification stream) and `RealtimeConversationThread` (live chat).

So the file is dead, and its own advice — restore the alias — would now **break notifications and live
chat**, because its `channel()` throws by design.

**Fix. Delete it.** Do not restore the alias. The ~150 KB it was written to save is no longer available as a
saving: `@supabase/realtime-js` and its Phoenix websocket transport are in the critical-path chunk
(`BrandLogo-*.js`, 268 KB, 23 `realtime` and 33 `phoenix`/`websocket` string hits) because the application
now actually needs them.

This is worth knowing against the LCP finding in the product audit — that 150 KB is *not* recoverable
waste, it is a feature you shipped.

## 6. Seventy-nine exported symbols nobody imports

Across 631 consumer files — app, tests, scripts and Edge Functions:

| category | count | verdict |
|---|---|---|
| unused in app code **and** tests | **79** | genuinely dead |
| unused, but shadcn/ui sub-components | 29 | expected — upstream component surface, leave alone |
| referenced **only** by tests | 45 | tests asserting on code the app does not use |

The largest concentrations: `lib/constants.js` (9 dead exports, including the five already-known dead
constants), `services/listingTourContracts.js` (7), `services/adminService.js` (5 — the v1 category path and
`setAdminUserRole`), `lib/mapProvider.js` (4), `lib/marketConfig.js` (4).

The 45 test-only exports are worth a separate look. Several are real service functions — `getMessageInbox`,
`searchPublicListings`, `getLatestPublicListings` — which brings us to the next finding.

## 7. Nine superseded pre-pagination service functions

The service layer migrated to keyset pagination and left the originals behind. Thirteen `foo` / `fooPage`
pairs exist; **nine have zero app usage**:

```
getNotifications          -> getNotificationsPage
getOwnerListings          -> getOwnerListingsPage
getOwnerServices          -> getOwnerServicesPage
getPublicServices         -> getPublicServicesPage
getFavouriteServices      -> getFavouriteServicesPage
getFavouriteListings      -> getFavouriteListingsPage
getMessageInbox           -> getMessageInboxPage
searchPublicListings      -> searchPublicListingsPage
findPublicListings        -> findPublicListingsPage
```

Three of them (`getMessageInbox`, `searchPublicListings`, `getFavouriteListings`) are still exercised by the
test suite, so those tests are validating code paths the application abandoned — passing tests that prove
nothing about shipped behaviour.

**Fix.** Delete the nine and the tests that only cover them. The paginated variants are the live contract.

## 8. 264 KB of unreferenced assets ship on every deploy

Confirmed present in `dist/` after a real `npm run build`:

| asset | size | status |
|---|---|---|
| `brand/findit-icon-512.png` | 84 K | retired brand |
| `brand/findit-maskable-512.png` | 48 K | retired brand |
| `brand/findit-mark.png` | 32 K | retired brand |
| `brand/findit-icon-192.png` | 16 K | retired brand |
| `brand/findit-icon-180.png` | 16 K | retired brand |
| `brand/findit-icon-64.png`, `findit-icon-32.png` | 8 K | retired brand |
| `brand/peekalisting-icon-64.png` | 8 K | never referenced |
| `demo/listings/{blue-suv,bulldozer,city-apartment,property-maintenance}.svg` | 28 K | four of eight demo SVGs unused |
| `staging-release.{txt,json}` | 8 K | deploy artefacts |

The seven retired **FindIt** rasters are the bulk. Nothing in `src/`, `index.html`, the service worker, the
manifest or the Pages middleware references them, and `vite.config.js`'s
`copyFirstPartyPublicAssets` plugin copies everything in `public/` into the build unconditionally.

The manifest brand contract test already asserts *"install metadata must never reference a retired FindIt
raster"* — and it passes, because the manifest does not reference them. They just ship anyway.

**Fix.** Delete them. This is the single easiest 264 KB in the repository.

## 9. Thirteen database functions called only by pgTAP tests

No invocation in any function body, RLS policy, CHECK constraint, trigger, client call, Edge Function,
worker, script or workflow:

- **Five recommendation-admin functions** — `admin_upsert_recommendation_{relationship,taxonomy_node,weight_profile}`,
  `admin_upsert_recommendation_context_rule_v1`, `admin_recommendation_configuration_snapshot`. Confirms
  from the database side what the product audit found from the UI side: the recommendation engine has no
  admin surface.
- **Five maintenance jobs** — finding 2.
- `before_user_created_hook` — finding 3.
- `public_tour_view_counts` — part of the disconnected view path, finding 1.
- `get_recommendation_service_policy_v1` — superseded; the Edge runtime calls
  `recommendation_service_runtime_state_v1` instead.

**Every other one of the 340 database functions has a real caller.** That is the strongest result in this
audit and worth stating plainly: the SQL surface is fully wired.

## 10. The tooling catches unused imports but not unused exports or files

`eslint.config.js` configures `eslint-plugin-unused-imports` with
`"unused-imports/no-unused-imports": "error"` — so an unused *import* fails the build. Nothing checks for
unused *exports* or unreachable *files*, which is precisely the gap everything above sits in. The lint has
been green throughout.

Two smaller tooling notes:

- `eslint-plugin-react-refresh` is in `devDependencies` and is **not imported** by `eslint.config.js`.
  (`@types/node`, `@types/react`, `@types/react-dom` and `baseline-browser-mapping` also show as
  unreferenced but are consumed ambiently by `tsc` and browserslist — not findings.)
- **6 of 101 npm scripts** are unreferenced by any workflow *and* have no directly-invoked underlying file:
  `certify:recommendation-phase{1-local,2-local,2-hosted}`, `deploy:pages:staging`, `lint:fix`,
  `test:security-advisor-local`. Two of those are ordinary developer conveniences. The other 95 scripts are
  wired, directly or through their `.mjs`.

**Fix.** Add `knip` (or `ts-prune` plus a small orphan-file check) to the lint step. It would have caught
all of findings 4, 6 and 7 mechanically, and would keep catching them.

---

## Verified clean

- **Zero unused production dependencies** — all 23 are imported by application code.
- **Zero environment variables** declared in `.env.example` and never read.
- **Zero database functions with no caller anywhere** (after correcting for policies, constraints and
  grant statements).
- **95 of 101 npm scripts** are wired to CI or invoked through their underlying file.
- **334 of 341 modules** in `src/` are reachable from the entry point.

## Carried forward from earlier audits

These are dead-code findings already reported; they belong in the same cleanup and are listed so the total
is visible in one place:

- **16 of 18 feature flags gate zero code** (`payments`, `subscriptions`, `escrow`, `premiumListings`, four
  `ai*` flags, and eight more) — ~70 lines of configuration across `featureFlags.js`, `.env.example`, the
  staging workflow and `validate-env.mjs`.
- **7 dormant tables with zero client references**, plus two migrations named for them.
- **The shared abuse rate limiter** — a well-built token bucket that nothing calls.
- **The OAuth popup bridge** — ~150 lines unreachable because `noopener` in the `window.open` features
  string makes it return `null`.

## Suggested order

1. **Delete the 264 KB of retired assets.** Zero risk, immediate bundle win.
2. **Delete the 15 orphan modules and 79 unused exports**, including `noRealtimeClient.js`. Zero runtime
   risk — nothing imports them. Delete the tests that only cover the nine superseded pagination variants.
3. **Decide on view counting** (finding 1) — wire it up with rate limiting, or remove it and stop showing a
   column that is always zero.
4. **Schedule the five maintenance jobs** and enable or delete the signup hook.
5. **Add `knip` to lint** so this cannot silently reaccumulate.
6. Drop the 16 no-op feature flags.

Steps 1, 2 and 5 are mechanical and together remove roughly 1,500 lines and 264 KB. Steps 3 and 4 are
product and operational decisions.

---

## Method and limits

**Four first-pass results were wrong and were corrected before reporting** — worth recording, because each
would have been a confidently-stated false finding:

1. **"154 unused exports"** — I had scanned only `src/`, excluding the test suite. Including tests, scripts
   and Edge Functions (631 files) the real figure is 79, with 45 more that are test-only and 29 expected
   shadcn surface.
2. **"3 database functions with no caller"** — all three were false. `jsonb_values_are_http_urls` and
   `is_valid_localized_taxonomy_labels` are used in CHECK constraints; `can_support_peek_request` is used in
   RLS policies. My scan read function bodies and triggers only.
3. **"0 database functions with no caller"** — the correction to (2) then over-counted, because
   `grant execute on function public.foo(...)` matches a call pattern. Excluding `GRANT`/`REVOKE`/`COMMENT`
   lines and name-as-string verification blocks gives the real answer: 13 test-only, 0 uncalled.
4. **"51 of 101 npm scripts unused"** — most alias a `.mjs` that *is* invoked directly elsewhere. Checking
   the underlying file as well gives 6.

**Not covered.** Unused CSS was not measured — the codebase is Tailwind, where utility classes are composed
dynamically and a static scan produces mostly noise; a `PurgeCSS`-style build report would be the right
tool. Dead *branches* within live functions (unreachable conditionals, unused parameters) were not
analysed — this audit works at module, export and function granularity. Unused database *columns* were not
determined; that needs production query statistics (`pg_stat_statements`), not source analysis. And a
module reachable from the entry graph can still be effectively dead if the route that renders it is
unreachable — the route audit in `PRODUCT_AUDIT.md` found no such routes, but the two analyses were run
independently.
