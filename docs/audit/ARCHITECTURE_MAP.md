# Architecture Map

## Stack

| Layer | Technology |
|---|---|
| UI | React 18.2, JSX (no TypeScript source; type-checked via `checkJs`) |
| Build | Vite 6.1, `@vitejs/plugin-react` |
| Routing | react-router-dom 7.18 (`BrowserRouter`, `basename` from `BASE_URL`) |
| Server state | @tanstack/react-query 5.84 |
| Styling | Tailwind 3.4 + `tailwindcss-animate`, CSS variables, dark mode via `class` |
| Primitives | Radix UI (12 packages), `class-variance-authority`, `tailwind-merge` |
| Icons / toast | lucide-react, sonner + local toaster |
| Backend | Supabase — Postgres 17, Auth, Storage, Edge Functions (Deno 2) |
| Client SDK | @supabase/supabase-js 2.45 |

Node `>=20`. Package manager npm (`package-lock.json`, lockfileVersion 3).

## Entry points

| Path | Role |
|---|---|
| `index.html` | Shell; inlines a pre-paint theme script reading `localStorage.theme` |
| `src/main.jsx` | React root |
| `src/App.jsx` | Provider stack + the entire route table |
| `src/lib/supabaseClient.js` | **The only module that imports the Supabase SDK** |

Provider order in `App.jsx`:
`AuthProvider → CurrencyProvider → QueryClientProvider → Router → AuthenticatedApp`.

## Layering

The codebase enforces a strict one-way boundary:

```
pages / components
        ↓
   src/services/*        ← contracts, validation, mapping
        ↓
 src/repositories/*      ← the only callers of the Supabase client
        ↓
 src/lib/supabaseClient  ← sole SDK import site
```

`verify:source-graph` parses 323 modules and reports **0 unresolved local
imports**. `verify:base44-elimination` confirms no legacy Base44 SDK, caller,
export or browser configuration remains.

- 33 service modules — 16 paired `*Service.js` / `*Contracts.js`, so validation
  lives beside the call and is unit-testable without a backend.
- 16 repository modules, one per domain.
- 6 hooks: `useCursorStack`, `useDebouncedValue`, `useGuestGuard`,
  `useListingFavourite`, `useTimeAgo`, `useUnreadAlerts`.

## Source layout

| Directory | Files | Contents |
|---|---|---|
| `src/services` | 33 | Domain services + contracts |
| `src/pages` | 28 | Route components (22 public/user + 6 admin) |
| `src/components/ui` | 21 | Radix-based primitives |
| `src/lib` | 19 | Client, contexts, flags, nav config, utils |
| `src/repositories` | 16 | Supabase data access |
| `src/components/listings` | 16 | Listing cards, media viewer, edit, report |
| `src/components/tours` | 11 | Tours UI (feature-flagged) |
| `src/components/search` | 11 | Toolbar, filters, results |
| `src/components/create-listing` | 9 | Multi-step post flow |
| `src/components/layout` | 7 | `AppLayout`, `AdminLayout`, nav, footer |
| `src/components/admin` | 7 | Moderation queues, tables, health |
| others | ~20 | auth, business, dealers, discover, home, location, marketplace, messaging, profile, services, settings |

## Routing

42 route patterns. Three nested guard tiers plus a `*` fallback to `PageNotFound`:

1. **Unguarded** — `/login`, `/register`, `/forgot-password`, `/reset-password`.
2. **`AppLayout`, public** — `/`, `/search`, `/property/:id`, `/car/:id`,
   `/machinery/:id`, `/seller/:email`, `/services`, `/service/:id`, `/help`,
   `/help/contact`, `/legal/:document`, plus legacy redirects.
3. **`ProtectedRoute` + `AppLayout`** — `/post`, `/create-service`,
   `/my-services`, `/saved`, `/profile`, `/my-listings`, `/settings`,
   `/chats`, `/business-profiles`, `/notifications`.
4. **`ProtectedRoute requiredRole="admin"` + `AdminLayout`** — 6 `/admin/*` routes.

Every page is `React.lazy` + `Suspense`. Feature flags gate routes inline, so a
disabled feature has no reachable route at all rather than a broken screen.

## Supabase surface

- **44 migrations**, `0001`–`0044`, contiguous, verified by `verify:sql-boundary`.
- **15 rollback capsules** in `supabase/rollback/` covering `0030`–`0044`.
- **12 pgTAP suites** in `supabase/tests/`.
- **59 tables**, **125 indexes**, **116 `SECURITY DEFINER` functions**.
- **5 private storage buckets**: `listing-images`, `marketplace-images`,
  `tour-sources`, `tour-playback`, `tour-thumbnails`.
- **13 auth email templates** in `supabase/templates/`.

### Edge Functions (15)

| Function | `verify_jwt` | Trust model |
|---|---|---|
| `listing-image-upload` | true | User JWT + origin allowlist |
| `marketplace-image-upload` | true | User JWT + origin allowlist |
| `tour-upload-intent` | true | User JWT |
| `tour-upload-complete` | true | User JWT |
| `tour-admin-review-access` | true | JWT + admin `SECURITY DEFINER` check |
| `tour-feed` | false | Public; service-only RPC filters eligibility |
| `tour-playback-access` | false | Public; `SECURITY DEFINER` RPC gate |
| `tour-processing-callback` | false | Timestamped HMAC signature |
| `tour-processing-worker` | false | Worker secret, constant-time compare |
| `tour-lifecycle-cleanup` | false | Worker secret |
| `tour-cache-invalidation` | false | Worker secret |
| `tour-observability-monitor` | false | Worker secret |
| `essential-notification-fanout` | false | Worker secret |
| `listing-expiry-worker` | false | Worker secret, constant-time compare |
| `media-lifecycle-cleanup` | false | Worker secret, constant-time compare |

Shared helpers: `_shared/tour-runtime.ts` (limits, clients, CORS, auth,
correlation IDs), `_shared/tour-provider.ts`, `_shared/trusted-image.ts`.

`verify_jwt = false` is used only where the function performs its own stronger
check — a worker secret, an HMAC signature, or a `SECURITY DEFINER` eligibility
RPC. No function is unauthenticated.

## Feature flags

`src/lib/featureFlags.js` reads `VITE_*` at build time. 15 flags in 4 groups.

| Flag | Code default | `.env.example` |
|---|---|---|
| `businessProfiles` | true | true |
| `messaging` | **false** | true |
| `essentialNotifications` | **false** | true |
| `tours` | false | false |
| `toursPreview` | `DEV` | false |
| payments, subscriptions, escrow, premiumListings | false | false |
| 4 × AI flags | false | false |
| scheduledReminders, marketingEmails | false | false |

Tours additionally has a **server-side** switch, `TOURS_BACKEND_ENABLED`, read
by `_shared/tour-runtime.ts` and never `VITE_`-prefixed.
`scripts/validate-env.mjs` enforces the coupling: the browser flag cannot be
enabled unless the backend flag is. See F-11 for the default mismatch.

## Build and deployment

- `npm run build` = `vite build` + 3 gates (Base44 source, Base44 built
  boundary, performance budget). The budget gate currently fails — F-01.
- `base` is `VITE_BASE_PATH || '/'`, supporting GitHub Pages subpath hosting.
- 5 GitHub Actions workflows exist (`deploy-staging-pages`,
  `maintenance-workers`, `migration-gates`, `release-candidate-gates`,
  `tours-staging-acceptance`). `README.md` records that the account returns
  `startup_failure`, so these are unproven — see EXTERNAL_BLOCKERS.md.

## Environment variables

Browser (`VITE_`, all non-secret): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_GOOGLE_ENABLED`,
`VITE_AUTH_APPLE_ENABLED`, and 15 feature flags.

Server-only (Supabase secrets, never `VITE_`): `TOURS_BACKEND_ENABLED`,
`FINDIT_TOURS_RELEASE_ACCEPTED`, `FINDIT_TOURS_ACCEPTANCE_ID`,
`FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED`, `FINDIT_ALLOWED_ORIGINS`,
5 × `FINDIT_*_WORKER_SECRET`, `TOUR_PROCESSOR_URL`, `TOUR_PROCESSOR_SECRET`,
`TOUR_PROCESSING_CALLBACK_URL`, `TOUR_CACHE_PURGE_URL`,
`TOUR_CACHE_PURGE_SECRET`.

The split is documented in `.env.example` and `docs/ENVIRONMENT_VARIABLES.md`,
and the browser template correctly contains no privileged value.

## Missing-file check

All 40 script paths referenced by `package.json` resolve on disk. All local
imports resolve (323 modules). All `content_path` template files referenced by
`config.toml` exist. **No missing referenced files were found.**

## Documentation

15 files in `docs/`, plus ~45 root-level status and milestone reports. The root
set is largely historical narrative and is a hygiene concern rather than a
defect — see REMEDIATION_PLAN.md R-08. Three stray completion notes also sit
inside `src/` (`PHASE_1_4_COMPLETION.md`, `PHASE_1_6_COMPLETION.md`,
`VERIFICATION_FLOW_SUMMARY.md`), one of which still describes Base44
`asServiceRole` behaviour that no longer exists in the code.
