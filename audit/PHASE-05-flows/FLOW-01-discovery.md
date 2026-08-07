# FLOW-01 — Discovery (first visit → category/search → card → detail)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/` → `src/pages/Home.jsx` (public, `App.jsx:161`) → `src/components/discover/*` → `publicListingsRepository.findLatestAvailableListings(kind, limit)` (`:68-78`) → RPC/PostgREST against the 35-column public allowlist (`0049:253-287`) → `MarketplaceCard` / `ListingCard` → `/property/:id` | `/car/:id` | `/machinery/:id`.

Category counts come from `public.discover_category_counts`, granted to `anon` (Phase 3 §3.7).

## Assessment
| Aspect | State |
|---|---|
| Public reachability | PASS — `/`, `/search` and all three detail routes are public (`App.jsx:161-165`) |
| Projection safety | PASS — anon sees only the 35-column allowlist; contacts revoked (`0109`), exact coordinates never granted |
| Bounded reads | PASS — `findLatestAvailableListings` takes an explicit `limit` |
| Loading / empty / error | Route-level `Suspense` (`App.jsx:154`) + `AppErrorBoundary` above the router (`main.jsx:43`) |
| Offline | `public/offline.html` shell + service worker (177 lines) |

## Gaps
- **F-003** — with `VITE_FEATURE_TOURS` false the `/peek` entry point does not exist, so the Public Peek rail (`HomePeekRail.jsx`) has no destination in production.
- **F-017** — install prompt is offered but the manifest has no usable iOS/Android raster icon.
- Freshness: `staleTime` 30 min with `refetchOnWindowFocus:false` (`query-client.js:6-11`) means the home rail can show sold or withdrawn listings for up to 30 minutes. Carried to Phase 10.
