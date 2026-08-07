# PHASE 01 — REPOSITORY, BUILD & CONFIG HARDENING

**Audited ref:** `origin/main` @ `ee6f212`
**Evidence tiers:** Static PASS · Local execution PASS (build, lint, typecheck, verifiers all executed) · Live read-only PASS **GitHub Actions** (Supabase/Cloudflare/Vercel still blocked — E-000)

---

## 1.1 HEADLINE — canonical `main` fails its own release gates, and the failure silently skips every quality check

**Live evidence (GitHub Actions API, branch `main`):**

At HEAD `ee6f212` — the commit titled *"Merge pull request #32 from …/integration/final-release-certification"* — **5 of 5** quality/deployment workflows conclude `failure`:

| Workflow | Conclusion at `ee6f212` | Last 30 runs on `main` |
|---|---|---|
| Release candidate gates | **failure** | 0 success / 4 failure |
| Release Certification | **failure** | 0 success / 4 failure |
| Migration gates | **failure** | 0 success / 4 failure |
| Deploy staging to GitHub Pages | **failure** | 0 success / 3 failure / 1 cancelled |
| GitHub Pages Preview | **failure** | 0 success / 4 failure / 1 cancelled |
| Run marketplace maintenance workers | success | 2 success / 4 failure / 1 cancelled |

**There is no successful run of any release, certification, migration or deployment workflow on `main` in the
returned history.**

### Root cause — reproduced locally

Job `verify` in `release-candidate-gates.yml`, run `31131784052`:

| # | Step | Conclusion |
|---:|---|---|
| 8 | Verify source graph | success |
| 9 | Verify repository hygiene | success |
| **10** | **Verify SQL migration boundary** | **failure** |
| 11 | Audit routed product surface | **skipped** |
| 14 | Run all contracts | **skipped** |
| 16 | Run Tours contracts | **skipped** |
| 17 | Lint application | **skipped** |
| 18 | Typecheck application | **skipped** |
| 19 | Typecheck migration boundary | **skipped** |
| 20 | Typecheck active release surface | **skipped** |
| 21 | Typecheck Supabase Edge Functions | **skipped** |
| 22 | Build production application | **skipped** |
| 23 | Audit production dependency boundary | **skipped** |
| 24 | Run reproducible internal certification | **skipped** |

Reproduced locally:

```
$ node ./scripts/verify-sql-boundary.mjs
SQL boundary verification failed:
- 20260807020000_peek_request_fulfilment_lifecycle.rollback.sql contains destructive table/data rollback statements
exit=1
```

The offending statement is `supabase/rollback/20260807020000_peek_request_fulfilment_lifecycle.rollback.sql:11`:

```sql
drop table if exists public.peek_request_fulfilments;
```

matched by the policy at `scripts/verify-sql-boundary.mjs:72`:

```js
if (/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(executable)) failures.push(`${name} contains destructive table/data rollback statements`);
```

**The tension is legitimate on both sides** and the audit does not adjudicate it here: a rollback for a
migration that *created* a table arguably should drop it, while the gate deliberately enforces
"rollbacks never destroy tables or data, forward-fix instead" (the scan strips function bodies first,
`:27-42`, precisely so that destructive statements *inside* functions are allowed). What matters for
production readiness is the consequence, not the adjudication.

### Consequence — this is why other defects went unnoticed

Because step 10 fails and the following steps carry no `if: always()`, **lint, all four typechecks, the
production build, the contract suites and internal certification never execute on `main`.** The gate reports
a single early failure and skips the entire quality suite. Section 1.2 shows exactly what this concealed.

The migration that broke the gate is `20260807020000_peek_request_fulfilment_lifecycle.sql` — the
**Peek Request fulfilment lifecycle**, the core differentiator, added the same day as HEAD.

→ **F-012 (P1)**, **F-013 (P1)**

## 1.2 What the skipped gates concealed — typecheck is red on `main`

Executed locally (Node 22.22.2, repo-locked TypeScript 5.8):

| Gate | Result |
|---|---|
| `npx eslint . --quiet` | **PASS** (exit 0, zero findings) |
| `npx tsc -p ./jsconfig.json` | **FAIL — exit 2, 10 errors** |
| `node ./scripts/active-v1-typecheck.mjs` (`typecheck:active`) | **FAIL** |
| `npx vite build` | **PASS** (exit 0) |
| `verify-base44-elimination.mjs` | **PASS** |
| `verify-built-boundary.mjs` | **PASS** |
| `verify-bundle-secrets.mjs` | **PASS** |
| `verify-build-budget.mjs` | **PASS** |

The 10 errors:

```
src/components/peekThreads/BuyerPeekRequestsQueue.jsx(112,50): TS2339: Property 'requestId' does not exist on type 'void'.
src/components/peekThreads/BuyerPeekRequestsQueue.jsx(115,26): TS2339: Property 'fulfilment' does not exist on type 'void'.
src/components/peekThreads/BuyerPeekRequestsQueue.jsx(117,27): TS2698: Spread types may only be created from object types.
src/components/peekThreads/BuyerPeekRequestsQueue.jsx(117,58): TS2339: Property 'fulfilment' does not exist on type 'void'.
src/components/peekThreads/BuyerPeekRequestsQueue.jsx(119,32): TS2339: Property 'requestId' does not exist on type 'void'.
src/components/peekThreads/BuyerPeekRequestsQueue.jsx(126,60): TS2339: Property 'requestId' does not exist on type 'void'.
src/pages/BusinessProfiles.jsx(26,20): TS2339: Property 'input' does not exist on type 'void'.
src/pages/BusinessProfiles.jsx(26,27): TS2339: Property 'logoChange' does not exist on type 'void'.
src/pages/BusinessProfiles.jsx(33,18): TS2339: Property 'profileSaved' does not exist on type 'Error'.
src/pages/BusinessProfiles.jsx(75,70): TS2345: Argument of type '{ input: any; logoChange: any; }' is not assignable to parameter of type 'void'.
```

**Honest characterisation:** these are `useMutation` generic-inference failures — TanStack Query defaults
`TVariables` to `void` when `mutationFn`'s parameter type cannot be inferred, so `item` is typed `void`
even though a real object is passed at `.mutate(item)` time. They are **type-soundness gaps, not proven
runtime defects**, and the audit does not claim the Peek queue is broken at runtime. What *is* proven is
that the declared type gate fails on the canonical release branch and CI never reports it.

→ **F-014 (P2)**

## 1.3 Build output & bundle budget

Build completed in the audit environment (`vite.config.js:43` sets `logLevel: 'error'`, which is why the
build prints no chunk summary).

| Metric | Value |
|---|---|
| `dist/` total | 3.3 MB |
| JS | 1,507,014 bytes across **151** chunks |
| CSS | 111,208 bytes across 3 files |
| Source maps in `dist/` | **0** PASS |

Largest chunks (raw / gzip):

| Chunk | Raw | Gzip |
|---|---:|---:|
| `App-*.js` | 243,988 | 76,276 |
| `BrandLogo-*.js` | 202,167 | 53,757 |
| `index-*.js` | 147,851 | 48,048 |
| `CreateListing-*.js` | 46,876 | 13,353 |

**Correction to a tempting misreading:** `BrandLogo-*.js` at 200 KB is **not** an inlined logo.
`src/components/BrandLogo.jsx` is ~30 lines and references the SVG by URL (`/brand/peekalisting-binoculars.svg`),
which is correct. Rollup named a large **shared chunk** after one of its entry points; the chunk contains
`clsx`/`cva`/`tailwind-merge` and other shared UI code. The 200 KB is real and shell-loaded (BrandLogo is
rendered in `TopNav` and `SiteFooter`), but the component is not the cause.

Initial payload is therefore roughly `index` + `App` + `BrandLogo` ≈ **594 KB raw / 178 KB gzip**, matching
the measured figure documented at `vite.config.js:73-77`. `verify-build-budget.mjs` **passes**, so this is
within the project's declared budget. Judged against the Zimbabwe mid-range-Android / throttled-3G target
this is heavy; carried to Phase 10 rather than raised as a defect here, since the budget gate is green.

**Route splitting is real and good:** 151 chunks, every page `lazy()`-imported (`src/App.jsx:31-70`).

## 1.4 Vite configuration — assessed strong

`vite.config.js` is unusually well-reasoned and each decision is documented with its rationale:

- `build.sourcemap: false` (`:48`) stated explicitly and enforced by `verify-bundle-secrets.mjs`. **0 maps in `dist/`** confirmed.
- `esbuild.drop: ['debugger']`, `pure: ['console.log','console.info','console.debug']` (`:58-59`) — `console.error`/`warn` deliberately retained as the app's only production error visibility, with the reasoning that each logs an `Error` object rather than a token or request body. Verified: only 7 `console.*` call sites in `src/`.
- `publicDir: false` for builds plus `copyFirstPartyPublicAssets()` (`:7-32,42`) — keeps `preview-assets/` (the 6.5 MB mock video, F-009) out of production artifacts.
- `@supabase/realtime-js` aliased to `src/lib/noRealtimeClient.js` (`:70`) because Realtime is disabled in `supabase/config.toml` and `.channel()` is never called — a stub that throws if ever invoked. Removes dead vendor weight without hiding a regression.
- Vendor-chunk splitting **measured and deliberately rejected** with numbers (`:73-77`): it degraded the initial payload from 589 KB/173 KB to 752 KB/218 KB.

No finding.

## 1.5 Security headers & CSP (`vercel.json`)

Assessed **strong**. `vercel.json:11-51` applies to `/(.*)`:

| Header | Value | Assessment |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` + scoped allowlists | **Strong** — no `unsafe-inline`/`unsafe-eval` on `script-src`; only `style-src-attr` allows `unsafe-inline` (needed for React inline styles) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | PASS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | PASS |
| `X-Content-Type-Options` | `nosniff` | PASS |
| `X-Frame-Options` | `DENY` | PASS (doubled with `frame-ancestors 'none'`) |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | PASS correct for OAuth popups |
| `Cross-Origin-Resource-Policy` | `same-site` | PASS |
| `Permissions-Policy` | `geolocation=(self), camera=(), microphone=(), payment=(), usb=(), browsing-topics=()` | See below |
| `Cache-Control` | `no-store, max-age=0` on HTML; `immutable` on `/assets/*`; `must-revalidate` on `/sw.js` | PASS correct triad |

**CSP is consistent with the live media path.** `media-src 'self' blob: https://*.supabase.co` matches
`supabase/functions/tour-playback-access/index.ts:58-62,88`, which serves Peek playback from **Supabase
Storage signed URLs**. No Cloudflare/R2 media host is contacted by the browser today, so the CSP is not
blocking anything currently in use — but it *would* block a future R2/custom-domain media host. Recorded
against the Cloudflare gap in §1.8.

**`camera=()` — investigated and downgraded.** An empty allowlist disables the camera for all origins
including self, which would break in-browser capture. However the app does **not** use `getUserMedia` or
`MediaRecorder` anywhere in `src/`; Peek capture uses a native file picker,
`src/components/tours/TourUploader.jsx:211`:

```jsx
<input ref={recordInputRef} className="hidden" type="file" accept="video/*" capture="environment" onChange={choose} />
```

`capture` delegates to the OS camera app and is generally not governed by the `camera` Permissions-Policy
directive. So this is **not** a confirmed break. It is still recorded as **SUSPECTED** because
(a) browser treatment of `capture` under Permissions-Policy is not uniform and needs real-device
verification, and (b) the UI copy anticipates a browser permission this flow never requests —
`TourUploader.jsx:129` ("Camera access is blocked for FindIt. Allow camera access in your browser…") and the
whole of `src/components/permissions/CameraPermissionDialog.jsx`.

→ **F-015 (P2, SUSPECTED)**

## 1.6 SPA deep-link behaviour

`vercel.json:5-10` rewrites `/(.*)` → `/index.html`, so `/property/:id`, `/car/:id`, `/machinery/:id`,
`/service/:id` and `/peek` all deep-link correctly on Vercel. `trailingSlash: false`, `cleanUrls: false`.
`src/App.jsx:283` supports a `BASE_URL` sub-path for the GitHub Pages staging build. **PASS.**

## 1.7 Error boundaries & chunk-load failure

Well handled, contrary to the usual Vite-SPA weakness:

- `src/main.jsx:36-51` — `bootstrap()` dynamically imports `App` and `AppErrorBoundary` inside `try/catch`; a failed import renders `StartupFailure` with a reload button rather than a white screen.
- `src/main.jsx:43-45` — `<AppErrorBoundary>` wraps `<App/>`, so it is above the router and catches render errors from every route.
- `src/App.jsx:154` — `<Suspense fallback={<LoadingScreen/>}>` wraps all `lazy()` routes.

**One real gap:** `Suspense` handles *pending* lazy imports, not *rejected* ones. After a deploy rotates
hashed filenames, an open tab requesting a now-deleted chunk throws inside `React.lazy`. `AppErrorBoundary`
catches it — so no white screen — but the recovery offered is a generic error screen rather than the
correct remedy (reload to fetch the new manifest). Combined with `Cache-Control: no-store` on HTML and
`immutable` on `/assets/*`, a reload does resolve it, so impact is a confusing screen rather than a stuck app.

→ **F-016 (P3)**

## 1.8 PWA, service worker & manifest

`public/sw.js` rotates `peekalisting-shell-*` / `peekalisting-assets-*` caches and retires legacy caches via
`name.startsWith('findit-')`; `src/lib/serviceWorker.js:32,55,164` calls `deleteFindItCaches()`. Legacy
FindIt caches therefore **upgrade safely** — a genuine strength and the correct use of the old name.

**Manifest icon defects — the manifest ships a single SVG and nothing else** (`public/manifest.webmanifest:24-31`):

```json
"icons": [ { "src": "/brand/peekalisting-binoculars.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" } ]
```

1. **No `apple-touch-icon` anywhere.** `index.html` declares `rel="icon"` (SVG) and `rel="mask-icon"` (SVG) but no `<link rel="apple-touch-icon">`. iOS ignores the manifest for the home-screen icon and requires a PNG `apple-touch-icon`; without it, "Add to Home Screen" on iPhone/iPad produces a blank or screenshot icon. `public/brand/findit-icon-180.png` — exactly the right size — exists but is unreferenced and off-brand.
2. **No raster PNG at 192/512 and no `maskable` purpose.** Android adaptive-icon masking will letterbox or crop the mark, and the splash screen has no raster source. `findit-maskable-512.png` exists, unreferenced and off-brand.

This matters more than usual because the product is mobile-first and actively prompts installation
(`src/components/pwa/InstallPrompt.jsx:108`).

**Aggravating factor — a test locks the defect in.** `tests/peekaListingBrandContracts.test.mjs:24` asserts:

```js
assert.ok(manifest.icons.every((icon) => icon.src === '/brand/peekalisting-binoculars.svg'));
```

Adding correct PNG icons would **fail this test**. The gate actively prevents the fix.

→ **F-017 (P2)**, reinforcing **F-002**

**Dead brand assets:** 7 `findit-icon-*.png` / `findit-mark.png` / `findit-maskable-512.png` in
`public/brand/` (~195 KB) plus 6 duplicates in `src/assets/brand/` (~145 KB), all unreferenced.
→ **F-018 (P3)**

## 1.9 Build-verification efficacy

All four build gates were executed and **pass**, and each was checked for whether it does real work:

| Gate | Result | Does it actually protect? |
|---|---|---|
| `verify-base44-elimination.mjs` | PASS | **Yes** — Base44 residue in `src/` is 13 comment-only occurrences; no runtime SDK/URL. Prevents regression. |
| `verify-bundle-secrets.mjs` | PASS | **Yes** — scans `dist/` for secret shapes and fails if a `.map` reaches `dist/`. 0 maps confirmed. |
| `verify-built-boundary.mjs` | PASS | Yes |
| `verify-build-budget.mjs` | PASS | Yes — enforces the payload budget documented in `vite.config.js` |

**Service-role never reaches the browser — confirmed at bundle level.** Source-level check (Phase 0) showed
0 occurrences in `src/`; `verify-bundle-secrets.mjs` passing against a real `dist/` confirms it for the
shipped artifact. Appendix C **"Service-role server-only" = PASS**.

**Node pinning — F-005 corrected.** CI step 4 of the `verify` job is **"Use Node.js 24"**, which satisfies
`engines.node >=23.6.0`. The engine *is* pinned in CI; only local development lacks an `.nvmrc`. F-005 is
downgraded from P2 to P3 accordingly.

## 1.10 Phase 1 findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-012 | P1 | CONFIRMED | All 5 quality/deployment workflows fail at canonical `main` HEAD; no successful release, certification, migration or deploy run in recent history |
| F-013 | P1 | CONFIRMED | A single early gate failure skips lint, all 4 typechecks, the build, contracts and internal certification — the quality suite never executes on `main` |
| F-014 | P2 | CONFIRMED | `typecheck` and `typecheck:active` fail on `main` with 10 errors, unreported because CI never reaches those steps |
| F-015 | P2 | SUSPECTED | `Permissions-Policy: camera=()` vs Peek capture; UI copy anticipates a browser camera permission the `capture` flow never requests |
| F-016 | P3 | CONFIRMED | Post-deploy chunk-load rejection surfaces as a generic error screen rather than a reload prompt |
| F-017 | P2 | CONFIRMED | PWA manifest ships one SVG icon: no `apple-touch-icon`, no raster PNG, no `maskable` — and a contract test locks it in |
| F-018 | P3 | CONFIRMED | ~340 KB of unreferenced legacy FindIt brand PNGs in `public/brand/` and `src/assets/brand/` |
| F-005 | P3 | CONFIRMED | *(downgraded from P2)* CI pins Node 24; only local development lacks `.nvmrc` |

**No P0 identified in Phase 1.**

## 1.11 Assessed strengths (recorded so the report stays fair)

- CSP with no `script-src` `unsafe-inline`/`unsafe-eval`; complete modern header set including HSTS preload, COOP/CORP and Permissions-Policy.
- Source maps off, verified by a build gate; 0 maps in `dist/`.
- Service-role key provably absent from the browser bundle.
- Error boundary above the router **and** a try/catch around bootstrap — no white-screen path found.
- 151 route-split chunks; every page lazily imported.
- Realtime vendor code stubbed out rather than shipped dead.
- Legacy FindIt service-worker caches explicitly retired on upgrade.
- Vite config decisions documented with measured evidence rather than assertion.
- ESLint clean at zero findings with no `eslint-disable` anywhere in `src/`.
