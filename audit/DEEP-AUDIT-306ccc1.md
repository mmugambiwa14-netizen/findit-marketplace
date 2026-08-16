# Deep audit — release/production-candidate @ 306ccc1

Date: 2026-08-16
Scope: client and admin surfaces — frontend, backend, database, edge functions, workers, CI.
Method: **repository only.** No calls were made against live Supabase, Cloudflare or Vercel.

Coverage: 341 source modules · 199 migrations · 30 edge functions · 24 workflows · 171 test files.

| Severity | Count |
|---|---|
| Critical | 4 |
| High | 3 |
| Medium | 8 |
| Cleanup | 8 |
| Prior findings now resolved | 8 |

---

## How the findings were produced

- Full import graph built from `src/main.jsx`, resolving `@/` aliases, relative paths, both quote styles and dynamic `import()`.
- Every exported symbol in `src/` cross-referenced against the entire tree including `tests/`, `scripts/`, `supabase/functions/` and `workers/`.
- All 30 edge functions mapped to their callers across `src/`, `workers/`, `.github/workflows/` and `supabase/config.toml`.
- Every internal `to=`, `href=` and `navigate()` target resolved against the route table in `App.jsx`.
- All 199 migrations swept for table creation vs. `enable row level security`, and every `SECURITY DEFINER` function checked for an authorization guard.
- The repository's own verifiers and its 945 contract tests were executed.

Two structural facts shaped nearly every finding below:

1. **The hygiene gate bans `TODO` / `FIXME` / `not implemented` in source.** There are zero such markers, but that is the gate working — not the code being finished. Incompleteness here surfaces as *modules nothing imports*, which no gate checks.
2. **149 of 171 test files assert on source code as text; only 33 import a real module.** Running the suite with `node_modules` absent gives 944/945 passing. A suite that goes green without the app's dependencies installed cannot notice that a component has been orphaned.

---

## Critical

### A-01 — The tip commit's hardening will never reach an existing database

`306ccc1` edits twenty already-applied migrations in place (`0013`, `0019`, `0021`, `0030`, `0100` and others), adding `service_role` execute grants and a new 53-RPC assertion directly into their historical text. Migrations are applied with `supabase db push`, which skips any version already recorded in `supabase_migrations.schema_migrations`. It matches on version, not on content.

Only one genuinely new migration ships in this commit (`20260815155600_recommendation_partition_rls_closure.sql`), and it covers the `recommendation_events` partitions alone — it restates none of the edited grants. Every other change in the commit applies to a freshly provisioned database and to nothing else. Production and staging keep the pre-commit grants while the repository, the tests and the release evidence all describe the hardened state.

The team has hit this before: `supabase/maintenance/` holds nineteen hand-written `reconcile_staging_migration_history_*.sql` ledger repairs. This commit adds none.

**Fix:** move every grant and assertion added to a historical file into a new timestamped migration that is idempotent on re-run, and revert the historical files to their applied text.

### A-02 — Admins approve and reject Peek videos without being able to watch them

`/admin/peeks` (`AdminPeeks.jsx`, 82 lines) renders metadata — status, duration, owner, report count — and two buttons, Approve and Reject. It never loads the video.

The playback path exists and is complete: `getAdminTourReviewAccess()` → `tour-admin-review-access` edge function → `admin_tour_review_metadata` RPC → signed storage URL. Its only consumer is `src/components/admin/AdminTourQueue.jsx` (193 lines), which **nothing imports**. It appears to be the previous moderation UI, replaced in a rewrite that dropped video review on the way.

The orphaned component also carried three actions the live page lacks: **suspend the seller**, **restore** and **remove** driven off the linked report.

A published Peek is user-uploaded video shown to the public. The only human check on it right now is a filename and a duration.

### A-03 — Two production workers are gated on switches unrelated to them

`maintenance-workers-production.yml` runs every worker inside one job whose `if:` requires at least one of four unrelated variables to be true (tours, recommendations, essential notifications, transactional email). Inside that job, `media-lifecycle-cleanup` and `listing-expiry-worker` are the only two with no switch of their own.

- All four off → orphaned-media cleanup silently stops; storage grows without bound with nothing reporting it.
- Any one on → listing expiry begins expiring listings, though production ships `VITE_FEATURE_LISTING_EXPIRY: "false"` and no UI explains an expired listing to its owner.

The staging workflow does not behave this way — there each worker is its own job with its own schedule condition. The same two workers behave differently in the two environments.

Separately, the production script is one `set -euo pipefail` block calling workers in sequence, each guarded by `test -n "$token"`. A single missing secret aborts the block and every worker after it in that schedule slot never fires — the same fail-closed cascade already fixed once in `release-candidate-gates.yml`.

### A-04 — Live Privacy Policy and Terms still contain fill-in-the-blank placeholders

`src/lib/legalContent.js` serves `/legal/privacy` and `/legal/terms` and ships seven `[TO BE COMPLETED]` markers: operator legal name, registered address, privacy contact address, retention periods, international transfer mechanism, subprocessor review, liability cap (lines 22, 105, 116, 197, 215, 292, 299).

The corpus also names the product "FindIt" throughout while production serves from `peekalisting.com` — the binding agreement identifies a product under a name the site no longer uses, on behalf of a company it does not name.

Previously logged as F-011 and F-001, both still `NOT-STARTED`.

---

## High

### A-05 — Two support inboxes, and one poisons the audit log view

Support requests have two complete, divergent admin implementations. `/admin/support` renders `AdminSupportRequests.jsx`. `/admin/reports` has a "Support requests" button that swaps the whole page for `SupportRequestInbox.jsx`.

- Different React Query keys (`['admin-support']` vs `['admin-support-requests']`), so resolving in one leaves the other stale.
- `SupportRequestInbox.jsx:41` invalidates `['admin-audit-log']` — a key no query uses. The audit log page queries `['admin-audit']` (`AdminAuditLog.jsx:31`). Every resolution done through the reports-page inbox writes an audit entry the audit log view will not show.
- No debounce on its search field, so each keystroke fires a fresh `admin_support_request_rows_page` RPC. The canonical page debounces at 300 ms.

**Fix:** delete `SupportRequestInbox.jsx`, point the reports-page button at `/admin/support`.

### A-06 — View counting is fully built on both sides and connected on neither

`record_marketplace_view` and `record_public_tour_view` exist, are granted to `anon` and `authenticated`, and are covered by migrations. `useMarketplaceView` + `marketplaceViewsService` and `useImmediatePeekView` exist to call them, complete with session dedupe, optimistic increment and rollback-on-failure.

No page mounts either hook. No component displays a view count. Every listing, service and Peek reads zero views forever — the database has been ready since migration `0077`.

### A-07 — Three quarters of the migrations skip the SQL gate

`verify-sql-boundary.mjs` selects files with `/^\d{4}_.+\.sql$/`. That matches `0001`–`0124` and misses every timestamp-named migration (`20260815155600_…` has no underscore in the fifth position).

75 of 199 migrations — including the only new migration in this commit — are never checked for sequence gaps, merge-conflict markers, null bytes, unbalanced dollar-quote delimiters, or a matching rollback capsule. 50 have no rollback capsule at all.

```
$ node ./scripts/verify-sql-boundary.mjs
SQL boundary verification passed: 124 contiguous migrations and 120 rollback capsules inspected.
$ ls supabase/migrations | wc -l
199
```

The gate is not failing. It passes on a subset and reports the subset's size.

---

## Medium

### A-08 — The bot-protection tier is fully written and never deployed

`verify-turnstile` is a complete edge function with origin allow-listing, hostname validation and constant-time secret handling. Cloudflare provisioning creates its secrets; a CI gate validates it. Nothing calls it — no Turnstile widget in `src/`, no `VITE_TURNSTILE_*` in `.env.example` or `validate-env.mjs`.

Its intended caller is `workers/edge/src/index.ts` (187 lines declaring R2 buckets, a Queue, a Durable Object rate limiter, KV, and `TURNSTILE_SECRET_KEY`). That worker is deployed by no workflow — the root `wrangler.jsonc` is a Pages config with `pages_build_output_dir` and no `main`.

Registration and contact-reveal are therefore unprotected against automated abuse. The contact-reveal cap is per-account while account creation is free, so scraping scales linearly with signups; Turnstile is the control meant to close that.

### A-09 — Managed listings is the one admin page built to different rules

`AdminManagedListings.jsx` diverges from every other admin page:

- `useState` + `useEffect` instead of React Query — no cache, no shared invalidation, refetch on every filter change.
- `listManagedListingRequests` takes no limit — fetches every request on each load.
- **Decline** is one-click destructive with no confirmation, while removing a listing elsewhere requires typing `REMOVE`.
- Nothing invalidates `['admin-audit']`, so the audit log does not refresh after a decision.
- Root element is `<div className="space-y-5">` with no padding; `AdminLayout`'s `<main>` supplies none either, so content sits flush against the viewport edge at every screen size.

### A-10 — Seventeen of twenty-seven feature flags are read by nothing

Most are deliberate placeholders (payments, escrow, AI stubs) and the file says so. Three are live switches that switch nothing:

- `reporting` — defaults `true`, set `"true"` in production, never read. Report buttons render unconditionally; there is no way to turn user reporting off during an incident.
- `manualLocation` — defaults `true`, never read.
- `listingExpiry` — `"false"` in production, never read, while the expiry worker is scheduled against production (A-03).

### A-11 — Staging-certified flags cannot be switched off on staging

`resolveStagingCertifiedFlag` returns `isTrustedStagingEnvironment(env) || readBooleanFlag(env, envVar, false)`. Where `VITE_DEPLOY_ENV` is `preview`/`staging` or the hostname is `staging.peekalisting.com`, the left side is true and the environment variable is ignored.

`VITE_FEATURE_MESSAGING=false` on staging does nothing. Same for essential notifications, tours and current-location. The sibling `resolveStagingProviderFlag` checks for an explicit `'false'` first, so the asymmetry looks unintended.

### A-12 — The test suite cannot see the class of defect this audit found

149/171 test files read source as text; 33 import a module. With `node_modules` absent: **944 of 945 tests pass**, the single failure being an unresolved `typescript` import.

A string-matching test cannot distinguish a component that renders from one nothing imports. `tourMilestone3SellerWorkflow.test.mjs` asserts on the text of `CreateService.jsx` and would pass identically if the page were unrouted. This is the root cause behind A-02, A-06 and most of the cleanup list. Previously logged as F-050, still `NOT-STARTED`.

### A-13 — Migration 0100 now hard-asserts an exact function count

```sql
if rpc_service_count <> 53 then
  raise exception '0100 expected 53 service-role authenticated RPC paths, found %', rpc_service_count;
end if;
```

Any future migration adding a `SECURITY DEFINER` function granted to `authenticated` — there are already 222 — makes a fresh provision fail at migration 100 of 199, pointing at a release-control file rather than at the migration that changed the count. Assert a floor or the specific set, not an exact total.

### A-14 — Sellers still cannot mark a listing sold

`sold` is a real status: `PropertyDetail` renders a "Sold" badge and the admin marketplace filter offers it. Nothing writes it. `MyListings` offers pause, resume, mark unavailable, delete, renew; admin moderation offers pause, publish, reject, remove.

A seller whose property sells must pick "Mark unavailable", which reads as withdrawn rather than transacted, and discards the marketplace's most valuable signal. Logged as F-029, still open.

### A-15 — No sitemap, and share previews depend on JS the scraper will not run

No `sitemap.xml` anywhere, no `Sitemap:` line in `robots.txt`. `robots.txt` also omits `/peek-requests` and `/settings` while covering the comparable `/saved` and `/profile`.

Per-route metadata has improved — `applyListingDocumentMetadata` sets `og:title` on all four detail pages — but it runs in the browser after hydration behind a `/* → /index.html 200` rewrite. Social scrapers and non-JS crawlers still receive the same empty shell for every listing.

---

## Dead code and leftover files

1,478 lines with no path from `src/main.jsx`:

| Module | Lines | Why it is dead |
|---|---:|---|
| `components/tours/TourCard.jsx` | 292 | Grid catalogue, superseded by `ImmersivePeekSlide` |
| `components/tours/ImmersivePeekCard.jsx` | 225 | Same rewrite |
| `components/admin/AdminTourQueue.jsx` | 193 | Replaced by `AdminPeeks` — took video review with it (A-02) |
| `domain/peekThreads/ranking.js` | 162 | Demand scoring, seller priority, responsiveness — never called |
| `hooks/useImmediatePeekView.js` | 58 | Peek view counting (A-06) |
| `lib/traceContext.js` | 46 | Tracing infrastructure, no consumers |
| `lib/noRealtimeClient.js` | 40 | Stub for a reverted realtime removal; no Vite alias points at it |
| `components/tours/TourCategoryChips.jsx` | 34 | Old catalogue chrome |
| `components/tours/TourCatalogueHeader.jsx` | 33 | Old catalogue chrome |
| `components/ui/toaster` · `toast` · `use-toast` | 87 | shadcn toasts; `sonner` is used in 42 files |
| `services/marketplaceViewsService.js` | 27 | Only importer is the dead hook |
| `hooks/useMarketplaceView.js` | 26 | Listing view counting (A-06) |
| `components/ui/slider.jsx` | 23 | Radix wrapper, unused |

Dead service and configuration surface:

- `adminService.getAdminCategories` / `addAdminCategory` / `updateAdminCategory` — a complete parallel category API superseded by `taxonomyAdminService`. The `admin_category_rows`, `admin_add_category` and `admin_update_category` RPCs still exist in the database, still guarded, now unreachable from the app.
- `adminService.setAdminUserRole` — role delegation was removed in migration `0030`; the client function and its `admin_set_user_role` repository call remain.
- `adminService.getAdminTourReviewMetadata` — a second unused route into the same review metadata as A-02.
- `ADMIN_NAV_ITEMS` carries `countKey: 'reports'`; `AdminSidebarCollapsible` never reads `countKey`, so the pending-reports badge does not exist.
- `public/staging-release.txt` / `.json` are copied into the production bundle by the Vite asset plugin, referenced by nothing, and still read *"FindIt staging release · Canonical source: main · Release generated: 2026-08-06"*. Publicly fetchable on the production domain.
- `preview-assets/mock/` is 7 MB — a third of the repository — for local preview fixtures. Already logged as F-009.

Not dead, despite appearances: `src/pages/CreateService.jsx` is wrapped by `CuratedCreateService`. Every `ui/` re-export flagged as unused is a Radix passthrough and should stay.

---

## Prior audit, re-verified at this commit

The `audit/` directory holds 92 findings from an earlier pass, 50 still `NOT-STARTED`. Re-tested:

| ID | Finding | Now |
|---|---|---|
| F-003 | Public Peeks gated off in every production path | Resolved — `VITE_FEATURE_TOURS: "true"` |
| F-089 | `supabaseClient.js` pins a staging connection in source | Resolved — no fallbacks remain |
| F-031 | Messaging has no realtime and no refetch on focus | Resolved — `RealtimeConversationThread` |
| F-019 | Category schema registry unreachable | Resolved — wired into `ListingDetailsStep` |
| F-020 | `listings.attributes` never written | Resolved — `p_attributes` |
| F-015 | `camera=()` may break Peek capture | Not a defect — capture uses `<input capture="environment">`, not `getUserMedia` |
| F-058 · F-064 | `traceContext.js` touches `sessionStorage` directly | Moot — the module is now dead |
| F-043 | No per-route metadata or OG tags | Partial — client-side only, no prerender (A-15) |
| F-011 · F-001 | Legal placeholders and FindIt branding | Still open (A-04) |
| F-034 · F-055 | Turnstile and Cloudflare edge tier undeployed | Still open (A-08) |
| F-050 | Tests assert on source strings, not behaviour | Still open (A-12) |
| F-029 | Sellers cannot mark a listing sold | Still open (A-14) |
| F-044 | No sitemap.xml | Still open (A-15) |
| F-056 | Migrations without a rollback script | Worse — now 50 (A-07) |

---

## What holds up

- **Admin authorization is enforced in the database, not the browser.** Every `admin_*` RPC guards through `is_admin()` directly or via `require_admin_reason()`, which raises `42501` before doing anything. `ProtectedRoute` additionally re-verifies the role against Postgres on each mount rather than trusting React state, and distinguishes a provider failure from a denial.
- **Nothing sensitive reaches the bundle.** Only `VITE_SUPABASE_ANON_KEY` and public map keys are read from `import.meta.env`. No service-role key, no `dangerouslySetInnerHTML` in 341 modules, source maps off, build-time secret scan gating the artifact.
- **The CSP is genuinely strict.** `script-src 'self'` with no `unsafe-inline`, `object-src 'none'`, `frame-ancestors 'none'`, two-year HSTS preload.
- **RLS coverage is complete.** 100 of 102 tables enable row-level security; the rest are service-role-only by design with no user-reachable grants. The tip commit's partition closure correctly walks `pg_partition_tree` rather than assuming partition names.
- **Destructive admin actions are hard to do by accident.** Remove, reject, suspend and ban each require a typed confirmation string plus a reason of at least three characters, and write an immutable audit row with a correlation ID.
- **Routing is clean.** Every internal `to=`, `href=` and `navigate()` target resolves to a declared route, and every declared route has a component.
- **Loading, error and empty states are near-universal.** 36 of 40 pages handle all three; the four that do not delegate entirely to children that do.
- **Admin list views are correctly paginated** — cursor keyset pagination with a back-stack across every admin table but one.

---

## Suggested order

Ordered by what blocks a safe production release, not by effort.

1. **Re-issue the tip commit's hardening as a new migration** (A-01). Until this is done, the release candidate's central claim is untrue of every database that exists, and everything below assumes a database that matches the repository.
2. **Restore video review to `/admin/peeks`** (A-02). Service, edge function and RPC are all live; port the review dialog out of `AdminTourQueue.jsx`, bring the suspend-seller and report-linked actions with it, delete the orphan.
3. **Give `media-lifecycle-cleanup` and `listing-expiry-worker` their own switches** (A-03), split into their own jobs to match staging.
4. **Fill in the legal corpus and settle the product name** (A-04). Needs a decision, not a code change.
5. **Delete `SupportRequestInbox.jsx`** (A-05). One deletion fixes the duplicate surface, the broken audit-log invalidation and the un-debounced RPC.
6. **Widen the SQL gate's file pattern** (A-07). A one-line regex change puts 75 migrations back under the same checks and immediately surfaces the 50 missing rollback capsules.
7. **Wire up view counting, or remove it** (A-06). Mounting both hooks on the four detail pages is an afternoon; shipping zeroes indefinitely is the worst of the three options.
8. **Add behavioural tests for reachability** (A-12). Not a rewrite of 171 files — one test that walks the import graph from `main.jsx` and fails on an unreferenced module under `src/` would have caught six of the findings above.

---

## Outstanding

This audit is repository-only. The code-versus-deployed-state comparison — real RLS policies, live table grants, deployed edge functions, actual Cloudflare Workers — was never authorised and has not been done. Given A-01, that comparison is now the highest-value next step: it is the only way to confirm what the production database's grants actually are.
