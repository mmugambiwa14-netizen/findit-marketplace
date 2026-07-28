# Remediation Plan

Ordered by whether the item blocks the next concrete step, then by cost. Nothing
here requires architectural change, schema redesign or dependency upgrades.

## Already done (Phase 9)

Six fixes were applied to make local inspection reliable. Full detail, including
before/after command output, is in [BASELINE_RESULTS.md](BASELINE_RESULTS.md).

| Fix | Effect |
|---|---|
| Windows path separators in the contract test | `test:contracts` 238/239 → **239/239** |
| Windows path separators in `audit-product-surface.mjs` | 0 page modules → **34**; 2 false failures → **0**; gate now passes |
| Windows path separators in `audit-ui-surface.mjs` | 0 page modules → **34**, 0 → **726** control instances |
| Removed unused `Button` import | `lint` → **exit 0** |
| Corrected `jsconfig.json` include list | Type-check surface is real rather than fictional |
| `forwardRef` JSDoc cast in 3 UI files (8 sites) | `typecheck` 376 → **20** errors |

## Blocking — do before staging

### R-01 (High) — bring the entry bundle under budget — **done, differently than planned**
**Finding:** F-01 / P-01. `entryRawBytes` 589,483 > 573,440; gzip has 517 B headroom.
**What was actually tried first:** the vendor-chunk split this plan originally
proposed. It was measured and **rejected** — moving `@supabase/supabase-js`,
`@radix-ui/*` etc. into separate chunks breaks scope-hoisting and grows the
*true* initial payload (entry + modulepreload) from 589 KB/173 KB to
752 KB/218 KB. See the comment in `vite.config.js` and F-14 in
`AUDIT_SUMMARY.md`. Re-chunking was the wrong lever.
**What fixed it:** a per-module size report showed `@supabase/realtime-js`
plus its Phoenix websocket transport at ~151 KB pre-minify in the entry chunk,
even though realtime is disabled in `config.toml` and unused in `src/`.
`createClient()` builds a `RealtimeClient` unconditionally, so it can't be
tree-shaken away — it had to be replaced. `src/lib/noRealtimeClient.js`
stubs the exact four methods `SupabaseClient` calls on it, aliased over
`@supabase/realtime-js` in `vite.config.js` `resolve.alias` (browser build
only). `channel()` throws rather than no-op'ing, so real future use fails
loudly instead of silently doing nothing.
**Result:** entryRawBytes 589,506 → **531,885** (budget 573,440, 7.3% headroom);
entryGzipBytes 173,563 → **156,683** (budget 174,080, 10.0% headroom).
**Verified:** `npm run build` exits 0; `npm run lint`, `npm run test:contracts`
(239/239) and `npm run audit:extensive` (run twice) all pass unchanged.

### R-02 (High) — make `audit:extensive` idempotent — **done**
**Finding:** F-02 / P-02. The audit writes an artifact its own hygiene gate rejects.
**Files:** `scripts/extensive-product-audit.mjs:104`, `scripts/verify-repository-hygiene.mjs:5`.
**Action:** pick one, deliberately —
1. normalise runner status glyphs (U+2714 / U+2716) to ASCII before `writeFile`,
   keeping the hygiene rule's reach over generated files; or
2. exempt generated artifact paths from the pictographic rule **only**, leaving
   secret and merge-marker scanning active.
Option 1 is preferred: it keeps the rule universal.
**Verify:** run `npm run audit:extensive` **twice in succession**; both must pass.

### R-03 (Medium) — restore the sign-out escape — **done**
**Finding:** F-05 / P-03.
**File:** `src/components/ProtectedRoute.jsx:81`.
**Action:** pass `onSignOut={logout}`, matching `src/App.jsx:115`. One line;
`logout` is already available from `useAuth`.
**Verify:** the residual typecheck error `Property 'onSignOut' is missing` clears.

## Before public launch

### R-04 (Medium) — application-level rate limiting
**Finding:** S-03. Platform auth limits exist; per-user mutation quotas do not.
**Action:** add per-user, per-window counters inside the existing
`SECURITY DEFINER` mutation RPCs (listing create, report submit, message send,
tour upload intent) so the check cannot be bypassed from the client.

### R-05 (Medium) — resumable uploads
**Finding:** P-04. A dropped 250 MB tour upload restarts from zero — a real
completion-rate risk on the target market's mobile networks.
**Action:** chunked/resumable upload against the existing intent mechanism. The
intent record already provides the server-side anchor a resumable protocol needs.

### R-06 (Low) — clear the residual 20 typecheck errors
**Action, in descending value:**
- `ProtectedRoute.jsx:81` — covered by R-03.
- `canonicalQueryInvalidation.js` — add a JSDoc `@param` typedef for
  `{parentType, parentId, kind}`; clears 8 errors across 8 call sites (F-09).
- `AdminTourQueue.jsx` — annotate the `mutationFn` parameter; clears 5 (T-01).
- `VariantSelector.jsx:21` — remove the duplicate `type="button"` attribute
  (F-08); same value, so no behaviour change, but it is a genuine defect.
- `DealerListings.jsx:58`, `Saved.jsx:81`, `ListingMediaViewer.jsx:213` —
  supply the missing props or mark them optional.
**Verify:** `npm run typecheck` exits 0, then wire it into the release gates so
it cannot regress.

### R-07 (Low) — decide the FIELD_LABEL policy
**Finding:** F-10. `audit:ui-surface` reports three MEDIUM findings against
`input.jsx`, `textarea.jsx` and `PhoneInput.jsx` for having no label. Base
primitives are unlabelled by design — consumers supply the label — so these are
permanent, non-actionable failures that keep the gate at exit 1.
**Action:** either exempt `src/components/ui/*` primitives from the rule, or add
an explicit `aria-label` contract. Leaving a gate permanently red is the worst
of the three options.

## Housekeeping

### R-08 (Low) — consolidate documentation
~45 status/milestone reports sit at the repository root, several superseded.
Three stray notes also sit inside `src/` (`PHASE_1_4_COMPLETION.md`,
`PHASE_1_6_COMPLETION.md`, `VERIFICATION_FLOW_SUMMARY.md`); the first still
describes Base44 `asServiceRole` behaviour that no longer exists in the code and
will mislead anyone who greps for it.
**Action:** move historical reports to `docs/history/`, delete the `src/`
markdown files. Do this **after** the first commit so the history is preserved.

### R-09 (Low) — rollback capsules for early migrations
**Finding:** D-03. Capsules cover `0030`–`0044` only.
**Action:** irrelevant for a fresh project; add capsules for any migration that
will later run against a populated database.

### R-10 (Low) — schema comment on the messaging tables
**Finding:** D-02. Messages live in `inquiries`, not `messages`; `conversations`
is only the thread header. Correct and FK-linked, but reliably confusing.
**Action:** add a `comment on table` to both. Do not rename — the constraints,
policies and indexes all reference the current names.

## Dependencies — deliberately not now

**Do not run `npm audit fix --force`.** It downgrades `react-router-dom` to
7.11.0 and `eslint-plugin-react` to 7.22.0, both breaking, to resolve advisories
that are not exercised by this application (S-04, S-05). Track upstream and
upgrade when non-breaking fixes ship.

## Suggested sequence

1. ~~R-01, R-02, R-03~~ — done; staging is unblocked on the offline gates.
2. Initialise Git and push (not blocked by any finding; can run in parallel).
3. Create the fresh Supabase development project and apply migrations.
4. Run the blocked local suites (pgTAP, `test:*-local`) — this is what converts
   PRODUCTION_READINESS.md from design assessment to measured fact.
5. R-04 through R-07 before public launch.
6. R-08 through R-10 as housekeeping.
