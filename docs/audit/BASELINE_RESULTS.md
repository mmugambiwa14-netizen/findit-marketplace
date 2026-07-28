# Baseline Execution Results

Environment: Windows 11, Node.js v24.12.0, npm.
Package manager: **npm** — confirmed by `package-lock.json` (lockfileVersion 3)
being the only lockfile present. `engines.node` is `>=20.0.0`.

No remote service was contacted. No credentials were supplied.

## Install

| Command | Result |
|---|---|
| `npm ci --ignore-scripts` | **PASS** — 411 packages added, 412 audited, ~2 min. Command taken from `README.md`. |

No dependency was added, removed or upgraded during this audit.

## Checks executed

| # | Command | Before Phase 9 | After Phase 9 |
|---|---|---|---|
| 1 | `npm run lint` | **FAIL** exit 1 — 1 error | **PASS** exit 0 |
| 2 | `npm run typecheck` | **FAIL** exit 2 — 376 errors / 71 files | **FAIL** exit 2 — 20 errors |
| 3 | `npm run typecheck:migration` | **PASS** exit 0 | **PASS** exit 0 |
| 4 | `npm run typecheck:active` | **FAIL** exit 1 — 388 diagnostics / 217 modules | **FAIL** exit 1 — reduced, see note |
| 5 | `npm run test:contracts` | **FAIL** exit 1 — 238/239 | **PASS** exit 0 — 239/239 |
| 6 | `npm run build` | **FAIL** exit 1 — budget | **FAIL** exit 1 — budget |
| 7 | `npm run verify:base44-elimination` | **PASS** exit 0 | **PASS** |
| 8 | `npm run verify:source-graph` | **PASS** exit 0 — 323 modules, 0 unresolved imports | **PASS** |
| 9 | `npm run verify:hygiene` | **PASS** exit 0 — 531 files | **PASS** standalone |
| 10 | `npm run verify:sql-boundary` | **PASS** exit 0 — 44 contiguous migrations, 15 rollback capsules | **PASS** |
| 11 | `npm run audit:production` | **PASS** exit 0 | **PASS** |
| 12 | `npm run audit:product-surface` | **FAIL** exit 1 — 0 page modules, 2 false failures | **PASS** exit 0 — 34 modules, 731 controls, 0 findings |
| 13 | `npm run audit:ui-surface` | **FAIL** exit 1 — 0 page modules | **FAIL** exit 1 — 34 modules, 726 controls, 3 FIELD_LABEL (F-10) |
| 14 | `npm run audit:extensive` | **FAIL** exit 1 | **FAIL** exit 1 — different cause, see F-02 |
| 15 | `npm audit` | 8 high severity | unchanged (no dependency was altered) |

Note on #4: `typecheck:active` shares the root cause of #2 and improved with it.
It is still non-zero for the same 20 residual diagnostics plus its wider module
set. It was not separately re-measured after the final edit.

## Blocked — not run

Recorded as blocked rather than assumed. Each requires infrastructure or
credentials that this audit is explicitly forbidden to use.

| Command | Blocker |
|---|---|
| `supabase start` / `db reset` / `db lint` / `supabase test db` | Docker Desktop + Supabase CLI; also forbidden by audit scope |
| `npm run validate:env` | **exit 1** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` missing. Correct fail-closed behaviour with no `.env`. |
| `npm run verify:oauth-providers` | **exit 1** — needs `FINDIT_SUPABASE_URL` / `FINDIT_SUPABASE_ANON_KEY` |
| All `test:*-local` / `test:*-hosted` smoke scripts (30+) | Require a running Supabase stack or hosted project |
| `npm run certify:release-candidate` | Requires the hosted acceptance chain |
| `supabase/tests/*.sql` (12 pgTAP files) | Require `supabase test db` |

The two env failures are **correct behaviour**, not defects: the app refuses to
start unconfigured rather than falling back to a default backend.

## Build detail (F-01)

`vite build` itself **succeeds** — the application compiles. Two of the three
post-build gates pass. The failure is the third, a performance budget:

```
Base44 elimination gate: PASS
Production build Base44 boundary: PASS (134 generated text assets inspected)
Error: Production build exceeds its performance budget:
entryRawBytes: 589483 > 573440 bytes
```

Measured against `scripts/verify-build-budget.mjs`:

| Metric | Measured | Budget | Margin |
|---|---|---|---|
| entryRawBytes | 589,483 | 573,440 | **+2.8% FAIL** |
| entryGzipBytes | 173,563 | 174,080 | −0.3% pass |
| styleRawBytes | 68,090 | 112,640 | −39.6% pass |
| styleGzipBytes | 12,171 | 25,600 | −52.5% pass |

The gzip figure has only 517 bytes of headroom, so this is not a rounding issue —
the entry chunk is genuinely at its ceiling. Largest emitted chunk is
`dist/assets/index-*.js` at 589 KB; every route is already lazy-loaded, so the
weight is in the eagerly-imported shell (`AuthContext` → `authService` →
`supabaseClient` pulls the Supabase SDK into the entry chunk).

**Fixed in remediation round 2.** A per-module size report (`vite build` with
`write: false`, reading `output[0].modules`) showed `@supabase/realtime-js`
plus its bundled Phoenix websocket transport at ~151 KB pre-minify inside the
entry chunk, despite `config.toml` disabling realtime and no file in `src/`
ever calling `.channel()`. `createClient()` always constructs a
`RealtimeClient`, so the import is real, not tree-shakeable, even though it is
dead weight. `src/lib/noRealtimeClient.js` stubs the four methods
`SupabaseClient` actually calls on it (`setAuth`, `getChannels`,
`removeChannel`, `removeAllChannels`) plus `channel()`, which throws instead
of silently no-op'ing. Aliased over `@supabase/realtime-js` in
`vite.config.js` `resolve.alias` — this only affects code Vite bundles for
the browser; Node scripts and Edge Functions still get the real package.

```
Production build budget: PASS (index-FLQc_Ily.js 531885 B raw / 156683 B gzip; CSS 68090 B raw / 12171 B gzip)
```

| Metric | Before | After | Budget | Margin after |
|---|---|---|---|---|
| entryRawBytes | 589,483 | 531,885 | 573,440 | 7.3% under |
| entryGzipBytes | 173,563 | 156,683 | 174,080 | 10.0% under |

Re-verified: `npm run lint` exit 0; `npm run test:contracts` 239/239;
`npm run audit:extensive` run twice in succession, both identical
(only the pre-existing F-10 FIELD_LABEL findings); `npm run typecheck`
unchanged at 19 errors, none of which reference Supabase or realtime.

## Phase 9 changes and re-verification

Each entry: original problem → change → re-run result.

### 1. `tests/comprehensiveProductAudit.test.mjs:194`

- **Problem:** the exemption `path.endsWith('src/lib/browserStorage.js')` used
  forward slashes, but `collect()` builds paths with `node:path.join`, which
  emits `\` on Windows. The exemption never matched, so the designated safe
  storage wrapper was reported as unsafe. Linux-only correctness.
- **Change:** compare against a `replaceAll('\\','/')`-normalised copy. The
  original `path` is still used for the failure message.
- **Re-run:** `npm run test:contracts` → **exit 0, 239/239 pass** (was 238/239).

### 2. `scripts/audit-product-surface.mjs:255` and `:309`

- **Problem:** same separator bug in two places. `displayPath` fed
  `endsWith('src/lib/...')`, producing 2 false `UNSAFE_BROWSER_STORAGE`
  failures; and `resolve(file).startsWith(\`${pageDirectory}/\`)` matched
  nothing, so the audit reported **0 page modules** while still claiming to have
  audited the product surface.
- **Change:** normalise `displayPath` to POSIX separators; add a `posixPath()`
  helper for the page-directory test.
- **Re-run:** `npm run audit:product-surface` → **exit 0**, `42 route patterns,
  34 page modules, 539 unique controls, 731 page-expanded controls. Findings: 0
  failures, 0 warnings.`

### 3. `scripts/audit-ui-surface.mjs:120` and `:170`

- **Problem:** identical `startsWith(\`${pageRoot}/\`)` bug — 0 page modules,
  0 control instances.
- **Change:** extracted `isPageModule()` using POSIX-normalised comparison.
- **Re-run:** now inspects **34 page modules and 726 control instances**
  (was 0 and 0). Still exit 1 on 3 pre-existing FIELD_LABEL findings — see F-10.

### 4. `src/pages/admin/AdminAuditLog.jsx:5`

- **Problem:** `Button` imported but never used — the only lint error.
- **Change:** removed the import. No other reference to `Button` exists in the file.
- **Re-run:** `npm run lint` → **exit 0**.

### 5. `jsconfig.json` include list

- **Problem:** included `src/Layout.jsx`, which does not exist, and
  `src/components/**/*.js`, while every component is `.jsx`. The declared
  type-check surface was therefore almost entirely fictional.
- **Change:** `["src/components/**/*.jsx", "src/pages/**/*.jsx", "src/App.jsx"]`.
- **Re-run:** covered by the typecheck result below.

### 6. `forwardRef` JSDoc cast — `card.jsx`, `input.jsx`, `textarea.jsx`, `button.jsx`

- **Problem:** a JSDoc `@type` cast only applies when the cast target is
  parenthesised. Written as
  `/** @type {...} */\n({ ... }, ref) => (...)`, the comment does not attach, so
  `forwardRef` degrades to `RefAttributes<any>` and **every prop passed to that
  primitive becomes an error** — `Property 'children' does not exist`. This one
  defect produced 314 of the 376 errors.
- **Scope check before changing anything:** 53 occurrences across 16 UI files
  were surveyed — **45 were already correct** (`((`) and only **8 were broken**
  in 3 files. The fix aligns the outliers with the pattern the codebase already
  uses; it is not a new convention.
- **Change:** wrapped the render function in its own parentheses. This is a
  comment-attachment fix — the emitted JavaScript is unchanged and no UI,
  styling or behaviour is affected.
- **Re-run, measured stepwise:**
  - `button.jsx` alone: 376 → **199** errors, all Button-related errors gone.
  - remaining 3 files: 199 → **20** errors.
  - `npm run lint` → exit 0. `npm run test:contracts` → 239/239.

No test was added for these six changes: five are build/tooling configuration
and the sixth is a type-annotation attachment with no runtime output. The
existing 239-test contract suite plus `verify:source-graph` (323 modules, 0
unresolved imports) is the regression evidence.

## Residual typecheck errors (20)

Now real signal rather than noise. Grouped:

- 8 × `parentType` not on type `{ kind?: null }` — `canonicalQueryInvalidation.js`
  and 7 call sites. Runtime-correct; missing JSDoc `@param`. → F-09
- 5 × `AdminTourQueue.jsx` `Property 'x' does not exist on type 'void'` —
  `useMutation` variable inference in checkJs. Runtime-correct.
- 4 × missing required props: `ProtectedRoute.jsx:81` (**genuine defect → F-05**),
  `DealerListings.jsx:58`, `Saved.jsx:81`, `ListingMediaViewer.jsx:213`.
- 1 × `VariantSelector.jsx:21` duplicate JSX attribute → F-08.
- 2 × miscellaneous prop-shape mismatches.

## Files changed in Phase 9

```
jsconfig.json
scripts/audit-product-surface.mjs
scripts/audit-ui-surface.mjs
src/components/ui/button.jsx
src/components/ui/card.jsx
src/components/ui/input.jsx
src/components/ui/textarea.jsx
src/pages/admin/AdminAuditLog.jsx
tests/comprehensiveProductAudit.test.mjs
```

## Side effects to be aware of

Running the audit scripts regenerated `dist/` and `artifacts/extensive-audit/*`.
These are generated outputs, not hand-edited sources.

**One file was lost and this should be stated plainly:**
`artifacts/extensive-audit/extensive-audit-verification.json` shipped in the
archive with clean ASCII content — the first `verify:hygiene` run passed with it
in place, inspecting 531 files. Running `npm run audit:extensive` overwrote it
with output captured on Windows, which contains the U+2714 glyph, and the next
hygiene run failed on it. The regenerated file was then removed so the gate
returns to green; `npm run audit:extensive` recreates it. The vendor's original
evidence record for that run is not recoverable from this tree.

That accident is itself the clearest proof of **F-02**: the shipped artifact was
clean, so the environment that produced it emitted ASCII test markers, while a
Windows terminal emits U+2714. The gate's outcome therefore depends on the
reporter's glyph choice rather than on repository state — which is exactly why
it must be normalised rather than left to chance.

No migration, RLS policy, Edge Function, schema, dependency or product flow was
modified.
