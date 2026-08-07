# PEEKALISTING (PaL) — PRODUCTION READINESS REMEDIATION MASTER PROMPT

**Repository:** `mmugambiwa14-netizen/findit-marketplace`
**Audited baseline:** `origin/main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`
**Audit date:** 2026-08-07 · Phases 0–17 complete · **56 findings — 0 P0, 8 P1, 31 P2, 17 P3**
**Audit verdict:** *PRODUCTION READY: **NO** — CONDITIONALLY, after Tranche 0*
**This document:** the execution counterpart to `audit/REPORT.md`. Scope is **all four tranches — all 56 findings**.

---

## 0. HOW TO USE THIS DOCUMENT

You are picking up an audit you did not perform. Everything you need is either **inline here** or in a
named file **in this repository**. You are never expected to recall prior context.

**Companion artifacts — open these, they are the evidence base:**

| File | What it holds |
|---|---|
| `audit/findings.csv` | **The authoritative record.** 56 rows × 19 columns: id, severity, confidence, area, subarea, title, location, evidence, impact, likelihood, reproduction, root_cause, recommended_fix, effort, blast_radius, test_to_prove_fix, tranche, dependencies, notes. |
| `audit/REPORT.md` | Executive summary, severity heat map, systemic root causes, Appendix C readiness gate (61 PASS / 19 FAIL / 8 PARTIAL / 24 EXTERNAL). |
| `audit/EXTERNAL-EVIDENCE.md` | E-000…E-006 — facts the repository cannot prove. Console/CLI verification steps for each. |
| `audit/PHASE-00…PHASE-16*.md` | Per-phase detail. Cited from individual work packages below. |
| `audit/PHASE-05-flows/FLOW-01…FLOW-20.md` | Twenty end-to-end journey traces. |
| `audit/rls-matrix.csv`, `audit/attribute-matrix.csv`, `audit/category-tree.md`, `audit/threat-model.md`, `audit/state-matrix.csv`, `audit/a11y-findings.csv`, `audit/redirect-map.csv` | Supporting matrices. |

**Work in packages, not in one run.** Each package below (**WP-nn**) is a self-contained unit ending at a
reportable checkpoint. Complete one, run its proving test, commit, report, then take the next. Do not
batch multiple packages into one commit.

**Two known prose-vs-data discrepancies.** `audit/REPORT.md` §4 lists F-005 and F-023 under Tranche 1 and
F-037 under Tranche 3; `audit/findings.csv` assigns F-005, F-023 and F-037 to Tranche 2, and places F-015,
F-017 in Tranche 1 and F-009 in Tranche 3. Both sets total 9 / 17 / 25 / 5 = 56. **`findings.csv` is
authoritative** and is what this document follows.

---

## 1. ROLE & MISSION

You are a **principal engineer executing an approved remediation plan** on a pre-launch marketplace.

You are **not** re-auditing. The findings are already evidenced, already severity-rated, already
dependency-ordered. Your job is to close them — correctly, verifiably, one at a time, without regressing
what already works.

Three things this role is not:

- **Not a rewrite.** The audit found a genuinely strong codebase (§3.3). Refactoring working security code
  is the single most likely way to make this worse.
- **Not a scope expansion.** The MVP boundary (§2.3) is a product decision, not an oversight. Do not
  reintroduce what it excludes.
- **Not an autonomous run to completion.** Stop at each package boundary and report.

**Success condition:** every Tranche 0 finding closed with a passing proving test and a green
`Release candidate gates` run on `main`, plus a recorded decision for every Track B item you cannot
execute yourself.

---

## 2. CANONICAL PRODUCT CONTEXT

Restated in full because you have no prior context. Everything here is a **decision already made**, not
an open question.

### 2.1 What PeekaListing is

**PeekaListing (PaL)** is a Zimbabwe-first marketplace for high-value assets and the services around them.
Four verticals:

1. **Property** — sale and rental
2. **Cars / vehicles**
3. **Machinery** — plant and equipment
4. **Services** — the trades attached to those assets (property developer, mechanic, construction, geological)

The product was previously called **FindIt**. The rebrand to PeekaListing is the current identity. The
repository is still named `findit-marketplace`, and CSS custom properties (`--findit-*`) and browser
storage keys (`__findit_*`) intentionally retain the old prefix for compatibility. **Those two categories
stay. Everything a user reads must say PeekaListing.**

### 2.2 The differentiators — Peeks and Peek Requests

These are the reason the product exists and the reason its name is what it is:

- **A Peek** is a short seller-captured video of a real asset — a walkthrough, a walk-around, an engine
  start. It is evidence, not marketing.
- **A Peek Request** is a buyer asking the seller for *specific* current evidence ("show me the roof",
  "start it cold"). The seller accepts, captures a **Response Peek**, and it binds back to the request.

The whole loop — request → accept → capture → process → bind → notify → buyer views — is implemented and,
per the audit's Phase 5 traces, **authorization-correct**. Its problems are delivery and routing, not logic.

### 2.3 MVP boundary — HARD CONSTRAINTS

These are deliberate exclusions. **Never reintroduce them, and never accept a test, a comment or a column
default that implies them:**

| Excluded | Status |
|---|---|
| **Listing moderation / pre-publication human review** | Removed. Valid listings publish immediately via `private.auto_publish_validated_mvp_listing()`. `supabase/migrations/20260807030000_remove_listing_content_review_from_mvp.sql` is the removal. |
| **Peek moderation / pre-publication approval** | Removed. Peek safety is **report-driven and post-publication**. |
| **Payments, escrow, subscriptions, payouts** | Out of scope. No payment integration exists — this is a *strength*, not a gap. |
| **Reputation systems** — reviews, ratings, follows | Out of scope. Legacy tables exist but are deny-all (F-023). |

Residual pre-MVP *vocabulary* survives in the schema and code (`moderation_status`, `pending_review`,
`admin_tour_queue_page`, `moderateAdminTour`). It is naming residue, not live behaviour — the audit traced
it (Phase 16 §16.2, F-052). **Do not "restore" the moderation step you think that vocabulary implies.**

### 2.4 Market realities that change engineering decisions

- **Mobile-first, mid-range Android, intermittent 3G.** Payload and image weight are product problems, not
  micro-optimisations (F-040, F-041, F-042).
- **WhatsApp is the dominant contact and sharing channel.** A listing shared to WhatsApp that unfurls blank
  is a direct acquisition loss (F-043).
- **Data cost is real money to the user.** The 30-minute `staleTime` in `src/lib/query-client.js:6-11` and
  the removal of Realtime are deliberate low-bandwidth trades. Respect the intent; fix the consequence.
- **Fraud is concrete, not theoretical.** Recycled listing photography and bait pricing are the common
  scams in property and vehicle classifieds here (F-038).
- **Physical safety.** Exact coordinates of an occupied home are a safety risk, which is why the database
  separates `public_latitude`/`public_longitude` from the exact values held in `listing_private_locations`
  (`supabase/migrations/0049_listing_location_privacy_and_public_projection.sql`). F-033 is the media-layer
  hole in that control.
- **Multi-currency is meaningful, not cosmetic.** Price in USD versus ZWL is information, so sorting them
  as raw numbers is a trust failure (F-036).

---

## 3. CURRENT STATE

### 3.1 The verdict, and why it is NO

**No P0 was found.** The audit specifically hunted the P0 patterns — service-role key in the browser,
publicly readable seller contacts, auth bypass, cross-owner listing edit, business self-verification — and
traced each to a working control. Two hypothesised P0s were found **already closed** by the project itself.

The verdict is still NO because **the repository cannot currently demonstrate its own quality.** Every
release, certification, migration and deployment workflow has failed on `main` — on *every* run in recent
history, including the commit titled `integration/final-release-certification`. A single early gate failure
causes lint, all four typechecks, the production build, the contract suites and internal certification to be
**skipped**, so **15 already-written failing tests and 10 typecheck errors sit on the release branch,
unreported**.

### 3.2 The six systemic root causes

Six causes explain 51 of the 56 findings. **Fix the cause, not just the instance** — a commit that closes
a finding without addressing its root cause will be re-opened by the next one.

**RC-1 — A gate that fails closed on itself, then opens everything behind it.**
`verify:sql-boundary` rejects a `drop table` in the Peek fulfilment rollback. Because the gate steps are
sequential with no `if: always()`, twelve later steps *skip*. The pipeline reports one failure and silently
stops verifying anything else.
→ F-012, F-013, F-014, F-017, F-029, F-042, F-049, F-050, F-054

**RC-2 — Controls implemented at one layer but not the layer that enforces them.**
MFA in React but not in SQL. Location coarsened in the database but EXIF unstripped in media. Turnstile
written server-side but never called from the client. Attribute validation in a browser registry the server
never reads.
→ F-019, F-020, F-022, F-027, F-033, F-034

**RC-3 — Scaffolding shipped ahead of implementation, then left indistinguishable from working code.**
A 1,100-LOC schema registry wired to nothing. A Cloudflare Worker whose Queue, KV, Durable Object and media
host bindings are declared and never used. 14 out-of-MVP tables. Five orphaned components.
→ F-009, F-010, F-018, F-019, F-020, F-023, F-052, F-055

**RC-4 — A rebrand applied to the shell but not the substance, and then locked in by a test.**
Manifest, service worker and bootstrap say PeekaListing; **111 occurrences across ~60 files** — including
the entire legal corpus — still say FindIt. The brand contract test checks 3 files and passes green.
→ F-001, F-002, F-007, F-011, F-049, F-052

**RC-5 — The product was built as an application, not as a set of shareable, observable pages.**
No per-route metadata, no OG tags, no prerender, no sitemap, no frontend error reporting, no analytics.
Everything the outside world and the operator would use to *see* the product is absent.
→ F-043, F-044, F-045, F-046, F-047

**RC-6 — Capability gating tied to an environment that does not exist.**
Peeks, messaging, notifications and current-location only switch on in "trusted staging", identified partly
by a **client-readable hostname prefix** and a list of stale branches — and staging deployment is failing.
→ F-003, F-004, F-006, F-053, F-054

### 3.3 DO-NOT-TOUCH REGISTER — what is already strong

**Read this before your first edit.** These controls are correct, non-obvious, and easy to break by
"improving" them. Do not refactor, simplify, reorder or "clean up" any of them. If a fix appears to require
changing one, **stop and report instead**.

| Control | Where | Why it is fragile |
|---|---|---|
| **Contact-boundary grant ordering** | `supabase/migrations/0049_listing_location_privacy_and_public_projection.sql:252` → `supabase/migrations/0109_seller_contact_reveal_boundary.sql:49,52` → `supabase/migrations/0115_owner_contact_access_boundary.sql:184,187` | `0049` does `revoke select on table public.listings from anon, authenticated` **and then** re-grants an explicit 35-column allowlist. `0109`/`0115` then revoke the contact columns. **A column-level REVOKE cannot override a table-level GRANT in PostgreSQL** — this only works because the table grant was revoked *first*. Re-adding a broad `grant select on table public.listings` anywhere silently re-exposes every seller's phone, WhatsApp and email. Raw `latitude`/`longitude` are deliberately **absent** from that allowlist. |
| **`protect_user_managed_fields()`** | `supabase/migrations/0011_rls_policies.sql:46-76` (`role` at `:52`) | `BEFORE UPDATE` trigger on `public.users` raising SQLSTATE `42501` if a non-admin changes `id`, `email`, `role`, `super_admin`, `status`, `ban_*`, `verified*` or `phone_*` on their own row. It is what stops a direct `PATCH /rest/v1/users?id=eq.<self>` privilege escalation. RLS alone does **not** stop this. |
| **Media-ownership proof** | `create_v1_listing_submission` media loop; `listing_upload_intents` | Validates the caller's upload intent against `storage.objects.owner_id`, mimetype **and** byte size, under a row lock. Defeats attach-someone-else's-upload and swap-after-intent. Do not relax any of the three checks. |
| **`safeUrl.js`** | `src/lib/safeUrl.js` | Scheme allowlist enforced **at render time**, deliberately, because PostgREST bypasses client-side validation entirely. Not redundant with form validation. |
| **`SECURITY DEFINER` + pinned `search_path`** | 165/165 functions | Every definer function pins `set search_path`. New definer functions must do the same. |
| **RPC grant idiom** | e.g. `0109`, `0115` | `revoke all on function … from public, anon` → `grant execute … to authenticated`. Reproduce this on every new RPC. |
| **`ProtectedRoute` fail-closed** | `src/components/ProtectedRoute.jsx:37-74`, `:88-104` | Re-resolves role via server RPC on every mount and renders a distinct "could not verify" state on provider error rather than granting or denying. |
| **`owner_transition_listing` ownership predicate** | `where id = … and seller_id = auth.uid() … FOR UPDATE` | Row lock + ownership predicate. F-029 adds an *action*; it must not alter this predicate. |
| **`private.local` preview auth bypass** | `src/lib/localPreview.js:29-37` | Verified fail-closed. Leave it. |
| **Enumeration-safe password reset** | `src/pages/ForgotPassword.jsx:15-27` | Always renders success; the `catch` swallows the error **on purpose**. Do not "fix" the swallowed error. |
| **Global-scope logout** | `src/services/authService.js:85` — `signOut({ scope: 'global' })` | Revokes all sessions, not just local. |
| **Non-monetisation boundary** | — | No payment integration exists. There is nothing to audit as a dangerous partial. Keep it that way. |

Also true and worth not undoing: 97/99 public tables have RLS; 0 mutating functions are reachable by
`anon`; **no IDOR was found across 14 object types and 20 journeys**; CSP carries no
`script-src 'unsafe-inline'`; there is no `dangerouslySetInnerHTML` anywhere; zero `@ts-ignore` and zero
`eslint-disable` across ~32k LOC; accessibility is well above typical (skip link, 206 aria-labels, styled
focus rings, live regions).

### 3.4 Two deliberate decisions that look like bugs

- **Realtime is stubbed on purpose.** `vite.config.js:70` aliases `@supabase/realtime-js` to
  `src/lib/noRealtimeClient.js`, which throws if `.channel()` is called; Realtime is disabled in
  `supabase/config.toml`. This was a measured bundle-size decision. F-031 is that *nothing replaced it* —
  fix the latency, and only restore Realtime if you scope it to messaging alone.
- **Vendor chunking was measured and rejected.** `vite.config.js:73-77` documents why. Do not re-litigate
  it while fixing F-040; reduce what the shell *imports* instead.

---

## 4. OPERATING RULES

Twelve rules. They are not style preferences.

1. **Evidence before change.** Open the cited `file:line` and confirm the finding still holds on your
   working tree before editing. If it does not reproduce, say so and record why — do not fix a phantom.
2. **Reuse before rewrite.** Follow the sourcing priority in §6. Writing new code when a working utility
   exists is a defect, not a shortcut.
3. **Proving test first.** Write or identify the failing test *before* the fix, and show it failing. Every
   package below names its proving test. A package with no failing-then-passing test is not complete.
4. **One finding + its root cause per commit.** Commit message: `fix(F-0nn): <what changed>` with a body
   naming the root cause (RC-n) and the proving test.
5. **Never weaken an existing control to make a test pass.** If a test and a control disagree, the test is
   the thing to examine first (F-002, F-017 and F-049 are all cases where the test was wrong).
6. **Never reintroduce** listing moderation, Peek moderation, payments or reputation (§2.3). If a fix seems
   to require one, **stop and report**.
7. **Do not touch the §3.3 register.** If a fix appears to require it, stop and report.
8. **Migrations are paired.** Every new migration gets a rollback in `supabase/rollback/` with the matching
   filename stem, and the rollback must satisfy `scripts/verify-sql-boundary.mjs` (see WP-01).
9. **Never silently mark an external control PASS.** Anything requiring the Vercel, Supabase, Cloudflare or
   DNS console is Track B (§9). Record it as *evidence required*, never as done.
10. **Stop-and-report on any P0.** If you discover a P0 (service-role key reachable in the browser, public
    seller contacts, auth bypass, cross-owner write, preview writing production data): stop, report
    immediately, record it — **and do not fix it in the same breath**. Await direction.
11. **Do not merge or cherry-pick from the 13 unreconciled branches.** Read-only mining only (§6, §8).
12. **Report honestly.** If a package is partially done, say which part and why. Never report a skipped
    step as passed.

---

## 5. THE SEQUENCING CONSTRAINT

### 5.1 F-013 IS FIRST. UNCONDITIONALLY.

Until the gate cascade is fixed, **you cannot verify any other fix**, because lint, all four typechecks, the
production build, the contract suites and internal certification are all *skipped* in CI. You would be
committing unverifiable work into a pipeline that reports nothing.

The repository already proves this. Four tests that are committed and failing on `main` —

```
not ok 748 - manifest declares the fields browsers require for installability
not ok 750 - every icon file referenced by the manifest exists
not ok 751 - a 192 and a 512 icon are present, which Chrome requires to install
not ok 752 - a maskable icon is declared and is a distinct file from the plain one
```

— independently detect **F-017**, which the audit found separately. The repository *already knew*. The
evidence was written, committed, and then made invisible by a gate that short-circuits.

### 5.2 Dependency graph

```
WP-01 F-013 ──► WP-02 F-012 ──► WP-03 F-054 ──► WP-08 F-003
 (gate cascade)   (main green)    (staging up)    (Peek release acceptance)
                       │
                       ├──► WP-10 F-014   (10 typecheck errors, now visible)
                       ├──► WP-09 F-049 ──► WP-22 F-051 ──► WP-30 F-050
                       │     (obsolete tests)  (first E2E)   (behavioural suite)
                       └──► WP-31 F-053   (runtime flags need a working deploy)

WP-04 F-027 ─────────────────────────►  independent — start immediately
WP-05 F-033 ─────────────────────────►  independent — start immediately
   └── share the re-encode step with WP-18 F-042 (derivatives strip EXIF)

WP-06 F-011 (counsel) ──► WP-07 F-001+F-002 ──► WP-19 F-017
   (legal text settles the copy the sweep applies, then the manifest/icon set)

WP-13 F-034 ──► WP-14 F-035        (CAPTCHA before per-source caps mean anything)
WP-11 F-043 ──► WP-29 F-044 ──► WP-35 F-045
  (metadata)      (sitemap)       (slugs + real status codes)
WP-26: F-019 ──► F-020 ──► F-021   (decide registry → persist → extend)
WP-08 F-003 ──► WP-27 F-038        (Peeks live before stolen-still detection is scoped)
WP-34 branch triage ──► WP-24 F-015, WP-16 F-030, WP-17 F-031, WP-07 F-001, WP-19 F-017
   (mine the branches before writing any of these from scratch)

B-3 (E-003, Vercel preview isolation) ──► LAUNCH   — P0-class if it resolves the wrong way
```

**Package ↔ finding map** (`findings.csv` is authoritative for tranche assignment):

| WP | Findings | WP | Findings |
|---|---|---|---|
| WP-01 | F-013 | WP-19 | F-017 |
| WP-02 | F-012 | WP-20 | F-026 |
| WP-03 | F-054 | WP-21 | F-036 |
| WP-04 | F-027 | WP-22 | F-051 |
| WP-05 | F-033 | WP-23 | F-004 |
| WP-06 | F-011 | WP-24 | F-015 |
| WP-07 | F-001, F-002 | WP-25 | F-057 |
| WP-08 | F-003 | WP-26 | F-019, F-020, F-021 |
| WP-09 | F-049 | WP-27 | F-038 |
| WP-10 | F-014 | WP-28 | F-040, F-041 |
| WP-11 | F-043 | WP-29 | F-044, F-047, F-048 |
| WP-12 | F-046 | WP-30 | F-050 |
| WP-13 | F-034 | WP-31 | F-053, F-055 |
| WP-14 | F-035 | WP-32 | F-056 |
| WP-15 | F-029 | WP-33 | F-005, F-006, F-008, F-010, F-016, F-018, F-022, F-023, F-025, F-028, F-037, F-039 |
| WP-16 | F-030 | WP-34 | branch reconciliation (no finding — Appendix C gate) |
| WP-17 | F-031 | WP-35 | F-007, F-009, F-024, F-045, F-052 |
| WP-18 | F-042 | | |

**Coverage check:** 9 + 17 + 25 + 5 = **56**, every row of `findings.csv` assigned to exactly one package.

Layer order **within** any package: schema → authorization → server validation → repository → UI → tests →
hosted certification. Never the reverse.

---

## 6. SOURCING POLICY — WHERE THE WORK COMES FROM

**Four sources, in strict priority order.** Exhaust each before descending to the next, and say in the
commit body which one you used.

### Priority 1 — The repository's own failing tests

**15 tests fail on `main`** and several *specify the fix exactly*. Where a failing test defines the target
shape, **make that test pass — do not invent a different shape.**

```bash
node --test ./tests/*.test.mjs           # 756 tests, 742 pass, 14 fail
node --test ./tests/security/*.test.mjs  #  41 tests,  40 pass,  1 fail
```

The clearest example is **F-017**. `tests/webAppManifest.test.mjs` already dictates the manifest fix:

```js
// tests/webAppManifest.test.mjs:57  — 'every icon file referenced by the manifest exists'
assert.ok(manifest.icons.length >= 2);
for (const icon of manifest.icons) {
  assert.ok(existsSync(resolveAsset(icon.src)), `missing icon: ${icon.src}`);
  assert.match(icon.sizes, /^\d+x\d+$/);
  assert.equal(icon.type, 'image/png');
}
// :63 — a 192 and a 512 icon are present, which Chrome requires to install
// :68 — exactly one maskable icon, and it must be a distinct file from the plain one
```

That is the complete specification: ≥2 icons, all PNG, all resolving on disk, `192x192` and `512x512`
present, exactly one `maskable` that is a **different file** from the plain one.

**Caveat — some failing tests are wrong.** `tests/webAppManifest.test.mjs:24-25` also asserts
`manifest.name === 'FindIt Marketplace'` and `short_name === 'FindIt'`, which contradicts the rebrand and
contradicts `tests/peekaListingBrandContracts.test.mjs`. **Apply rule 5**: the icon assertions are correct
and are your specification; the brand assertions in that file are obsolete and belong to F-049. Fix the
icons to satisfy the test; fix the *test* for the brand strings.

### Priority 2 — Existing utilities and patterns on `main`

Reuse, never reinvent. Named inventory — check here before writing anything:

**Frontend (`src/lib/`):** `safeUrl.js` (render-time scheme allowlist) · `sanitizeText.js` ·
`phoneNumber.js` · `passwordPolicy.js` (min 10, upper+lower+digit) · `traceContext.js` (`x-request-id`
correlation — reuse for F-046) · `customerErrors.js` + `userFacingErrors.js` (user-facing error copy — reuse
for every new error string) · `browserStorage.js` (safe-degrading storage) · `featureFlags.js` ·
`contextualPermissions.js` (**already exists** — relevant to F-015) · `share.js` (relevant to F-043) ·
`marketConfig.js` · `query-client.js` · `serviceWorker.js` · `supabaseClient.js` (**the single Supabase
client entry — do not create a second one**).

**Database (`private.*` helper family, 47 functions).** Authorization helpers to reuse rather than
re-derive: `private.is_admin`, `private.is_super_admin`, `private.is_active_user`,
`private.can_read_listing_context`, `private.assert_peek_parent_owner`,
`private.assert_contact_reveal_budget`, `private.peek_request_parent_owner`,
`private.can_support_peek_request`, `private.is_peek_parent_public`, `private.has_valid_listing_upload_intent`,
`private.is_supported_listing_currency`, `private.is_country_publishable`.

**Templates to copy from:**

| Need | Template |
|---|---|
| New owner-scoped RPC | `supabase/migrations/0115_owner_contact_access_boundary.sql` |
| Adding a listing lifecycle action (F-029) | `owner_transition_listing` in `supabase/migrations/20260807030000_remove_listing_content_review_from_mvp.sql:34-80` — `p_action` allowlist at `:48`, per-action source-status guards at `:60-69` |
| Rate-limited, audited action | `0109_seller_contact_reveal_boundary.sql` (`v_limit = 40` / 24h at `:103,108`; `contact_reveal_events` audit trail) |
| New CI gate | The **11-script `scripts/verify-*.mjs` family**: `verify-base44-elimination`, `verify-build-budget`, `verify-built-boundary`, `verify-bundle-secrets`, `verify-deployment-security`, `verify-hosted-auth-hardening`, `verify-oauth-providers`, `verify-repository-hygiene`, `verify-source-graph`, `verify-sql-boundary`, `verify-workflow-pinning`. Match their exit-code and failure-message conventions exactly. |
| Behavioural (non-string) test | The 24 test files in `tests/` that import and exercise behaviour rather than `readFile`+`assert.match`. |

### Priority 3 — The 13 unreconciled branches, READ-ONLY

There are **13 branches carrying unique unmerged work**. Some of it is very likely the fix you are about to
write from scratch. Mine it — but **`git show` / `git diff` only.**

> **HARD RULE: never merge and never cherry-pick wholesale from these branches.** `develop` is **+434 / −155**
> divergent against `main`. Importing it would undo the MVP boundary (§2.3) and the security migrations
> `0109`/`0115`. Every port is a **deliberate, reviewed, retyped change onto `main` with its own test.**

| Branch | Ahead / Behind | Mine for |
|---|---:|---|
| `develop` | 434 / 155 | Largest delta. Search before writing anything new. **Highest contamination risk.** |
| `claude/repo-code-review-fu5wgc` | 403 / 201 | Review-era fixes — likely overlaps F-014, F-049 |
| `continuation/contract-gate-repair` | 382 / 201 | **Named for the F-013 problem.** Check first in WP-01. |
| `feature/peek-threads-phase-3` | 156 / 201 | Peek threads; seller queue routing (F-030) |
| `claude/findit-hardening-listing-012cf0` | 68 / 201 | Listing hardening |
| `integration/peek-fulfilment-journey-certification` | 15 / 49 | **Most recent unmerged work** (same day as `main` HEAD) — closest to current architecture |
| `preview/integration` | 13 / 155 | |
| `feature/contextual-permissions` | 12 / 201 | **F-015** — contextual camera permission work |
| `claude/base-rpc-boundary-repair` | 12 / 195 | RPC boundary |
| `brand/peekalisting-binoculars` | 11 / 195 | **F-001, F-017** — brand assets, possibly the raster icon set |
| `continuation/release-certification-ci` | 10 / 201 | **F-012, F-054** — CI/staging |
| `backup/main-pre-production-promotion-2026-08-05` | 9 / 201 | 9 unexplained unique commits |
| `release/production-readiness-2026-08-05` | 5 / 195 | |

Search pattern:

```bash
git log --oneline origin/main..origin/<branch> -- <path-of-interest>
git show origin/<branch>:<path>          # read the file as it exists there
git diff origin/main origin/<branch> -- <path>
```

Each candidate ends in **one of exactly two outcomes**, recorded in §8's decision table:
**PORTED** (retyped onto `main`, with a test) or **ABANDONED** (one-line reason).

### Priority 4 — New code

Only when 1–3 genuinely yield nothing. State that in the commit body.

---

## 7. WORK PACKAGES

Each package: **finding(s) · severity · track · evidence · source · files · proving test · acceptance.**

**Track labels:** **A** = in-repo, you execute it. **B** = human console only, you cannot execute it —
prepare and hand off (§9). **A→B** = you prepare in-repo, a human verifies or signs off externally.

---

## TRANCHE 0 — LAUNCH BLOCKERS (9 findings)

Nothing ships until every one of these is closed or has an explicit recorded decision.

---

### WP-01 — F-013 · P1 · Track A · **DO THIS FIRST**

**A single early gate failure causes lint, all four typechecks, the build, contracts and internal certification to skip.**

**Evidence.** `scripts/verify-sql-boundary.mjs:72`:

```js
if (/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(executable))
  failures.push(`${name} contains destructive table/data rollback statements`);
```

fires on `supabase/rollback/20260807020000_peek_request_fulfilment_lifecycle.rollback.sql:11`:

```sql
drop table if exists public.peek_request_fulfilments;
```

Reproduce locally — it exits 1:

```bash
node ./scripts/verify-sql-boundary.mjs
# 20260807020000_peek_request_fulfilment_lifecycle.rollback.sql contains destructive table/data rollback statements
```

In `.github/workflows/release-candidate-gates.yml`, that is step 10 (`Verify SQL migration boundary`,
`:100-101`). Steps 11, 13, 14, 16–24 then report `conclusion=skipped` — including
`Run all contracts` (`:118`), `Lint application` (`:139`), `Typecheck application` (`:142`),
`Typecheck active release surface` (`:148`), `Build production application` (`:154`) and
`Run reproducible internal certification` (`:160`). Note that three steps in that file **already** use
`if: always()` (`:107`, `:128`, `:164`) — for artifact upload only. The pattern is present; it is simply not
applied to the verification steps.

**Root cause:** RC-1.

**Source.** Priority 3 first: `continuation/contract-gate-repair` (+382) is named for exactly this. Then
priority 2: match the existing `if: always()` usage already in the file.

**Two independent changes — make both:**

1. **Structural (the real fix).** Add `if: always()` to every *independent* verification step so one failure
   cannot mask the rest. Steps that genuinely depend on a predecessor (anything after `npm ci`; anything
   consuming `dist/`) keep their ordering. The job must still fail overall if any step failed — verify that,
   because `if: always()` on a step does not by itself change job conclusion, but a later step's own failure
   must not be swallowed either.
2. **The specific conflict.** Decide, and record the decision in the commit body:
   - **(a)** Allow `drop table` in a rollback for a table the *paired migration created* — the honest reading,
     since `20260807020000_peek_request_fulfilment_lifecycle.sql` creates `peek_request_fulfilments` and its
     rollback is supposed to reverse exactly that; or
   - **(b)** Rewrite the rollback in a non-destructive form.
   The audit does **not** adjudicate which is right. Pick one, justify it, and make the gate and the
   rollback agree. If you choose (a), the exemption must be narrow — a table created by the paired
   migration — not a blanket relaxation of the destructive-statement rule.

**Files.** `.github/workflows/release-candidate-gates.yml`; `scripts/verify-sql-boundary.mjs` *or*
`supabase/rollback/20260807020000_peek_request_fulfilment_lifecycle.rollback.sql`. Apply the same
`if: always()` review to the other four failing workflows (Release Certification, Migration gates, Deploy
staging to GitHub Pages, GitHub Pages Preview).

**Proving test.** A CI run on this branch in which `Lint application`, `Typecheck application` and
`Build production application` all report a conclusion **other than `skipped`**. Locally,
`node ./scripts/verify-sql-boundary.mjs` exits 0.

**Acceptance.** Every verification step executes. The pipeline's report is now trustworthy — which is the
precondition for every package after this one.

---

### WP-02 — F-012 · P1 · Track A→B · depends on WP-01

**All 5 quality and deployment workflows fail at `main` HEAD, with 0 successes across the last 30 runs.**

**Evidence.** GitHub Actions API, `branch=main`, run `31131784052` at `ee6f212`
("Merge pull request #32 from integration/final-release-certification"): *Release candidate gates* =
failure, *Release Certification* = failure, *Migration gates* = failure, *Deploy staging to GitHub Pages* =
failure, *GitHub Pages Preview* = failure. Across the last 30 runs on `main`, **each of these workflows
shows 0 success.**

**Root cause:** RC-1, compounded by the absence of branch protection requiring these checks.

**Source.** Priority 1 — with WP-01 done, the pipeline now tells you what is actually broken. Work the real
list it produces. Expect at minimum the 10 typecheck errors of **F-014** and the 15 failing tests of
**F-049**; sequence those packages here as the gate demands them.

**Files.** Whatever the now-visible failures name. Do not pre-guess.

**Proving test.** A **green** `Release candidate gates` run on `main`.

**Acceptance (A).** All five workflows green on `main`.
**Hand-off (B).** Once green, a repository admin makes these workflows **required status checks** on `main`
(Settings → Branches → branch protection rule for `main` → *Require status checks to pass before merging*,
selecting all five). Track this as **B-7** in §9. Without it, the same class of failure merges again.

---

### WP-03 — F-054 · P1 · Track A→B · depends on WP-01

**Staging deployment is failing, so the environment the entire capability model depends on is not being built.**

**Evidence.** *Deploy staging to GitHub Pages* shows 0 success / 3 failure / 1 cancelled across the last 30
runs on `main`, and fails at `ee6f212` (`.github/workflows/deploy-staging-pages.yml`).
`src/lib/stagingCapabilityPolicy.js:37-39` enables **messaging, notifications, Peeks and current-location**
only in a trusted staging environment. So: those capabilities can only be exercised in staging, and staging
is not being built — which blocks the Peek release acceptance that WP-08 depends on.

**Root cause:** RC-1 + RC-6.

**Source.** Priority 3: `continuation/release-certification-ci` (+10). Then priority 1: the workflow's own
error output once WP-01 stops it being masked.

**Files.** `.github/workflows/deploy-staging-pages.yml` and whatever it reveals.

**Proving test.** A green staging deploy, followed by loading the deployed staging origin and confirming
`/peek`, messaging and notifications render.

**Hand-off (B).** Confirm GitHub Pages is enabled for the repo and the environment's secrets/variables are
present. See **B-7**, §9.

---

### WP-04 — F-027 · P1 · Track A · **independent — start immediately**

**MFA is enforced only in the browser. No assurance-level check exists in any policy, function or trigger, so an aal1 token reaches every admin RPC directly.**

**Evidence.** `src/App.jsx:115-132` (`useMfaGate`) and `src/components/auth/MfaChallengeScreen.jsx` gate
**what React renders**. The gate calls `src/services/authService.js:159-165`:

```js
export async function mfaChallengeRequired() {
  const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
  if (currentLevel !== 'aal1') return false;
  if (nextLevel === 'aal2') return true;
  const verified = await listVerifiedTotpFactors();
  return verified.length > 0;
}
```

**A search of all 159 migrations for `aal1`, `aal2`, `assurance` and `amr` returns zero matches.** No RLS
policy, no `SECURITY DEFINER` function and no trigger inspects the assurance level. `private.is_admin()`
tests role membership only. Supabase issues the claim and it is readable in SQL as `auth.jwt() ->> 'aal'` —
the control is available and simply unused.

**Attack.** An attacker with a compromised admin password signs in, receives a valid **aal1** session, is
shown the MFA challenge screen — and simply does not use the SPA:

```
POST /rest/v1/rpc/<admin_function>
Authorization: Bearer <aal1 access token>
```

Every server-side check passes, because none require aal2. Blast radius is the whole trust and safety
surface: user suspension and ban, listing and service takedown, Peek removal, conversation action, verified-
business decisions.

**Why P1 and not P0:** it requires prior credential compromise. **Treat it as P0 if MFA is being relied on
as the compensating control for admin password compromise** — if so, stop and report per rule 10.

**Root cause:** RC-2.

**Source.** Priority 2 — extend the existing `private.*` helpers rather than adding a parallel check.

**Fix shape.** Require `auth.jwt() ->> 'aal' = 'aal2'` inside `private.is_admin()` and
`private.is_super_admin()` **for accounts that hold a verified factor**, or add an `aal2` predicate to the
admin RLS policies and the prelude of every admin RPC. The factor-conditional matters: an unconditional
`aal2` requirement locks out any admin who has not enrolled. Handle enrolment and recovery explicitly.

**Files.** A new migration + paired rollback amending the two helpers. Also make `/reset-password` continue
to work — `src/App.jsx:146` exempts it from the client gate and that exemption is correct and must stay.

**Proving test.** pgTAP asserting an admin RPC called with an **aal1** JWT is denied while the same call
with **aal2** succeeds. Add it under `supabase/tests/`.

**Acceptance.** Appendix C gate *"MFA cannot be route-bypassed"* moves **FAIL → PASS**.

---

### WP-05 — F-033 · P2 (LIKELY) · Track A · **independent — start immediately**

**No EXIF/GPS stripping on listing images, which defeats the deliberate coordinate coarsening.**

**Evidence.** `supabase/migrations/0049_listing_location_privacy_and_public_projection.sql` deliberately
separates `public_latitude`/`public_longitude` from the exact coordinates held in
`listing_private_locations` — the raw `latitude`/`longitude` columns are **not** in the 35-column anon
allowlist. But no strip or re-encode step for still-image EXIF exists in
`supabase/functions/listing-image-upload/index.ts` or
`supabase/functions/marketplace-image-upload/index.ts`. The Peek **video** pipeline produces derivatives
(implying re-encode); the **still** path does not.

**Impact.** A phone photo commonly embeds GPS accurate to a few metres. Anyone can download a public listing
image and read the exact location of an occupied home — defeating the coarsening control entirely. Physical
safety, not just privacy.

**Confidence note.** Marked **LIKELY**, not CONFIRMED: the *absence of a strip step* is evidenced; the
*presence of GPS in served objects* needs a hosted check. **Do that check first** — upload a known-geotagged
fixture, fetch the public URL, read its EXIF. If GPS survives, this is confirmed and Tranche 0.

**Root cause:** RC-2.

**Source.** Priority 4 is likely here, but check priority 3 (`develop`) for an existing strip step first.

**Fix shape.** Strip all EXIF (or fully re-encode) server-side on upload, in the Edge Function, **before**
the object becomes readable. Client-side stripping is not sufficient — PostgREST and direct storage uploads
bypass the client.

**Files.** `supabase/functions/listing-image-upload/index.ts`,
`supabase/functions/marketplace-image-upload/index.ts`. Coordinate with **WP-18 (F-042)** — if you add
server-side derivative generation there, the re-encode can strip EXIF as a side effect; do it once, not twice.

**Proving test.** Upload a fixture with known GPS EXIF; assert the served object contains **no** GPS tags.
Commit the fixture.

**Acceptance.** Appendix C gate *"EXIF/GPS posture safe"* moves **FAIL → PASS**; *"Exact property location
safe"* moves PARTIAL → PASS.

---

### WP-06 — F-011 · P1 · Track A→B · **REQUIRES PROFESSIONAL REVIEW**

**The live Privacy Policy and Terms contain unfilled `[TO BE COMPLETED]` placeholders — including the operator's legal name and registered address.**

**Evidence.** `src/lib/legalContent.js` — **7 placeholders, all reachable in the live documents**:

| Line | Placeholder |
|---:|---|
| `:22` | *"FindIt is operated by **[TO BE COMPLETED: operator legal name]**, registered at **[TO BE COMPLETED: registered address]**. Privacy questions … can be sent to **[TO BE COMPLETED: privacy contact email]**"* |
| `:105` | transfer mechanism and provider contracts for international transfer |
| `:116` | *"confirm exact retention periods for each category …"* |
| `:197` | processor review and signed data-processing terms |
| `:215` | *"These terms are an agreement between you and **[TO BE COMPLETED: operator legal name]**, registered at **[TO BE COMPLETED: registered address]**"* |
| `:292` | whether an aggregate liability cap is stated, and its amount |
| `:299` | whether a mediation or arbitration step precedes litigation |

`src/lib/legalContentOverrides.js:1-11` overrides only two deletion/export paragraphs and does **not** touch
any of these. Reproduce: navigate to `/legal/privacy` and `/legal/terms` and read sections 1 and 11
(`src/pages/LegalPage.jsx:15-16,42`).

**Impact.** The binding user agreement and privacy notice identify **no operating entity and no address**,
and state **no retention periods**, on a service that collects identity documents and a selfie for business
verification. Publishing in this state is a launch-gating legal exposure.

**Track split.**
- **B (human + counsel):** supply operator legal name, registered address, privacy contact email, retention
  periods per data category, the international-transfer mechanism, the liability-cap decision, and the
  dispute-resolution step. **These are legal conclusions and are out of your scope to invent. Do not
  fabricate a company name, an address or a retention period.**
- **A (you):** once supplied, apply them; then add the contract test below so the placeholders can never
  reappear.

**Proving test.** A contract test asserting no `/\[TO BE COMPLETED/` string is reachable from
`legalDocuments` in `src/lib/legalContent.js` after `legalContentOverrides.js` is applied. **Write this test
now, in this package** — it will fail until B lands, which is the correct state, and it makes the blocker
visible in CI rather than in someone's memory.

**Note.** F-048 (self-service data export) also depends on the retention/rights language settled here.

---

### WP-07 — F-001 + F-002 · P2 + P2 · Track A · depends on WP-06

**The customer-facing product name is still FindIt across ~60 files (111 occurrences) — including the entire live legal corpus — and the brand contract test checks 3 files and passes green.**

**Evidence (F-001).** `src/lib/legalContent.js:16-398` (whole legal corpus) ·
`src/pages/LegalPage.jsx:50-98` · `src/components/pwa/InstallPrompt.jsx:108` *"Add FindIt to your home
screen"* · `src/components/pwa/GlobalRefreshButton.jsx:20-30` · `src/components/auth/AccountBlocked.jsx:35` ·
`src/components/auth/GuestPromptSheet.jsx:19,41` · `src/components/AppErrorBoundary.jsx:31` *"FindIt could
not display this screen"* · `src/components/layout/SiteFooter.jsx:32` *"© {year} FindIt"* ·
`src/components/layout/TopNav.jsx:43` · `src/components/listings/ContactButtons.jsx:157-250` ·
`src/components/settings/DeleteAccountSection.jsx:78`.

**Evidence (F-002).** `tests/peekaListingBrandContracts.test.mjs` (52 lines total) reads only
`src/components/BrandLogo.jsx`, `index.html`, `public/manifest.webmanifest`, `src/main.jsx`,
`public/push-sw.js`, `public/sw.js` and `src/pages/FAQs.jsx`. A FindIt-absence assertion exists in exactly
**three** of those seven: `:13` `assert.doesNotMatch(logo, />Find</)`, `:32`
`assert.doesNotMatch(startup, /FindIt/)`, `:51` `assert.doesNotMatch(faq, /FindIt/)`. It passes green with
**111 occurrences across ~60 files** present. The commit that added it reads
*"test: lock canonical PeekaListing identity"*.

> **Citation correction.** `audit/findings.csv` records this evidence as `:1-56` with assertions at `:34`
> and `:56`. The file is **52 lines** and the assertions are at `:13`, `:32` and `:51`. The substance of the
> finding is exactly right — 7 files read, 3 asserted, green while 111 occurrences remain — only the line
> numbers drifted. Use the numbers above. This is rule 1 working as intended: open the citation, confirm it,
> record the deviation.

**Root cause:** RC-4. This is the archetype of the whole class: a control that reports success over a surface
it does not cover.

**Source.** Priority 3: `brand/peekalisting-binoculars` (+11) may already carry copy. Then priority 2 for
error-copy conventions (`customerErrors.js` / `userFacingErrors.js`).

**Do NOT rename:**
- CSS custom properties `--findit-*`
- Browser storage keys `__findit_*` (renaming orphans every existing user's local state)
- The repository name `findit-marketplace`
- `deleteFindItCaches()` in the service worker — it exists **to clean up legacy caches** and must keep the
  old name to find them (Appendix C: *"Legacy FindIt caches upgrade safely" = PASS*)

**Order matters.** WP-06 first — the legal text is ~60% of the occurrences, and rewriting it twice is waste.

**Proving test.** Extend `tests/peekaListingBrandContracts.test.mjs` to walk **all of `src/`** asserting no
user-visible `/FindIt/` outside an explicit allowlist (CSS vars, storage keys, `deleteFindItCaches`).
**It must fail on current `main`** — demonstrate that before fixing F-001. A test that passes before the fix
is F-002 all over again.

**Acceptance.** Appendix C gate *"Active branding is PeekaListing"* moves **FAIL → PASS**.

---

### WP-08 — F-003 · P1 · Track B (decision) + A (prep) · depends on WP-03

**Public Peeks — the stated core differentiator — are gated off in every production configuration path in the repository, and release acceptance is unevidenced.**

**Evidence.** `src/lib/featureFlags.js:25` — `tours: stagingCertifiedFlag('VITE_FEATURE_TOURS')`.
`src/App.jsx:171-172` — the `/peek` route is rendered **only** when `(tours || toursPreview)`.
`.env.example:40` and `docs/ENVIRONMENT_VARIABLES.md:27`: *"True only for an accepted Peek release."*
`docs/TOURS_RELEASE_ACCEPTANCE.md:13`: *"in staging only."*
With the flag false, `/peek` does not exist — **a product defined by Peeks would launch without them.**

**This is not a code defect.** It is a deliberate release gate awaiting acceptance. The remedy is a
**decision**, and it must be made explicitly rather than by default.

**Two acceptable outcomes — one must be recorded:**
1. Complete and evidence Peek release acceptance per `docs/TOURS_RELEASE_ACCEPTANCE.md` (requires WP-03:
   staging must build before anything can be certified in it), then set `VITE_FEATURE_TOURS` for Production
   in Vercel — see **B-3**, §9.
2. Record an explicit, dated, signed decision to launch **without** Public Peeks, and update the product
   copy accordingly — because the manifest description and marketing currently promise them.

**Prep you can do now (A).** Run the acceptance checklist against staging as soon as WP-03 lands; produce
the evidence pack the decision needs.

**Proving test.** A hosted check that `/peek` returns the Peek catalogue on the production origin (outcome 1),
or a committed decision record (outcome 2).

**Acceptance.** Appendix C gate *"Public discovery works"* resolves **FAIL → PASS** or → **N/A (recorded
decision)**. Never leave it silently FAIL.

---

## TRANCHE 1 — STRONGLY RECOMMENDED PRE-LAUNCH (17 findings)

Per `findings.csv`: F-004, F-014, F-015, F-017, F-026, F-029, F-030, F-031, F-034, F-035, F-036, F-042,
F-043, F-046, F-049, F-051, F-057.

---

### WP-09 — F-049 · P2 · Track A · depends on WP-02

**Obsolete tests assert a removed Peek moderation step and the old brand — contradicting current product decisions and each other.**

**Evidence.** Failing test `508 - seller queue reuses the existing uploader and waits for moderation before
answering` asserts a **human Peek moderation step the MVP removed** (§2.3). Failing test `34 - the polished
FindIt identity is present across app shells and install metadata` asserts the **old brand** and directly
contradicts `tests/peekaListingBrandContracts.test.mjs`. Also failing: `684` / `686` (admin report queue
exposes Tour identity) and `695` (staging deployment can expose preview or public Tours) — legacy Tours
release model. `tests/webAppManifest.test.mjs:24-25` asserts `name === 'FindIt Marketplace'`.

**The suite cannot go green without deleting contradictory assertions** — which means fixing it forces a
product decision. The decision is already made (§2.3); apply it.

**Rule.** Delete or rewrite tests asserting removed moderation and the old brand. Keep **one** authoritative
brand contract — the extended one from WP-07. **Do not delete a test merely because it fails**: `155`
(owner lifecycle), `22` (image loading/decoding) and `62` (storage degradation) are *correct* tests failing
against *real* defects — they belong to F-029, F-042 and a resilience gap respectively, and must stay red
until those are fixed.

Assessed as a **stale assertion rather than a regression**: security test `31 - admin routes are nested
beneath a required admin role boundary`. Phase 4 verified directly that all 10 admin routes are nested under
`ProtectedRoute requiredRole="admin"` (`src/App.jsx:199-211`) with server-side role resolution. Fix the
assertion, not the routing.

**Proving test.** Suite green on `main` with a single authoritative brand assertion, and with the
still-legitimate failures accounted for by their own packages.

---

### WP-10 — F-014 · P2 · Track A · depends on WP-01

**`typecheck` and `typecheck:active` fail on `main` with 10 errors, unreported because CI never reaches those steps.**

**Evidence.** `npx tsc -p ./jsconfig.json` exits 2 with 10 `error TS` diagnostics;
`node ./scripts/active-v1-typecheck.mjs` also fails. Errors are in
`src/components/peekThreads/BuyerPeekRequestsQueue.jsx:112,115,117,119,126` and
`src/pages/BusinessProfiles.jsx:26,33,75`. Example:

```
BuyerPeekRequestsQueue.jsx(117,27) TS2698: Spread types may only be created from object types
  setResponseTarget({ ...item, fulfilment: { ...item.fulfilment, status: 'accepted' } })
```

**Cause.** `useMutation` calls lack explicit generics, so TanStack Query defaults `TVariables` to `void`
when the `mutationFn` parameter cannot be inferred. These are **type-soundness gaps, not proven runtime
defects** — do not report them as runtime bugs.

**Fix.** Add explicit `useMutation` generics or JSDoc `@type` annotations for the mutation variables.

**Proving test.** `npm run typecheck` and `npm run typecheck:active` both exit 0 on `main`.

---

### WP-11 — F-043 · P1 · Track A

**No per-route metadata, OG tags or prerendering, so every shared listing produces an identical blank preview.**

**Evidence.** `index.html` contains **zero** `og:` or `twitter:` tags. No `document.title` assignment, no
metadata library, no SSR/prerender step exists anywhere in `src/` or `vite.config.js`. Every route serves
the same static head. Reproduce: `curl` a `/property/<id>` URL and inspect the head; or paste a listing URL
into WhatsApp.

**Impact.** WhatsApp is a dominant sharing channel here (§2.4) and **every** listing unfurls as a generic
card with no title, price, location or photo. Google sees every listing as a duplicate of the shell, with no
title, description or canonical, and no structured data.

**Root cause:** RC-5. This is the single largest product-visible gap outside Tranche 0.

**Source.** `src/lib/share.js` already exists — it produces the URL; what is missing is what the URL
*resolves to* for an unfurler.

**Fix shape.** Per-route metadata (title, description, canonical, `og:*`, `twitter:*`) **plus** prerender or
server-render for listing routes. Client-side `document.title` alone does **not** fix unfurling — WhatsApp
and most crawlers do not execute the SPA. The prerender/SSR half is the part that matters.

**Files.** `index.html`, a metadata layer in `src/`, `vite.config.js` (prerender step), `vercel.json`
(routing must keep the SPA rewrite at `:5-10` intact for app routes).

**Proving test.** A test asserting a listing route serves a `<title>` and an `og:image` matching the listing.

**Acceptance.** Appendix C gates *"Listing metadata proven"*, *"Canonical URLs correct"* and
*"WhatsApp preview acceptable"* all move **FAIL → PASS**.

---

### WP-12 — F-046 · P1 · Track A

**No frontend error reporting exists, so browser failures are invisible to operators.**

**Evidence.** Neither `package.json` nor any file in `src/` references Sentry or any error-reporting SDK.
The only production visibility is 4 deliberately retained `console.error` call sites
(`vite.config.js:54-57` strips the rest).

**Impact.** A render error, a bootstrap failure, a post-deploy chunk-load failure, or a failed Peek upload on
a seller's phone produces **no signal at all**. Breakage is learned only from user reports — and for a
marketplace launching into intermittent connectivity, that is the majority of real failures. Server-side and
database observability is by contrast thorough, which makes the browser the single blind spot.

**Root cause:** RC-5.

**Source.** Priority 2 — `src/lib/traceContext.js` already produces `x-request-id` correlation. Wire the
reporter to the **same** correlation id so a browser error joins up with its server-side trace.

**Fix shape.** A frontend error reporter with **authenticated** source-map upload (source maps are currently
off — `vite.config.js:48`; do not make them public), wired to `src/components/AppErrorBoundary.jsx`, the
bootstrap catch in `src/main.jsx:43-45`, and the upload paths. Respect the existing "no sensitive PII in
logs" posture (Appendix C: PASS) — scrub before send.

**Proving test.** A test asserting a thrown render error produces a reporter call.

---

### WP-13 — F-034 · P2 · Track A→B

**The Turnstile Edge Function is deployed but never invoked from the frontend.**

**Evidence.** `supabase/functions/verify-turnstile/index.ts` exists and reads `TURNSTILE_SECRET_KEY`,
`TURNSTILE_ALLOWED_ORIGINS` and `TURNSTILE_ALLOWED_HOSTNAMES`. **Grepping all of `src/` for `turnstile`
returns nothing.** No signup, listing creation, contact reveal or report flow presents a challenge.

**The server half is already written** — this is an integration gap, not new work.

**Fix shape.** Wire the Turnstile widget into **signup at minimum**, and into contact reveal and reporting,
passing the token to the existing Edge Function.

**Proving test.** A test asserting signup without a valid Turnstile token is rejected.

**Hand-off (B).** The Turnstile site key/secret must be provisioned and the allowed hostnames configured —
see **B-5** (E-005), §9. Do not mark this PASS on the strength of the code alone.

---

### WP-14 — F-035 · P2 · Track A · depends on WP-13

**The contact-reveal cap is per account while account creation is unprotected, so scraping scales linearly with free accounts.**

**Evidence.** `supabase/migrations/0109_seller_contact_reveal_boundary.sql:103,108` —
`v_limit constant integer := 40` counted against `contact_reveal_events` within `interval '24 hours'`,
scoped to the calling user. `0109`'s own header calls contact harvesting *the primary real-world abuse
target for a classifieds marketplace*.

**Arithmetic.** With free unchallenged signup (F-034), **25 accounts yield 1,000 seller contacts per day,
entirely within policy.** `contact_reveal_events` records the harvest *after the fact* rather than
preventing it.

**The per-account cap and the audit trail are correct as far as they go** — do not remove or weaken them
(§3.3). Add a second dimension.

**Fix shape.** Turnstile on signup (WP-13) **plus** a second cap keyed on IP or device alongside the
per-account cap. Consider alerting on reveal-rate anomalies in `contact_reveal_events`.

**Proving test.** A test asserting reveals are throttled across multiple accounts originating from one source.

---

### WP-15 — F-029 · P2 · Track A

**Sellers cannot mark a listing sold. The only terminal action is `unavailable`.**

**Evidence.** `owner_transition_listing` restricts `p_action` at
`supabase/migrations/20260807030000_remove_listing_content_review_from_mvp.sql:48`:

```sql
if p_action not in ('submit', 'pause', 'resume', 'unavailable') then
```

The `listing_status` enum (`supabase/migrations/0001_extensions_and_enums.sql:15`) contains **`sold`**,
**`rented`** and **`under_offer`** — and no migration or client path ever writes them. Corroborated by the
repository's own failing test `155 - owner journey supports edit pause resume relist unavailable and
permanent delete`.

**Impact.** A marketplace cannot record the outcome that matters most. Sold and withdrawn collapse into one
state, so buyers lose the signal that an asset actually transacted, sellers cannot close a listing honestly,
and the product loses its only free measure of whether it is working. For property and vehicles, a stale
"live" listing that was actually sold is a direct trust problem.

**Source.** Priority 2 — extend `owner_transition_listing` following its own structure: add to the `p_action`
allowlist at `:48`, then add the source-status guard alongside `:60-69`. **Do not alter the ownership
predicate or the `FOR UPDATE` lock** (§3.3).

**Fix shape.** Add `sold` (and `rented` for rental listings) with the matching UI affordance in
`/my-listings` and the correct public treatment — a sold listing must leave public search.

**Proving test.** pgTAP asserting an owner can transition `available → sold` **and** that sold listings leave
public search. Plus making failing test `155` pass.

---

### WP-16 — F-030 · P2 · Track A

**The seller's new-Peek-Request notification deep-links to the buyer page, and no top-level seller queue route exists.**

**Evidence.**
`supabase/migrations/20260804191200_allow_peek_request_alert_events_and_fix_count.sql:44` inserts the alert
for the listing **owner** with `link = '/peek-requests'`. `src/App.jsx:191` routes `/peek-requests` to
`src/pages/BuyerPeekRequests.jsx` — **the buyer-side page**. No route resolves to a seller fulfilment queue;
the seller components are `BuyerPeekRequestsQueue` and `ResponsePeekBindingQueue`, reached from elsewhere.

**Impact.** This is the entry point of the product's core differentiating journey. A seller notified of a
buyer's Peek Request follows the link and may land on a page that does not show the request. A dead-ending
deep link at exactly the most fragile moment of the loop.

**The underlying `accept_peek_request` authorization is correct** — this is routing only.

**Source.** Priority 3: `feature/peek-threads-phase-3` (+156) is the Peek Threads work and may already have
the route.

**Fix shape.** Add a dedicated seller queue route; point the owner alert at it (new migration + rollback).

**Proving test.** A test asserting the owner alert's link resolves to a route that renders the seller
fulfilment queue.

**Acceptance.** Appendix C gate *"Deep links valid"* moves **FAIL → PASS**.

---

### WP-17 — F-031 · P2 · Track A

**Messaging has no realtime transport and no refetch on focus or reconnect, so new messages can go unseen.**

**Evidence.** `vite.config.js:70` aliases `@supabase/realtime-js` to `src/lib/noRealtimeClient.js`, a stub
that **throws** if `.channel()` is called; Realtime is disabled in `supabase/config.toml`.
`src/lib/query-client.js:6-11` sets `staleTime: 30 min`, `gcTime: 1 h`, `refetchOnWindowFocus: false`,
`refetchOnReconnect: false`, `retry: 1`.

**Impact.** A buyer or seller can sit on an open conversation and not see a reply until they navigate. In a
market where WhatsApp is the competing channel and connectivity is intermittent, silent message latency
pushes users off-platform — which also defeats the contact-privacy boundary the product works hard to
maintain.

**Both decisions are deliberate** (§3.4). The gap is that **nothing replaced Realtime.** Do not revert either
decision globally.

**Fix shape — pick one and justify it:** (a) enable `refetchOnWindowFocus` + `refetchOnReconnect` **for
conversation queries only**; (b) interval-poll the active thread; (c) restore Realtime **for messaging only**
and measure the bundle delta against the rationale in `vite.config.js:73-77`. Option (a) is the smallest
change consistent with the low-bandwidth intent.

**Note.** The same 30-minute staleness means a buyer can act on a listing that was sold or withdrawn up to
30 minutes earlier. Once WP-15 lands, consider whether listing-detail queries need the same treatment.

**Proving test.** A test asserting an inbound message appears within a bounded interval without manual
navigation.

**Acceptance.** Appendix C gate *"Realtime/polling understood"* moves **FAIL → PASS**.

---

### WP-18 — F-042 · P2 (LIKELY) · Track A

**No evidence of server-side image derivatives or `srcset` for listing stills.**

**Evidence.** `listing_upload_intents` records `mime_type` and `byte_size` but no derivative generation was
found for still images in `supabase/functions/listing-image-upload/index.ts`, and no `srcset`/`sizes`
attributes were located in `src/components/listings/`. The **Peek** pipeline does produce 720p derivatives
and webp thumbnails — the stills pipeline does not. Corroborated by the repository's own failing test
`22 - every JSX image declares loading and asynchronous decoding behavior`.

**Impact.** Grids likely serve full-size camera uploads — on 3G, the single largest avoidable cost on the
most-used screen in the product.

**Coordinate with WP-05 (F-033):** server-side re-encoding for derivatives strips EXIF as a side effect. Do
the work once.

**Proving test.** A test asserting a grid image request returns a derivative smaller than the original, plus
making failing test `22` pass.

**Acceptance.** Appendix C gate *"Card derivatives not originals"* moves **FAIL → PASS**.

---

### WP-19 — F-017 · P2 · Track A · depends on WP-07

**The PWA manifest ships a single SVG icon with no `apple-touch-icon`, no raster PNG and no maskable purpose — and a contract test locks it in.**

**Evidence.** `public/manifest.webmanifest:24-31` — the `icons` array contains exactly one entry,
`/brand/peekalisting-binoculars.svg`, `sizes: "any"`, `purpose: "any"`. `index.html:26-27` declares
`rel=icon` and `rel=mask-icon` but **no `rel=apple-touch-icon`**.
`tests/peekaListingBrandContracts.test.mjs:24` asserts
`manifest.icons.every(icon => icon.src === '/brand/peekalisting-binoculars.svg')` — **the test would fail
any correct fix.**

**Impact.** iOS ignores the manifest for home-screen icons and needs a PNG `apple-touch-icon`, so *Add to
Home Screen* yields a blank or screenshot icon on iPhone and iPad. Android adaptive masking crops or
letterboxes the mark, and the splash screen has no raster source. The product is mobile-first and *actively
prompts installation* (`src/components/pwa/InstallPrompt.jsx`), so this hits the primary install path.

**Source — priority 1. `tests/webAppManifest.test.mjs` is your specification** (§6). Required: ≥2 icons, all
`image/png`, all resolving on disk, `192x192` and `512x512` present, exactly one `maskable` that is a
**distinct file** from the plain one. Plus a 180px `apple-touch-icon` link in `index.html`.

**Asset note.** `public/brand/findit-icon-{32,64,180,192,512}.png`, `findit-mark.png` and
`findit-maskable-512.png` are **the right sizes but the wrong brand**, and are unreferenced (F-018,
~340 KB). **Reissue them as PeekaListing-branded PNGs to resolve this finding, then delete the FindIt
originals** — that closes F-017 and F-018 together. Check `brand/peekalisting-binoculars` (+11) first; the
raster set may already exist there.

**Also fix:** relax `tests/peekaListingBrandContracts.test.mjs:24` to assert **brand correctness**, not an
exact single-source icon list. And correct `tests/webAppManifest.test.mjs:24-25`, which still asserts the
FindIt name (that half belongs to WP-09).

**Proving test.** Failing tests `748`, `750`, `751`, `752` all pass; `index.html` declares an
`apple-touch-icon`.

---

### WP-20 — F-026 · P2 · Track A

**`peek_requests.moderation_status` defaults to `'pending'` while the live contract requires `'approved'`, so any insert path omitting it strands the request invisibly.**

**Evidence.** `supabase/migrations/0116_peek_threads_foundation.sql:96` declares
`moderation_status text not null default 'pending'`. The current create RPC explicitly inserts `'approved'`
(`20260804191200_allow_peek_request_alert_events_and_fix_count.sql:41`). The public read policy requires
`moderation_status = 'approved'`, and `accept_peek_request` rejects anything else at
`20260807020000_peek_request_fulfilment_lifecycle.sql:24`.

**Impact.** A Peek Request created by any path that does not explicitly set `moderation_status` is invisible
to the public thread **and** cannot be accepted by the seller — it strands with **no error surfaced to the
buyer**. The current RPC path is correct; this is a latent hazard on every other insert path (admin tooling,
a future RPC, a backfill).

**Root cause:** RC-4 — legacy moderation vocabulary retained as the column default after the MVP removed
human Peek approval (§2.3).

**Fix shape.** Change the default to `'approved'`, **or** drop `moderation_status` from `peek_requests`
entirely now that no human approval step exists. Dropping it is the cleaner read of the MVP boundary; the
default change is the smaller blast radius. Either way this is a migration + paired rollback.

**Proving test.** pgTAP asserting a `peek_requests` insert that **omits** `moderation_status` is still
publicly readable and acceptable by the owner.

---

### WP-21 — F-036 · P2 · Track A

**Price sorting and range filtering compare raw numbers across currencies with no normalised sort key.**

**Evidence.** `supabase/migrations/0004_listings.sql` — `price numeric(14,2)` with `currency` as a sibling
column and **no normalised column** such as `price_usd` written at submission.
`src/lib/featureFlags.js:46` — `currencyConversion` defaults false. An `exchange_rates` table exists but is
not applied to search ordering (`src/repositories/publicListingsRepository.js`).

**Impact.** A price-ascending sort over a mixed-currency result set ranks 500 in one currency against 500 in
another, so buyers see a **false ordering** and cheap-looking listings that are not cheap. In this market,
currency choice is itself meaningful information (§2.4) — this is a trust problem, not a cosmetic one.

**Money typing and per-row currency are otherwise correct** — do not change the `numeric(14,2)` type or
collapse the per-row currency.

**Fix shape.** Write a normalised sort key at submission using `exchange_rates`, **or** scope result sets to
a single currency per country context and label the sort accordingly. If you normalise, decide and document
what happens when a rate is stale.

**Proving test.** A test asserting a mixed-currency result set orders by normalised value, **or** that the UI
prevents mixed-currency ordering.

---

### WP-22 — F-051 · P2 · Track A · depends on WP-09

**No browser or E2E framework, so the highest-value end-to-end journey is never executed.**

**Evidence.** `package.json` has no Playwright or Cypress dependency. The journey — signup → create listing →
immediate publish → search → detail → contact or Peek request → seller fulfilment → buyer result — is
executed **nowhere**.

**Impact.** Every cross-boundary integration failure between UI, RPC, RLS, storage and worker can only be
found in production.

**Environment note.** **Chromium and Playwright are already available in this execution environment**
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`). **Do not run
`playwright install`.** If a pinned `@playwright/test` version disagrees, launch with
`executablePath: '/opt/pw-browsers/chromium'`.

**Fix shape.** Add Playwright and implement **the single highest-value journey first**. One real journey
beats ten shallow ones. Depends on WP-09 because adding coverage to a contradictory suite compounds the
problem.

**Proving test.** The full buyer-to-seller journey executing green in CI.

---

### WP-23 — F-004 · P2 · Track A

**Capability gating trusts a client-readable hostname prefix.**

**Evidence.** `src/lib/stagingCapabilityPolicy.js:10,21-29,37-39`:
`STAGING_HOST_PREFIX = 'findit-marketplace-stagi'`; `isTrustedStagingHost()` reads
`globalThis.location.hostname`; `resolveStagingCertifiedFlag` returns
`isTrustedStagingEnvironment(env) || readBooleanFlag(...)`.

**Impact.** Any deployment served from a hostname matching `findit-marketplace-stagi*.vercel.app`
auto-enables **messaging, notifications, Peeks and current-location** regardless of build-time env. The trust
decision is made from **browser-visible state**.

**Scope note.** This is capability exposure, **not** an auth bypass — every underlying operation is still
RLS- and RPC-authorized. Do not overstate it. But an authorization-adjacent trust signal should not come from
`location.hostname`.

**Fix shape.** Decide capabilities at **build time from env only**; drop the hostname branch.

**Proving test.** A unit test asserting `isTrustedStagingEnvironment` ignores `location.hostname`.

**Related.** F-006 (Tranche 2) prunes the stale `TRUSTED_STAGING_BRANCHES` list in the same file — do both
here if the change is contiguous, but commit them separately (rule 4).

---

### WP-24 — F-015 · P2 (SUSPECTED) · Track A→B

**`Permissions-Policy: camera=()` may conflict with Peek capture, and the UI anticipates a permission the capture flow never requests.**

**Evidence.** `vercel.json:29` sets `camera=()` — an **empty** allowlist, disabling camera for all origins
including `self`. But `src/` contains **no `getUserMedia` and no `MediaRecorder`**: capture uses
`src/components/tours/TourUploader.jsx:211` —
`<input type="file" accept="video/*" capture="environment">` — which delegates to the OS camera app and is
generally **not** governed by that directive. Meanwhile `TourUploader.jsx:129` and
`src/components/permissions/CameraPermissionDialog.jsx:24,28` tell users to grant a browser camera
permission **this flow never requests**.

**Two independent issues.** (1) The header *may* break capture on some browsers — **SUSPECTED**, needs a real
device to confirm. (2) The permission copy is wrong **regardless** — fix that now, it is unconditional.

**Source.** `src/lib/contextualPermissions.js` already exists; `feature/contextual-permissions` (+12) is the
branch to mine.

**Fix shape (A).** Correct the permission copy to match the native-picker flow. **(B)** Test seller Peek
capture on real iOS Safari and Android Chrome against production headers; if capture is gated, set
`camera=(self)`.

**Proving test.** Real-device test of seller Peek capture on iOS Safari and Android Chrome against production
headers. Copy correction covered by a component test.

**Do not** change `vercel.json:29` speculatively. Widening a security header on a hypothesis is the wrong
direction — confirm first.

---

### WP-25 — F-057 · P2 · Track B (drill) + A (record)

**No evidence of a restore drill, and no stated RPO or RTO.**

**Evidence.** `docs/BACKUP_AND_DISASTER_RECOVERY.md` and `docs/BACKUP_AND_RECOVERY.md` exist, but **no drill
record, no restore evidence and no RPO/RTO targets** were found anywhere in the repository.

**An untested backup is an assumption.** Recovery time is unknown, so the business cannot state how much data
or time it would lose in an incident.

**Fix shape (B).** Perform a restore into a scratch Supabase project; measure it. **(A)** Commit the drill
record with measured RPO and RTO into `docs/`.

**Proving test.** A committed, dated drill record in `docs/` stating the measured restore time and the
data-loss window, plus a stated **RPO and RTO target** — and a contract test asserting
`docs/BACKUP_AND_DISASTER_RECOVERY.md` declares both targets, so the documentation cannot silently regress
to targetless prose again.

Depends on **B-4** (E-004) — PITR/backup configuration must be confirmed to exist first.

---

## TRANCHE 2 — FIRST 30 DAYS (25 findings)

F-005, F-006, F-008, F-010, F-016, F-018, F-019, F-020, F-021, F-022, F-023, F-025, F-028, F-037, F-038,
F-039, F-040, F-041, F-044, F-047, F-048, F-050, F-053, F-055, F-056.

Grouped into coherent packages; per-finding detail is in `audit/findings.csv`.

---

### WP-26 — F-019 + F-020 + F-021 · P2 ×3 · Track A · **the attribute strategy decision**

Take these three as **one decision followed by three commits**. They are the same problem at three depths.

**F-019 — the versioned category schema registry (~1,100 LOC) is entirely unreachable from live code.**
`src/domain/listingSchema/registry.js` plus `categories/{property,machinery,vehicle,service}.js`. Its only
importer is `src/services/listingAttributes.js:6` — and *that* file is imported by nothing. (The apparent hit
at `src/components/listings/ListingCard.jsx:32` is a **locally defined function of the same name**, not an
import.) Its own docstring claims it drives creation, editing, cards, detail pages and filters. It drives
nothing.

**F-020 — `listings.attributes` and `services.attributes` are never written.**
`supabase/migrations/0114_listing_category_attributes.sql:30,32,63-66` adds
`attributes jsonb not null default '{"version":1,"values":{}}'` with a
`CHECK is_valid_attribute_document`. `create_v1_listing_submission` **omits `attributes` from its INSERT
column list entirely**, and `src/repositories/listingCreationRepository.js:27-32` sends only
`p_submission_key`, `p_listing`, `p_detail`, `p_media`. So the CHECK validates a document that is always
empty.

**F-021 — stored attributes are 4–7 columns per vertical.** `property_details` stores only
`property_type, bedrooms, bathrooms, size_sqm`. `car_details`: `brand, model, year, mileage, fuel_type,
transmission, condition`. `machinery_details`: `machinery_type, brand, model, condition, year, usage_hours`.
Absent and decision-critical in this market: **vehicle duty/import status**, **property tenure and title**,
**borehole/solar/ZESA/water/sewer utilities**, **land vs built size with units**, **machinery
capacity/payload and certification**. For fraud-sensitive verticals these are exactly the fields that
separate a credible listing from a bait listing. (Full gap table: `audit/attribute-matrix.csv`.)

*Recorded strength: machinery correctly uses **engine hours**, not mileage. Keep that.*

**The decision (make it explicitly, in writing, before any code):** either **wire the registry** into the
create/edit flow and persist through `attributes` with server-side validation, **or delete it** and document
the detail tables as the schema of record — then extend those tables with the market-critical columns.
Half-doing this is how it got here.

**Order:** F-019 (decide) → F-020 (persist, or drop the columns and CHECK) → F-021 (extend coverage,
prioritising vehicle duty/import status and property tenure/utilities).

**Proving tests.** F-019: a contract test asserting every registry field is either persisted or explicitly
marked unused. F-020: pgTAP asserting a submitted listing has a non-empty `attributes.values` for its
category. F-021: pgTAP asserting each required attribute column exists with its constraint, plus a search
filter test.

---

### WP-27 — F-038 · P2 · Track A · depends on WP-08

**No duplicate or stolen-media detection against the highest-frequency fraud pattern in property and vehicle marketplaces.**

**Evidence.** Media validation in `supabase/functions/listing-image-upload/index.ts` and the
`create_v1_listing_submission` media loop proves the uploader **owns the storage object** — but says nothing
about **provenance**. No perceptual hash, no cross-listing image comparison, no reverse-image check exists
anywhere in the repository.

**Impact.** Recycled photography is the most common real-world scam in property and vehicle classifieds:
copy images from a genuine listing, advertise below market, collect viewing fees or deposits. The product's
central promise is *visual evidence*, so failing here undermines the proposition directly. Peeks are the
partial answer — harder to fake than stills — but Peeks are unreachable in production until WP-08, so at
launch listings carry only unverifiable stills.

**Fix shape.** Perceptual hashing (pHash) at upload; flag or block cross-listing collisions for review.
Prioritise property and vehicles. Report-driven takedown remains the only current mitigation.

**Proving test.** A test asserting a second listing reusing an existing listing's image is flagged.

---

### WP-28 — F-040 + F-041 · P2 ×2 · Track A · **payload**

**F-040 — initial JS ≈178 KB gzip is heavy for the mid-range-Android / 3G target.** Measured build:
1,507,014 bytes JS across 151 chunks; index + App + the shared chunk is ~594 KB raw / ~178 KB gzip. On a
400 kbps effective connection that is roughly 3.5–4 s of transfer before anything renders, before parse and
execute on a low-end device. `scripts/verify-build-budget.mjs` **passes** — this is budget *tightening*, not
a violation.

> **Note.** `BrandLogo-*.js` (~200 KB) is a **misnamed shared chunk**, not an inlined logo. Do not "fix" it
> by touching the logo.

**Reduce what the app shell imports.** Do **not** re-litigate vendor chunking — it was measured and
documented as a worse trade at `vite.config.js:73-77` (§3.4).

**F-041 — the public listing projection ships full descriptions to card and search views.**
`supabase/migrations/0049_listing_location_privacy_and_public_projection.sql:253-287` — the 35-column anon
allowlist includes `description` (validated up
to 5,000 chars), plus `variants` and `photos` jsonb. Card and search rendering needs title, price, location
label and a thumbnail. A 20-card page can carry ~100 KB of description text that is never rendered.

**Fix shape (F-041).** A narrower **card projection** RPC or column subset for list views. **The existing
column allowlist is correct and privacy-preserving — narrow it for cards; do not widen it anywhere** (§3.3).

**Proving tests.** F-040: budget gate tightened with a per-route first-load ceiling. F-041: a test asserting
the card query response omits `description`.

---

### WP-29 — F-044 + F-047 + F-048 · P2 ×3 · Track A (F-048 partly A→B)

- **F-044 — no `sitemap.xml`.** `public/robots.txt` is well written and correctly scoped but declares **no
  `Sitemap:` directive**, and no sitemap file exists. Generate from published listings; reference it from
  robots.txt. Depends on WP-11 (F-043). *Test: sitemap.xml exists and lists published listings.*
- **F-047 — no product analytics**, so none of the four critical funnels is measurable for drop-off. The only
  "analytics" is `AdminRecommendationAnalytics.jsx`, an internal admin view over `recommendation_*` tables.
  Server tables allow post-hoc reconstruction of *outcomes* but not *drop-off* — there is no way to learn
  whether sellers abandon at media upload or at contact entry, which is the single most valuable thing a
  pre-launch marketplace can measure. **An explicit accepted-gap decision is a valid outcome here** — the
  point is to decide consciously, not to drift. *Test: funnel events present for create-listing start,
  media, validate, publish.*
- **F-048 — no self-service data export.** `src/lib/legalContentOverrides.js:6-9` states export is handled
  through support. **Deletion by contrast is fully implemented** (delete-account Edge Function +
  `account_deletion_receipts`) — this is the asymmetry. On a service collecting identity documents and a
  selfie, DSARs depend on an undocumented manual process with no stated timeframe. Implement self-service
  export, **or** document the manual process with an SLA and a named owner. Depends on WP-06.
  **REQUIRES PROFESSIONAL REVIEW** for statutory response timeframes. *Test: an export request produces a
  complete archive of the account's personal data.*

---

### WP-30 — F-050 · P2 (XL) · Track A · depends on WP-22

**83% of test files assert on source strings rather than behaviour.**

**Evidence.** Of 141 Node test files, **117 use `readFile`/`readFileSync` + `assert.match` against source
text; only 24 import and exercise behaviour.**

Source-string tests verify that code *looks* a certain way, not that it *works*. F-002 is the failure mode
made concrete: a test that reads 7 files, asserts FindIt-absence in 3, and passes green while 111 occurrences
remain. **A suite that is 83% string-matching cannot substantiate a release-certification claim.**

They are not worthless — they pin conventions cheaply. **Keep string tests for conventions only.** Convert
the **launch-priority** suites to behavioural tests against a real database. This is XL effort; sequence it
after WP-22 so there is a working E2E harness to build on.

*Test: behavioural coverage asserted for the 17 launch priorities in `audit/PHASE-14-testing.md` §14.5.*

---

### WP-31 — F-053 + F-055 · P2 ×2 · Track A (F-055 partly B)

- **F-053 — feature flags are build-time only, so incident response requires a redeploy on a pipeline that
  is currently red.** All capability flags are `VITE_FEATURE_*` read from `import.meta.env`. Tables
  `marketplace_feature_controls` and `marketplace_operational_controls` **exist**, implying a runtime control
  plane was intended — the browser simply does not read them. So the kill switch is unavailable exactly when
  it would be needed. Fix: read capability state at runtime from `marketplace_feature_controls` with a
  build-time default. Depends on WP-02. *Test: a runtime control change disables a capability without
  rebuilding.* **Coordinate with F-025** (below) — do not make `marketplace_operational_controls` more
  public than it already wrongly is.
- **F-055 — the Cloudflare edge layer is largely declared but unused, and no `wrangler.toml` is committed.**
  `workers/edge/src/index.ts:1-13` declares `LIGHTWEIGHT_JOBS` (Queue), `PLATFORM_CONFIG` (KV),
  `RATE_LIMITS` (Durable Object), three R2 buckets and `MEDIA_DELIVERY_HOST`. Four of those appear **exactly
  once each** in the 187-line file — declaration only. `infrastructure/cloudflare/` contains only
  `.example` files. **Live media delivery actually runs through Supabase Storage signed URLs**, which the CSP
  confirms. Any capacity or cost planning based on the declared architecture would be wrong. Fix: either
  implement and provision it, **or remove the unused bindings and document Supabase Storage as the media
  path**. The second is honest and cheap; pick it unless there is a reason not to. Depends on **B-1**
  (E-001), §9.

---

### WP-32 — F-056 · P2 · Track A

**59 of 159 migrations have no rollback script** (159 migrations vs 100 rollback scripts).

A migration without a rollback cannot be reversed under incident pressure, so recovery from a bad migration
depends on point-in-time restore — which is itself unverified (**B-4** / E-004). Author rollbacks for the 59
uncovered migrations, **or** document explicitly which are irreversible and why.

*Test: a CI check asserting every migration has a paired rollback or a documented exemption.* Build it as a
12th `scripts/verify-*.mjs` gate (§6, priority 2). Note the gate that enforces non-destructive rollbacks is
itself the thing that was red — WP-01 must land first.

---

### WP-33 — Tranche 2 remainder · Track A

Small, independent, well-specified. Full detail per row in `audit/findings.csv`.

| ID | Sev | One-line action |
|---|---|---|
| **F-005** | P3 | Add `.nvmrc` matching the CI pin. CI **is** correctly pinned (`release-candidate-gates.yml:76` "Use Node.js 24"); only local dev drifts (`package.json:6-8` declares `>=23.6.0`). *Test: CI asserts `node --version` satisfies `engines.node`.* |
| **F-006** | P3 | Prune `TRUSTED_STAGING_BRANCHES` (`src/lib/stagingCapabilityPolicy.js:1-7`) — all 5 entries are stale (0–156 ahead, 151–201 behind). Or drive it from a CI variable. *Test: every entry resolves to an existing non-merged branch.* Pairs with WP-23. |
| **F-008** | P3 | `VITE_WEB_PUSH_PUBLIC_KEY` is used in `src/services/webPushService.js` but absent from `.env.example` and unchecked in `scripts/validate-env.mjs`. Declare and validate it when notifications are enabled. |
| **F-010** | P3 | Delete 5 orphaned components — `src/components/admin/AdminTourQueue.jsx`, `src/components/tours/{ImmersivePeekCard,TourCard,TourCatalogueHeader,TourCategoryChips}.jsx`. Zero importers each. **Confirm `AdminPeeks.jsx` fully supersedes `AdminTourQueue.jsx` first.** *Test: extend `verify-source-graph.mjs` to fail on unreferenced components.* |
| **F-016** | P3 | `src/App.jsx:154` Suspense handles pending lazy imports but not **rejected** ones; `AppErrorBoundary` catches the throw so there is no white screen, but it renders a generic error instead of the reload that actually fixes a rotated chunk manifest. Detect `ChunkLoadError` / dynamic-import failure and offer reload. |
| **F-018** | P3 | ~340 KB of unreferenced legacy FindIt brand PNGs. **Reissue as PeekaListing-branded PNGs to resolve F-017 (WP-19), then delete the originals.** Do not simply delete — they are the right sizes. |
| **F-022** | P3 | `p_detail` values are cast but not range-validated, and unknown enums silently coerce: `nullif(p_detail->>'bedrooms','')::integer` has no upper bound, and `coalesce(nullif(p_detail->>'propertyType',''),'other')::public.property_type` turns an unrecognised type into `'other'` rather than raising. Add range CHECKs; **raise** on unknown enum values. *pgTAP: bedrooms 9999 and an unknown property_type are both rejected.* |
| **F-023** | P3 | 14 out-of-MVP tables (payments, escrow, subscriptions, payouts, reviews, ratings, follows, legal practitioners/bookings, service bookings/disputes, announcements). **All verified deny-all** — schema debt, not reachable attack surface. Drop or explicitly quarantine. **Do NOT complete them — they are outside MVP by decision** (§2.3). *pgTAP: `anon` and `authenticated` have no read or write access to each.* |
| **F-025** | P3 | `marketplace_operational_controls_public_read` is `for select using (true)` with no role restriction, exposing `configuration` jsonb and the `updated_by` admin UUID to anonymous callers. Restrict to the specific control keys the browser needs, or expose a view projecting only `control_key` and `enabled`. **The sibling `using(true)` policies on `country_configs` and `exchange_rates` are appropriate public reference data — leave them.** |
| **F-028** | P3 | Search mixes keyset-cursor and offset pagination. `src/repositories/publicListingsRepository.js:152` still calls `.range(from, to)` while `:159,177-179` documents the limit+1 cursor lookahead. Offset is unstable under concurrent inserts. Move the remaining offset path onto the cursor RPC. *Test: no duplicate or skipped row across a page boundary when a row is inserted mid-scan.* |
| **F-037** | P3 | "Current evidence" wording implies a recency the pipeline does not attest — the manifest description says buyers can *"request current evidence before you commit"*, but nothing verifies capture time and no freshness indicator exists on playback (`src/components/tours/TourProcessingState.jsx:7`). Either display a server-side received-at timestamp, or soften the claim to *"recent evidence supplied by the seller"*. **The rest of the product's trust copy is accurate — this is the one place it risks overclaiming.** |
| **F-039** | P3 | Only **2** `prefers-reduced-motion` declarations across a UI using `animate-spin`, transitions and an immersive Peek video player. Add a global reduced-motion rule disabling non-essential animation. Also reconcile the `mask-icon` colour (`index.html:26-27`, `#2563EB`) with `theme_color` `#050914`. *Accessibility is otherwise well above typical — this is the one gap.* |

---

## TRANCHE 3 — ARCHITECTURAL / VOCABULARY (5 findings)

### WP-35 — F-007, F-009, F-024, F-045, F-052 · P3 ×5 · Track A

Low urgency, real long-term cost. Each row's proving test is in its `test_to_prove_fix` column in
`audit/findings.csv`; two are explicitly `n/a` there (F-007, F-052 — pure vocabulary changes), in which case
the proving artifact is a green full suite plus a green `Release candidate gates` run demonstrating no
workflow or script reference was broken by the rename.

| ID | Sev | Track | Action |
|---|---|---|---|
| **F-007** | P3 | A | 21 npm scripts retain obsolete Tours vocabulary (`package.json:83-108`): `test:tours-upload-local`, `run:tours-processor`, `certify:release-candidate` → `scripts/tours-release-certification.mjs`. Alias or rename to `peek-*` **with a deprecation period** — CI workflows reference these names, so renaming without aliases breaks WP-01's work. |
| **F-009** | P3 | A | 6.5 MB mock video tracked in git (`preview-assets/mock/findit-tour-preview.mp4`) — the only tracked file over 1 MB. Move to external fixture storage or generate at test time. Removing it from **history** rewrites the repo — do not do that without explicit approval. |
| **F-024** | P3 | A | Non-vehicle categories under `listing_kind='car'` inherit meaningless vehicle detail fields. `vehicles` leaves include `spare_parts`, `tyres_rims` and `bicycle`, all of which write `car_details` with `mileage`, `fuel_type` and `transmission`. Either move parts/accessories to their own kind, or make the detail shape category-aware. *Nothing breaks — the columns are nullable — but filter quality degrades.* **Note:** an earlier suspicion that car/machinery had no leaf categories was **withdrawn** — they have 15 and 12. |
| **F-045** | P3 | A | Listing URLs are bare UUIDs (`src/App.jsx:163-165`), and the SPA rewrite (`vercel.json:5-10`) returns `index.html` with **HTTP 200** for every path — so a removed listing renders PageNotFound under a 200. Add slugs; serve real 404/410 for removed listings via prerendering. Depends on WP-11 (F-043). |
| **F-052** | P3 | A | Admin Peek queue uses **pre-approval vocabulary for what is actually report-driven safety**: the RPC is `admin_tour_queue_page` (`src/repositories/adminRepository.js:31`) with the error string *"We could not load the Peek moderation queue"* (`src/pages/admin/AdminPeeks.jsx:17`), yet the cursors are `reportedPriority`/`failedPriority` and the transition is guarded `where moderation_status = 'approved'` (`0034_v1_tour_moderation_and_reports.sql:367-368`) — it only demotes **already-published** Peeks. Rename to report-queue vocabulary; update the customer error string. *This audit had to trace three migrations to resolve it; a future reviewer will reasonably conclude the MVP still has a pre-publication approval queue.* |

---

## 8. BRANCH RECONCILIATION PACKAGE

### WP-34 — 13 unreconciled branches · Track A · read-only triage

Appendix C gate *"Branch-only work has a reconcile/defer decision"* is currently **FAIL**. Closing it does
not require merging anything — it requires a **decision per branch**.

**Method (read-only, per §6 priority 3):**

```bash
git fetch origin
git log --oneline origin/main..origin/<branch>              # what is unique
git diff --stat origin/main origin/<branch>                 # size of the delta
git diff origin/main origin/<branch> -- <path-of-interest>  # targeted read
git show origin/<branch>:<path>                             # read one file as it exists there
```

**Never `git merge` and never `git cherry-pick` from these branches** (rule 11). A port is a deliberate,
reviewed, **retyped** change onto `main`, landing with its own test in its own finding's package.

**Do this triage *before* writing new code for F-015, F-030, F-031, F-001, F-017, F-012 and F-054** — those
are the findings most likely to already have an implementation on a branch.

**Deliverable: `audit/BRANCH-RECONCILIATION.md`**, one row per branch:

| Branch | Ahead/Behind | Unique work reviewed | Decision | Rationale | Findings touched |
|---|---|---|---|---|---|
| … | … | … | **PORTED** / **ABANDONED** / **DELETE (merged)** | one line | F-0nn |

Include the **16 fully-merged branches** (0 ahead) as **DELETE (merged)** — that is branch noise, listed in
`audit/PHASE-00-inventory.md` §0.3, and `docs/certification/BRANCH_CLEANUP_LEDGER.md` already exists as the
cleanup ledger. Also decide the **7 Dependabot branches** (4 npm, 3 github_actions); note
`actions/checkout-7` is 1 ahead / **0 behind** and is the cheapest to take.

**Acceptance.** Every one of the 13 has an explicit recorded decision. Appendix C gate moves
**FAIL → PASS**.

---

## 9. EXTERNAL EVIDENCE CHECKLIST — TRACK B

**You cannot execute these. Neither could the auditor** — every MCP call to Supabase, Cloudflare and Vercel
returned `MCP error -32003: MCP tool call requires approval` (**E-000, BLOCKED**), which is why 24 Appendix C
rows read *EXTERNAL EVIDENCE REQUIRED* rather than PASS.

**Rule 9 governs this section absolutely: never mark any of these PASS on the strength of repository
configuration.** A `vercel.json` is not a Vercel project. A TypeScript `Env` interface is not a deployment.
159 migrations are not an applied schema.

Full rationale and verification commands for each: `audit/EXTERNAL-EVIDENCE.md`.

| ID | Register | What must be verified | Console / CLI steps |
|---|---|---|---|
| **B-1** | E-001 | Cloudflare Worker, 3 R2 buckets, Queue `LIGHTWEIGHT_JOBS`, KV `PLATFORM_CONFIG`, Durable Object `RATE_LIMITS`; secrets are Worker secrets not plaintext vars | `wrangler deployments list` per env · `wrangler r2 bucket list` · `wrangler queues list` · `wrangler kv namespace list` · `wrangler secret list` · or Dashboard → Workers & Pages → Worker → Settings → Bindings |
| **B-2** | E-002 | Media processing worker: hosting target, running revision, health endpoint, concurrency/timeout/retry bounds; `TOUR_PROCESSOR_URL` and `TOUR_PROCESSING_CALLBACK_URL` resolve over valid HTTPS; `FINDIT_TOUR_PROCESSOR_MODE` is `github-actions` or `external` (`scripts/validate-env.mjs:76-100`) | Identify the platform → list revisions and recent logs · curl the health endpoint · confirm `TOUR_PROCESSOR_SECRET` and `FINDIT_TOUR_PROCESSING_WORKER_SECRET` are set |
| **B-3** | E-003 | **P0-CLASS.** Vercel project id and production domain; env vars **per target**; **Preview `VITE_SUPABASE_URL` must differ from Production**; deployment protection on preview URLs; whether `VITE_FEATURE_TOURS` is set for Production (decides WP-08 / F-003) | `vercel project ls` → `vercel env ls` per environment · Dashboard → Project → Settings → Environment Variables, and → Deployment Protection · **compare Preview vs Production `VITE_SUPABASE_URL` directly** |
| **B-4** | E-004 | Distinct staging and production project refs; applied migrations reconciled against `supabase/migrations/`; **Security Advisor output** (RLS-disabled tables, exposed views, function `search_path` warnings); auth settings (email confirmation, password policy, MFA enrolment, OAuth redirect allowlist); **PITR/backup config and retention** | `supabase projects list` · `supabase migration list --linked` per project · Dashboard → Advisors → Security, and → Database → Backups |
| **B-5** | E-005 | Turnstile site key/secret provisioned; `TURNSTILE_ALLOWED_HOSTNAMES` / `TURNSTILE_ALLOWED_ORIGINS` values; which flows actually enforce it | Dashboard → Turnstile → widget configuration · confirm the Edge Function secret is set · exercise a flow with a deliberately invalid token |
| **B-6** | E-006 | `peekalisting.com` apex + `www` resolution and redirect direction; TLS issuer/validity/coverage; **Supabase Auth Site URL and Redirect URLs matching the production origin**; OAuth callback URLs (Google, Apple if enabled); SPF, DKIM, DMARC | `dig +short peekalisting.com A` · `dig +short www.peekalisting.com CNAME` · `curl -sSI https://peekalisting.com` · Supabase Dashboard → Authentication → URL Configuration · `dig +short TXT peekalisting.com` · `dig +short TXT _dmarc.peekalisting.com` |
| **B-7** | *(not in the E-register — new, from WP-02/WP-03)* | Branch protection on `main` requiring all 5 workflows as status checks; GitHub Pages enabled for staging; environment secrets present | GitHub → Settings → Branches → protection rule for `main` → *Require status checks to pass before merging* → select **Release candidate gates, Release Certification, Migration gates, Deploy staging to GitHub Pages, GitHub Pages Preview** · Settings → Pages · Settings → Environments |
| **B-8** | *(WP-06 / F-011)* | **Counsel sign-off** on operator legal name, registered address, privacy contact email, retention periods per data category, international-transfer mechanism, liability-cap decision, dispute-resolution step | Legal counsel. **Do not invent any of these values.** |

**B-3 is the one that can still turn into a P0.** *"Preview never writes production"* is currently
**EXTERNAL** in Appendix C. If Preview points at the production Supabase project, **every preview deployment
has been writing production data.** Resolve it before launch, and if it resolves badly, apply rule 10:
stop, report, do not unilaterally remediate.

---

## 10. DEFINITION OF DONE

### 10.1 Per package

1. The cited evidence was opened and confirmed to still reproduce (or the deviation was recorded).
2. A proving test was written or identified and **shown failing first**.
3. The fix landed, the test passes, and the **full** suite is no worse than before.
4. Any migration has a paired rollback that satisfies `scripts/verify-sql-boundary.mjs`.
5. One finding + root cause per commit, message `fix(F-0nn): …`, body naming the RC and the sourcing
   priority used.
6. Nothing in the §3.3 register was modified.
7. `audit/findings-status.csv` row updated with resolution status, `audit/REMEDIATION-PROGRESS.md` §3/§4
   refreshed, and `audit/remediation/WP-nn-F-0nn.md` written — **all in the same commit as the code**.

> **Amendment, 2026-08-07.** This item originally read *"`audit/findings.csv` row updated with resolution
> status."* That was wrong. `audit/findings.csv` is dated evidence captured at `ee6f212`; an audit record
> you mutate is no longer a record anyone can check the work against. `findings.csv` is therefore
> **immutable**, and status lives in `audit/findings-status.csv` (same `id` key, plus `status`, `commit`,
> `proving_test`, `proving_test_result`). See `audit/REMEDIATION-PROGRESS.md` §6.

### 10.2 Per tranche — Appendix C gate transitions

Baseline: **61 PASS · 19 FAIL · 8 PARTIAL · 24 EXTERNAL** (`audit/REPORT.md` §5).

**Tranche 0 complete when these move:**

| Gate | From | To |
|---|---|---|
| PR lint/typecheck/contracts/build execute | FAIL | PASS |
| Clean DB migration executes | FAIL | PASS |
| Separate staging | FAIL | PASS |
| MFA cannot be route-bypassed | FAIL | PASS |
| EXIF/GPS posture safe | FAIL | PASS |
| Exact property location safe | PARTIAL | PASS |
| Active branding is PeekaListing | FAIL | PASS |
| Terms match MVP · Privacy matches processors/data | PARTIAL ×2 | PASS ×2 |
| Public Peek discovery works | FAIL | PASS **or** N/A (recorded decision) |
| Branch-only work has a reconcile/defer decision | FAIL | PASS |
| RLS tested on private/user/business data | EXT | PASS (hosted pgTAP finally runs) |

**Tranche 1 additionally:** *Listing metadata proven*, *Canonical URLs correct*, *WhatsApp preview
acceptable*, *Frontend errors captured*, *Realtime/polling understood*, *Deep links valid*, *Card
derivatives not originals*, *Turnstile/rate limits verified*, *Restore drill completed* → **PASS**.

**Tranche 2 additionally:** *Sitemap/robots correct* PARTIAL → PASS · *Data export documented/tested* FAIL →
PASS · *Seller funnel measurable* / *Buyer funnel measurable* FAIL → PASS-or-recorded-gap · *Migration
rollback strategy* PARTIAL → PASS · *Stable bounded pagination* PARTIAL → PASS · *Initial JS budget* PARTIAL
→ PASS · *WCAG 2.2 AA top templates* PARTIAL → PASS.

**All 24 EXTERNAL rows** stay EXTERNAL until §9 evidence is supplied. **They never convert on repository
evidence** (rule 9).

### 10.3 Launch gate

Launch requires: **Tranche 0 closed** · **B-3 (E-003) resolved and not a P0** · **B-8 (counsel) signed off**
· **all five workflows green and required on `main`** · **an explicit recorded decision on F-003**.

---

## 11. COMMIT, BRANCH AND PR PROTOCOL

- **Branch:** develop on `claude/peekalisting-audit-ui0z6l` unless directed otherwise. Create it from the
  latest default branch if it does not exist. **Never push to a different branch without explicit
  permission.**
- **Push:** `git push -u origin <branch-name>`. On network failure only, retry up to 4 times with
  exponential backoff (2s, 4s, 8s, 16s).
- **Commits:** one finding + its root cause each. `fix(F-0nn): <what changed>`; body names the RC, the
  sourcing priority used, and the proving test.
- **Pull requests:** **do not open one unless explicitly asked.** When asked, check for a template
  (`.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`, root `PULL_REQUEST_TEMPLATE.md`,
  `docs/PULL_REQUEST_TEMPLATE.md`) and mirror its headings.
- **A merged PR is finished.** It cannot track follow-up work. If your branch's PR has already merged,
  restart the branch from the latest default branch
  (`git fetch origin <default> && git checkout -B <branch> origin/<default>`) and push follow-up work there
  as a **new** PR. If the branch already carries unmerged commits beyond the merged history, **rebase them
  onto the new base — do not discard them.**
- **Never** commit secrets, `.env` files, or the service-role key. `scripts/verify-bundle-secrets.mjs`
  enforces this against the real `dist/` and currently passes — keep it passing.

---

## 12. FIRST ACTIONS

Do these in order. Do not skip ahead.

1. **Read** `audit/findings.csv` end to end. It is 56 rows and it is the authoritative record.
2. **Reproduce the blocker** — `node ./scripts/verify-sql-boundary.mjs` should exit 1 naming
   `20260807020000_peek_request_fulfilment_lifecycle.rollback.sql`.
3. **See the damage** — `node --test ./tests/*.test.mjs` (expect 14 failures) and
   `npx tsc -p ./jsconfig.json` (expect 10 errors). These are the errors CI has been hiding.
4. **Mine the branches** for WP-01 — start with `continuation/contract-gate-repair`, read-only.
5. **Execute WP-01.** Report. Then take the next package.

**A closing note on posture.** This is a better codebase than its release process suggests. The RLS layer,
the RPC ownership model, the contact boundary and the media-ownership proof are all genuinely well built —
several of them are more careful than typical production systems. Most of what follows is finishing work
that was started well, connecting controls that exist at one layer to the layer that enforces them, and
making the pipeline able to tell the truth about all of it. **Treat the existing engineering as an asset to
preserve, not a draft to improve.**
