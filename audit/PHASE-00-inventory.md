# PHASE 00 — RECON & INVENTORY

**Product:** PeekaListing (PaL)
**Repository:** `mmugambiwa14-netizen/findit-marketplace`
**Audited ref:** `origin/main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`
("Merge pull request #32 from …/integration/final-release-certification")
**Audit date:** 2026-08-07
**Evidence tiers used:** Static (repo) ✅ · Local execution ✅ · Live read-only (MCP) ⛔ BLOCKED — see `EXTERNAL-EVIDENCE.md` E-000

> This phase reports facts, not remediation opinions. Findings are recorded in `findings.csv`.

---

## 0.1 Audit environment correction (recorded before any analysis)

The session container was checked out at `b0b85c7`, **151 commits behind `origin/main`** and a strict
ancestor of it (0 commits ahead — no unmerged work). The stale tree was missing whole subsystems the
audit must cover:

| Missing from the checked-out tree | Present on `origin/main` |
|---|---|
| `workers/edge`, `workers/media` | Cloudflare edge Worker + media processing container |
| `infrastructure/cloudflare/` | provisioning script, `wrangler.toml.example`, env example |
| 11 migrations | incl. `20260807030000_remove_listing_content_review_from_mvp.sql` |
| 11 workflows | journey certification gates, security behaviour gates |
| `tests/security/` (7 suites) | admin authz, contact reveal, listing submission, injection boundaries |

The audit branch was reset onto `origin/main` (`git checkout -B claude/peekalisting-audit-ui0z6l origin/main`)
before Phase 0 analysis began. **All findings in this audit refer to `ee6f212`.**

## 0.2 Repository scale

| Metric | Count |
|---|---|
| Tracked files | 1,155 |
| `src/` files | 326 (~32k LOC) |
| Pages | 40 (30 app + 10 admin) |
| Routes declared (`src/App.jsx`) | 48 |
| Supabase migrations | 159 |
| Supabase rollback scripts | 101 |
| Edge Functions | 30 |
| pgTAP suites (`supabase/tests`) | 53 |
| Node test files (`tests/`) | 141 |
| Scripts | 77 |
| GitHub workflows | 18 |
| Remote branches | 39 |
| Root-level markdown docs | 39 |

## 0.3 Branch inventory & delta classification

`main` is treated as the sole source of truth. Delta measured as ahead/behind `origin/main`.

### Unreconciled branch deltas (unique work outside `main` — decision required)

| Branch | Ahead | Behind | Last commit | Classification |
|---|---:|---:|---|---|
| `develop` | 434 | 155 | 2026-08-06 | **UNRECONCILED BRANCH DELTA — largest.** Not current architecture. Requires explicit reconcile/defer decision. |
| `claude/repo-code-review-fu5wgc` | 403 | 201 | 2026-08-05 | UNRECONCILED — review-era work, superseded? |
| `continuation/contract-gate-repair` | 382 | 201 | 2026-08-05 | UNRECONCILED |
| `feature/peek-threads-phase-3` | 156 | 201 | 2026-08-04 | UNRECONCILED — Peek Threads phase 3; **also listed as a trusted staging branch** (§0.7) |
| `claude/findit-hardening-listing-012cf0` | 68 | 201 | 2026-08-04 | UNRECONCILED — **also a trusted staging branch** |
| `integration/peek-fulfilment-journey-certification` | 15 | 49 | 2026-08-07 | **Most recent unmerged work** (same day as `main` HEAD) |
| `preview/integration` | 13 | 155 | 2026-08-06 | UNRECONCILED |
| `feature/contextual-permissions` | 12 | 201 | 2026-08-04 | UNRECONCILED — **also a trusted staging branch**. Contextual camera-permission work. |
| `claude/base-rpc-boundary-repair` | 12 | 195 | 2026-08-06 | UNRECONCILED |
| `brand/peekalisting-binoculars` | 11 | 195 | 2026-08-06 | UNRECONCILED — brand work; relevant to F-001 |
| `continuation/release-certification-ci` | 10 | 201 | 2026-08-04 | UNRECONCILED — **also a trusted staging branch** |
| `backup/main-pre-production-promotion-2026-08-05` | 9 | 201 | 2026-07-29 | Backup snapshot; 9 unique commits are unexplained |
| `release/production-readiness-2026-08-05` | 5 | 195 | 2026-08-05 | Release branch with unmerged commits |

### Fully merged — branch noise (0 ahead, safe to delete)

`integration/verified-business-journey-certification`, `integration/security-boundary-tests-2`,
`integration/safety-operations-journey-certification`, `integration/mfa-auth-reconciliation`,
`integration/listing-publication-journey-certification`, `integration/input-and-url-security-tests`,
`integration/final-security-certification-gates`, `integration/final-release-certification`,
`integration/develop-security-reconciliation`, `integration/critical-high-infrastructure`,
`integration/cloudflare-provisioning`, `integration/buyer-journey-certification`,
`integration/behaviour-security-tests`, `feature/listing-intelligence-foundation`,
`feature/curated-business-marketplace`, `claude/peekalisting-handoff-vklm8s` — **16 branches**.

`docs/certification/BRANCH_CLEANUP_LEDGER.md` exists as a cleanup ledger (content reconciliation deferred to Phase 15).

### Dependabot (7)
4 npm (`tailwindcss-4.3.3`, `multi-d8ec5a502f`, `eslint-plugin-react-hooks-7.1.1`, `date-fns-4.4.0`) each 3 ahead;
3 github_actions each 1 ahead. `actions/checkout-7` is 1 ahead / **0 behind**.

## 0.4 Package & runtime

**Engine mismatch (recorded as F-005).** `package.json` declares `"node": ">=23.6.0"`; audit environment runs
**Node v22.22.2**. `npm ci` completed with `npm warn EBADENGINE`. Several scripts rely on
`--experimental-strip-types`, whose behaviour differs across 22/23.

**Dependency classification** (runtime deps, by importing-file count in `src/`):

| Bucket | Packages |
|---|---|
| Core (>40 files) | `react` (160), `lucide-react` (144), `react-router-dom` (74), `@tanstack/react-query` (59), `sonner` (47) |
| Moderate | `class-variance-authority` (5), `react-dom` (2), `@radix-ui/react-dialog` (2) |
| Single-entry (by design) | `@supabase/supabase-js` (1 — single client entry `src/lib/supabaseClient.js`, good isolation), `clsx`, `tailwind-merge`, `date-fns` |
| Radix primitives, 1 file each | `alert-dialog`, `checkbox`, `dropdown-menu`, `label`, `popover`, `select`, `separator`, `slider`, `slot`, `switch`, `tabs` — each wrapped once in `src/components/ui/` (correct shadcn pattern, **not** unused) |
| Config-only | `tailwindcss-animate` (0 `src` imports; consumed by `tailwind.config.js` — **not** dead) |

No unused or duplicated runtime dependencies detected. Lockfile `package-lock.json` present and committed (250 KB).

**Script inventory:** 77 scripts. Legacy product-semantics naming persists in **21** npm scripts
(`test:tours-*`, `run:tours-processor`, `certify:release-candidate` → `tours-release-certification.mjs`).
Names no longer match product vocabulary (Peeks) — classified harmless-historical, recorded as F-007.

## 0.5 Route table (`src/App.jsx`)

| Route | Component | Access | Gate | Notes |
|---|---|---|---|---|
| `/login` `/register` `/forgot-password` `/reset-password` | Login/Register/ForgotPassword/ResetPassword | Public | — | `/reset-password` is **exempt from the MFA gate** (`App.jsx:146-151`) |
| `/` | Home | Public | — | |
| `/search` | Search | Public | — | |
| `/property/:id` | PropertyDetail | Public | — | |
| `/car/:id` | CarDetail | Public | — | |
| `/machinery/:id` | MachineryDetail | Public | — | |
| `/seller/:sellerId` | SellerProfile | Public | — | |
| `/business/:id`, `/dealer/:id` | PublicBusinessProfile | Public | `businessProfiles` (default **true**) | Two paths → one component |
| `/services` `/service/:id` | Services / ServiceDetail | Public | — | |
| `/peek` | Tours \| ToursPlaceholder | Public | `tours \|\| toursPreview` | **Route does not exist when both flags are false** — see F-003 |
| `/tours` | → `/peek` | Public | `tours \|\| toursPreview` | Legacy redirect |
| `/help` `/help/contact` `/legal` `/legal/:document` | FAQs/ContactSupport/LegalPage | Public | — | |
| `/faqs` `/support` | → `/help` | Public | — | Legacy redirects |
| `/create` | → `/post` | Public | — | Legacy redirect |
| `/messages`, `/messages/:conversationId` | → `/chats` | Public | `messaging` | Legacy redirects |
| `/post` | CreateListing | **Auth** | — | |
| `/create-service` | CuratedCreateService | **Auth** | — | `CreateService.jsx` (441 LOC) is the *non-curated* variant — routing check in Phase 5 |
| `/my-services` `/saved` `/profile` `/my-listings` `/settings` | — | **Auth** | — | |
| `/peek-requests` | BuyerPeekRequests | **Auth** | — | **Buyer** side only; no top-level seller fulfilment route (Phase 5 FLOW-09) |
| `/chats` `/chats/:conversationId` | Inquiries | **Auth** | `messaging` | |
| `/business-profiles` | BusinessProfiles | **Auth** | `businessProfiles` | |
| `/notifications` | NotificationCenter | **Auth** | `essentialNotifications` | |
| `/admin` `/admin/listings` `/admin/peeks` `/admin/users` `/admin/reports` `/admin/support` `/admin/categories` `/admin/business-applications` `/admin/managed-listings` `/admin/audit-log` | 10 admin pages | **Admin** | `requiredRole="admin"` | Server-rechecked via `authService.hasRequiredRole` (`ProtectedRoute.jsx:60`) |
| `*` | PageNotFound | Public | — | |

**Deep-link safety:** all routes are `BrowserRouter` paths requiring SPA rewrite; `vercel.json` behaviour verified in Phase 1.

## 0.6 Access-control wrappers (inventory only; audited in Phase 4)

- `src/components/ProtectedRoute.jsx:37-74` — re-verifies role **server-side** via
  `authService.hasRequiredRole(requiredRole)` rather than trusting React state, and **fails closed**:
  provider/network error renders a distinct "could not verify" state (`:88-104`) instead of granting access.
  Recorded as a strength.
- `src/App.jsx:115-132` `useMfaGate` — client-side MFA challenge gate; recovery route exempted at `:146`.
  Server-side AAL enforcement is a Phase 4 determination.

## 0.7 Feature flags & staging trust policy

`src/lib/featureFlags.js` — 26 flags. Defaults that matter:

| Flag | Default | Effect if false |
|---|---|---|
| `businessProfiles` | **true** | — |
| `manualLocation` | **true** | — |
| `reporting` | **true** | — |
| `tours` | `stagingCertifiedFlag` → **false** off trusted staging | `/peek` route absent — see F-003 |
| `messaging` | `stagingCertifiedFlag` → **false**; `.env.example:16` sets `true` | `/chats` absent |
| `essentialNotifications` | `stagingCertifiedFlag` → **false**; `.env.example:17` sets `true` | `/notifications` absent |
| `currentLocation` | `stagingCertifiedFlag` → **false** | — |

### F-003 evidence — Peek release gating

Peeks are **deliberately** disabled outside staging, not accidentally fail-closed:

- `.env.example:40` — `VITE_FEATURE_TOURS=false`
- `docs/ENVIRONMENT_VARIABLES.md:27` — "`VITE_FEATURE_TOURS` | Peek UI | **True only for an accepted Peek release**"
- `docs/TOURS_RELEASE_ACCEPTANCE.md:13` — "`VITE_FEATURE_TOURS=true`, `TOURS_BACKEND_ENABLED=true` **in staging only**"
- `.github/workflows/deploy-staging-pages.yml:62` — staging reads repo variable `vars.FINDIT_STAGING_TOURS_ENABLED`
- `pages-preview.yml:63`, `release-candidate-gates.yml:52`, `tours-staging-acceptance.yml:65` — set `"true"` for **CI/preview only**

No workflow, config file or documented production path sets `VITE_FEATURE_TOURS=true` for
`peekalisting.com`. `messaging` and `essentialNotifications` are set `true` in `.env.example`, so those are
expected to be live; **Peeks are not**. The consequence is scope, not breakage: a product whose identity is
Public Peeks and Peek Requests would launch without them until Peek release acceptance is completed and
evidenced. Recorded P1 because it gates the launch definition, with the remedy being release acceptance
rather than a code fix.
| `payments` `subscriptions` `escrow` `premiumListings` | **false** | MVP-excluded; see Phase 7 |
| `aiContentModeration` `aiBanEvasionDetection` `aiTicketTriage` `aiSupportChat` | **false** | — |

`src/lib/stagingCapabilityPolicy.js:1-45` grants these capabilities automatically when
`isTrustedStagingEnvironment()` is true, which is satisfied by **either**:
1. `VITE_VERCEL_GIT_COMMIT_REF` ∈ `TRUSTED_STAGING_BRANCHES` (`:1-7`), or
2. `globalThis.location.hostname` starting `findit-marketplace-stagi` and ending `.vercel.app` (`:21-25`).

Four of the five trusted branches are stale relative to `main` (§0.3). Recorded as F-004 / F-006.

**Preview auth bypass — verified safe.** `src/lib/localPreview.js:29-37` requires *all* of:
`featureFlags.toursPreview`, `import.meta.env.DEV === true` (`:14`), `VITE_PREVIEW_AUTH_BYPASS === 'true'`,
**and** a private/loopback Supabase host (`:5-11`). `DEV` is false in production builds. Not exploitable in
a deployed bundle. `scripts/validate-env.mjs:194` additionally rejects any non-`false` value in production.
**Not a finding.**

## 0.8 Environment variable map

**Browser (`VITE_`) — 38 referenced in `src/`.** All 34 product flags/keys are declared in `.env.example`.

| Variable | Client/server | Declared in `.env.example` | Validator | Notes |
|---|---|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client | ✅ | `scripts/validate-env.mjs:37-52` (required, placeholder + protocol checked) | |
| `VITE_WEB_PUSH_PUBLIC_KEY` | client | ❌ **missing** | none | Used in `src/`; undocumented — F-008 |
| `VITE_VERCEL_ENV`, `VITE_VERCEL_TARGET_ENV`, `VITE_VERCEL_GIT_COMMIT_REF` | client | ❌ (Vercel-injected) | none | Expected absence; `GIT_COMMIT_REF` drives the staging trust decision (§0.7) |
| 26 `VITE_FEATURE_*` / `VITE_AUTH_*` / `VITE_PREVIEW_*` | client | ✅ | `validate-env.mjs:53-60` enforces exact `true`/`false` | |
| `VITE_MAPTILER_PUBLIC_KEY`, `VITE_MAPTILER_STYLE_ID` | client | ✅ | — | Public by design |

**Server-side (Deno / Workers) — 25 variables**, none reachable from browser code:
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY(S)`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_ORIGINS`, `TURNSTILE_ALLOWED_HOSTNAMES`,
`WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_SUBJECT`, `PUSH_DISPATCH_TOKEN`,
`TOUR_PROCESSOR_URL/SECRET`, `TOUR_PROCESSING_CALLBACK_URL`, `TOUR_CACHE_PURGE_URL/SECRET`,
`TOURS_BACKEND_ENABLED`, `FINDIT_ALLOWED_ORIGINS`, `FINDIT_REQUEST_BUDGET_SALT`,
`FINDIT_*_WORKER_SECRET` (listing-expiry, media-cleanup, recommendation), `FINDIT_*_HEALTH_SECRET`.

**Service-role isolation — PASS at source level.** `SERVICE_ROLE` occurrences: `src/` **0**,
`supabase/functions/` 11 files, `workers/` 1 file. Bundle-level confirmation in Phase 1.

`scripts/validate-env.mjs:71-120` enforces a genuine cross-variable dependency graph (browser Tour access
requires `TOURS_BACKEND_ENABLED`, which requires workers enabled, a processor mode, and three worker secrets).
Recorded as a strength.

## 0.9 Supabase object inventory (from 159 migrations)

| Object | Count |
|---|---|
| Tables (distinct) | **100** |
| `enable row level security` statements | 104 |
| Policies | 224 |
| Functions (distinct) | **295** |
| `security definer` occurrences | **356** |
| Triggers | 96 |
| Indexes | 237 |
| Enum/composite types | 62 |
| Views | 46 |
| Storage buckets (explicit inserts) | 4 statements; `tour-playback` (private, 250 MB, `video/mp4`) and `tour-thumbnails` (private, 5 MB, `image/webp`) confirmed private |

Bucket ids referenced across `src/` + `supabase/`: `tours` (33), `marketplace-images` (29),
`listing-images` (17), `verification` (1).

### Tables outside the stated MVP boundary (Phase 7 / Phase 2 follow-up)

Monetisation: `payments`, `escrow_transactions`, `subscriptions`, `practitioner_payouts`.
Reputation: `reviews`, `seller_ratings`, `practitioner_reviews`.
Social: `follows`.
A **complete legal-practitioner vertical** absent from the stated taxonomy: `legal_practitioners`,
`legal_specializations`, `legal_bookings`.
Plus `service_bookings`, `service_disputes`, `announcements`.

Per the MVP rules these are audited as dead-code/security surface, **not** as work to complete.
Each still requires RLS verification in Phase 3 — a dormant table with a permissive policy is still reachable.

## 0.10 Infrastructure evidence (repository-defined ≠ provisioned)

| Component | Repository evidence | External state |
|---|---|---|
| Cloudflare edge Worker | `workers/edge/src/index.ts:1-13` declares `Env` with `LIGHTWEIGHT_JOBS` (Queue), `PLATFORM_CONFIG` (KV), `RATE_LIMITS` (Durable Object), `PEEK_SOURCE_MEDIA` / `PEEK_DERIVATIVE_MEDIA` / `LISTING_MEDIA` (3 R2 buckets), `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY` | **UNVERIFIED** (E-001) |
| Media processing worker | `workers/media/Dockerfile`, `README.md` | **UNVERIFIED** (E-002) |
| Cloudflare provisioning | `infrastructure/cloudflare/provision-staging.sh`, `wrangler.toml.example`, `cloudflare.env.example` — all `.example`, no committed `wrangler.toml` | **UNVERIFIED** (E-001) |
| Vercel | `vercel.json` (3.0 KB) | **UNVERIFIED** (E-003) |
| Supabase staging/production | `supabase/config.toml`, 159 migrations, 101 rollbacks | **UNVERIFIED** (E-004) |
| Turnstile | `supabase/functions/verify-turnstile/index.ts` | **UNVERIFIED** (E-005) |
| GitHub Actions | 18 workflows | Partially verifiable — Phase 15 |
| `peekalisting.com` | No DNS/domain config in repo | **UNVERIFIED** (E-006) |

**No R2 bucket, Queue, KV namespace, Durable Object, Worker deployment or Vercel project state is proven by
this repository.** Live verification was attempted and blocked (E-000).

## 0.11 Legacy residue classification

| Residue | Locations | Classification |
|---|---|---|
| **Base44** | 13 occurrences in `src/`, **all inside comments** (`listingMappers.js:31`, `authService.js:3`, `AuthContext.jsx:3,10,29,78,118,122,126`, `ForgotPassword.jsx:22`, `ResetPassword.jsx:11,13`, `Register.jsx:17`) | **Harmless historical.** Zero runtime Base44 code, SDK, or API URL. Build gate `scripts/verify-base44-elimination.mjs` runs on every `npm run build`. **PASS.** |
| **FindIt — customer-facing** | **111 occurrences across ~60 files** including the entire legal corpus | **ACTIVE DEFECT — F-001** |
| **FindIt — internal tokens** | `--findit-*` CSS custom properties (`src/components/ui/button.jsx:8-23`), `__findit_visit_count` / `__findit_ios_install_dismissed_at` localStorage keys (`InstallPrompt.jsx:27-28`), `deleteFindItCaches()` (`serviceWorker.js:32`) | **Harmless historical / deliberate compatibility.** The cache deleter is *required* to retire legacy caches. |
| **FindIt — server env prefix** | `FINDIT_*` worker secrets (10 vars) | Harmless historical; renaming would require coordinated secret rotation |
| **Tours → Peeks** | 75 `src/` files; `src/components/tours/` + `src/domain/peekThreads/` coexist; 13 `supabase/functions/tour-*`; 21 npm scripts | **Compatibility cleanup.** Semantics traced in Phase 5; names deliberately not changed. |
| Preview asset | `preview-assets/mock/findit-tour-preview.mp4` (6.5 MB tracked binary) | Debt — F-009 |

## 0.12 Component inventory

**Files >300 LOC (13):** `ListingMediaViewer.jsx` (554), `constants.js` (551), `listingToursService.js` (470),
`CreateService.jsx` (441), `legalContent.js` (404), `ImmersivePeekSlide.jsx` (394), `property.js` (381),
`MyListings.jsx` (380), `ListingRecommendations.jsx` (359), `Search.jsx` (332), `CreateListing.jsx` (305),
`DiscoverMapView.jsx` (305), `machinery.js` (303).

No god components: the largest is 554 LOC and the codebase shows clean
`domain → repository → service → page` layering. No >8-responsibility component identified.

**Orphaned component files (5), all Peek/Tour-era:** `AdminTourQueue.jsx`, `ImmersivePeekCard.jsx`,
`TourCard.jsx`, `TourCatalogueHeader.jsx`, `TourCategoryChips.jsx` — F-010.

⚠️ **Important correction:** `AdminTourQueue.jsx` is a dead *component file*, but the functionality is **live**
via `src/pages/admin/AdminPeeks.jsx:17,44` → `getAdminTourQueue` → `adminRepository.js:31` → RPC
`admin_tour_queue_page`, whose error string reads *"We could not load the Peek moderation queue."*
`/admin/peeks` is a **reachable route** (`App.jsx:203`). Whether this is report-driven removal (permitted by
the MVP safety model) or a routine pre-publication approval queue (obsolete MVP drift) is **deferred to
Phase 16**; the cursor fields `reportedPriority` / `failedPriority` suggest report-driven, but this is not yet proven.

## 0.13 Hygiene & history

**Exceptionally clean — recorded as a genuine strength:**

| Check | Result |
|---|---|
| `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error` in `src/` | **0** |
| `eslint-disable` in `src/` | **0** |
| `dangerouslySetInnerHTML` in `src/` | **0** |
| TODO / FIXME / HACK / XXX | **1**, a false positive (`constants.js:483` string template `${prefix}-XXXX`) |
| `console.*` in `src/` | 7 (Phase 1 reviews production noise/PII) |
| `.env` / `.env.*` ever committed | **None** — history clean |
| Secret-shaped strings in tracked files | 2 hits, both **detector patterns**, not secrets (`scripts/verify-repository-hygiene.mjs`, `docs/SECURITY_REVIEW.md`) |
| Tracked binaries >1 MB | 1 — `preview-assets/mock/findit-tour-preview.mp4` (6.5 MB) |

## 0.14 Phase 0 findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-001 | P2 | CONFIRMED | Customer-facing branding is still "FindIt" across ~60 files / 111 occurrences, including the entire live legal corpus |
| F-002 | P2 | CONFIRMED | `peekaListingBrandContracts.test.mjs` gives false brand-identity confidence — asserts FindIt-absence in only 3 files |
| F-003 | P1 | CONFIRMED | Public Peeks — the stated core differentiator — are deliberately gated off in every production configuration path in the repository, and Peek release acceptance is unevidenced |
| F-004 | P2 | CONFIRMED | Capability gating trusts a client-readable `*.vercel.app` hostname prefix |
| F-005 | P2 | CONFIRMED | Node engine mismatch: `>=23.6.0` declared, no CI pin proof; audit env 22.22.2 installs with EBADENGINE |
| F-006 | P3 | CONFIRMED | `TRUSTED_STAGING_BRANCHES` lists 4 stale branches that still auto-enable gated capabilities |
| F-007 | P3 | CONFIRMED | 21 npm scripts retain obsolete `tours` product vocabulary |
| F-008 | P3 | CONFIRMED | `VITE_WEB_PUSH_PUBLIC_KEY` used in `src/` but absent from `.env.example` and unvalidated |
| F-009 | P3 | CONFIRMED | 6.5 MB mock video tracked in git |
| F-010 | P3 | CONFIRMED | 5 orphaned Peek/Tour component files |
| F-011 | P1 | CONFIRMED | Live Privacy Policy and Terms contain unfilled `[TO BE COMPLETED]` placeholders including operator legal name and registered address |

**No P0 identified in Phase 0.**

## 0.15 Carried forward

1. **Phase 1** — bundle-level service-role/secret proof; `vercel.json` headers & SPA rewrite; error boundary coverage (`AppErrorBoundary.jsx` exists — confirm it wraps the router); chunk-load failure handling.
2. **Phase 2/3** — RLS on all 100 tables incl. the 14 out-of-MVP tables; 356 `security definer` occurrences.
3. **Phase 4** — server-side MFA/AAL enforcement; `hasRequiredRole` implementation.
4. **Phase 5** — seller Peek fulfilment entry point (no top-level route); `CreateService` vs `CuratedCreateService`.
5. **Phase 7** — the 14 out-of-MVP tables and 4 monetisation flags.
6. **Phase 13** — F-011 legal placeholders; `legalContentOverrides.js` covers only 2 paragraphs.
7. **Phase 14** — false-confidence test sweep, seeded by F-002.
8. **Phase 15** — branch protection, 18 workflows, external provisioning (E-001…E-006).
9. **Phase 16** — `/admin/peeks` moderation-queue semantics.
