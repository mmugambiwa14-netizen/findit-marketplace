# REMEDIATION PROGRESS — START HERE

> **You are resuming someone else's work.** This file is the entry point. It is rewritten in **every**
> commit that changes code, so it is never stale by more than one commit. Read it top to bottom; you will
> not need any prior conversation.

**Repo:** `mmugambiwa14-netizen/findit-marketplace` · **Branch:** `claude/peekalisting-audit-ui0z6l`
**Executing:** `audit/REMEDIATION-PROMPT.md` — 35 work packages, 56 findings
**Audit baseline:** `origin/main` @ `ee6f212` · **Last updated:** see git log for this file

```bash
git fetch origin && git checkout claude/peekalisting-audit-ui0z6l && git pull
git log --oneline origin/main..HEAD          # every remediation commit, newest first
```

---

## 1. THE FOUR FILES

| Path | Role |
|---|---|
| **`audit/REMEDIATION-PROGRESS.md`** | ← you are here. Status, blockers, next action. |
| `audit/REMEDIATION-PROMPT.md` | The spec. Work packages WP-01…WP-35 with inline evidence. **Read §3.3 (do-not-touch register) before your first edit.** |
| `audit/findings-status.csv` | Machine-readable per-finding status. Columns: `id, severity, tranche, work_package, title, status, commit, proving_test, proving_test_result, notes` |
| `audit/remediation/WP-nn-*.md` | One record per completed package: what changed, why, verbatim command output, decisions, what was deliberately not done. |

**Underlying audit evidence (do not edit):** `audit/REPORT.md`, `audit/findings.csv`,
`audit/EXTERNAL-EVIDENCE.md`, `audit/PHASE-00…16*.md`, `audit/PHASE-05-flows/`.

---

## 2. RULES THIS WORK RUNS UNDER

Full set in `REMEDIATION-PROMPT.md` §4. The five that matter most when picking up cold:

1. **F-013 (WP-01) is first, unconditionally.** Until the CI gate cascade is fixed, lint, all four
   typechecks, the build and the contract suites are *skipped* — so no other fix can be verified.
2. **Evidence before change.** Open the cited `file:line` and confirm the finding still reproduces before
   editing. Record any deviation. *(This has already caught wrong line numbers in `findings.csv` — see §6.)*
3. **Never weaken an existing control to make a test pass.** If a test and a control disagree, examine the
   test first.
4. **Never reintroduce** listing moderation, Peek moderation, payments or reputation. These are deliberate
   MVP exclusions (`REMEDIATION-PROMPT.md` §2.3), not oversights.
5. **Do not touch the §3.3 register** — contact-reveal grant ordering, `protect_user_managed_fields`, the
   media-ownership proof, `safeUrl.js`. If a fix appears to require it, stop and report.

### The commit invariant

> **No commit changes code without updating this ledger in the same commit.**
> Every turn ends with a clean working tree and a push.

So the **last commit on this branch is always a complete handoff.** If the ledger and the code ever
disagree, trust `git log` and fix the ledger.

---

## 3. STATUS

**Legend:** `DONE` · `PARTIAL` · `BLOCKED` · `DEFERRED` · `NOT-STARTED` · `WITHDRAWN`

`DONE` requires a proving test that **failed before and passes after**, with output captured in the package
record. Anything weaker is `PARTIAL` with the residual named.

### Proof-strength labels — read these literally

| Label | Meaning |
|---|---|
| `LOCAL-EXEC` | Actually ran in the working environment; output captured |
| `CI-VERIFIED` | A real GitHub Actions run on the pushed branch |
| `STATIC-ONLY` | Correct by inspection; **no runtime was available** (e.g. pgTAP with no database) |
| `UNPROVEN — needs <X>` | Written but not runnable here |

**`STATIC-ONLY` is not PASS.** This carries the audit's Appendix D rule — *never silently mark an external
control PASS* — into execution. Do not upgrade a label without actually running the thing.

### Tranche 0 — launch blockers

| WP | Findings | Status | Commit | Proving test | Result |
|---|---|---|---|---|---|
| WP-01 | F-013 | **DONE** | `cb0b6c6` | `tests/sqlRollbackBoundary.test.mjs`; gate exit 0; CI step conclusions | `LOCAL-EXEC` **PASS** 12/12 · **`CI-VERIFIED` PASS** — run [31144698189](https://github.com/mmugambiwa14-netizen/findit-marketplace/actions/runs/31144698189), **0 verification steps skipped** |
| WP-02 | F-012 | NOT-STARTED | — | Green `Release candidate gates` on `main` | — |
| WP-03 | F-054 | NOT-STARTED | — | Green staging deploy | — |
| WP-04 | F-027 | NOT-STARTED | — | pgTAP: aal1 admin RPC denied, aal2 allowed | — |
| WP-05 | F-033 | NOT-STARTED | — | Geotagged fixture served with no GPS EXIF | — |
| WP-06 | F-011 | NOT-STARTED | — | No `[TO BE COMPLETED]` reachable from `legalDocuments` | — |
| WP-07 | F-001, F-002 | NOT-STARTED | — | Brand contract over all of `src/` | — |
| WP-08 | F-003 | NOT-STARTED | — | `/peek` serves the catalogue, or a recorded decision | — |

### Tranche 1 · 2 · 3

All `NOT-STARTED` except as noted. Per-finding rows in `audit/findings-status.csv`; package definitions in
`REMEDIATION-PROMPT.md` §7.

### Findings discovered *after* the audit

The audit's 56 findings were what could be seen while the CI cascade was hiding twelve steps. Fixing F-013
made those steps run, and they immediately reported a defect the audit never had access to:

| ID | Sev | WP | Title |
|---|---|---|---|
| **F-058** | P2 | WP-02 | `src/lib/traceContext.js:15,18` calls `globalThis.sessionStorage` directly instead of going through the guarded `src/lib/browserStorage.js` boundary. Fails `npm run audit:product-surface` with `UNSAFE_BROWSER_STORAGE`. |

**Numbering:** the audit used `F-001`…`F-057` with `F-032` withdrawn (56 live). New findings continue from
**`F-058`**. They live in `findings-status.csv` only — `findings.csv` stays frozen at the audit baseline.

**Totals:** 57 findings — **1 DONE · 0 PARTIAL · 0 BLOCKED · 56 NOT-STARTED**

### CI evidence so far

**Run [31144698189](https://github.com/mmugambiwa14-netizen/findit-marketplace/actions/runs/31144698189)**
@ `cb0b6c6` — job `verify`, conclusion `failure`, **0 verification steps skipped**. The job is red because
six real failures are now *reported* rather than hidden. Outstanding, in step order:

| Step | Owner |
|---|---|
| 11 Audit routed product surface | **F-058** |
| 14 Run all contracts | F-049 (+ F-017, F-029, F-042) |
| 16 Run Tours contracts | F-049 |
| 18 Typecheck application | F-014 — **fixed locally, see WP-10** |
| 20 Typecheck active release surface | F-014 — **fixed locally** |
| 24 Run reproducible internal certification | aggregates the above |

> **Triggering CI on this branch.** `release-candidate-gates.yml` runs on `pull_request`, pushes to `main`,
> and `workflow_dispatch` — **not** on a push to a feature branch. Use a manual dispatch against
> `claude/peekalisting-audit-ui0z6l`, or open a PR. Same for `migration-gates.yml` and
> `release-certification.yml`.

---

## 4. NEXT ACTION

> **Confirm WP-01 in CI, then start WP-10 (F-014) and WP-09 (F-049).**

### 4a. Close out WP-01 — read the CI run for this branch

WP-01's local work is done (`audit/remediation/WP-01-F-013.md`). Its spec-mandated proving test is a **CI**
run, which is why it is `PARTIAL` and not `DONE`. Open the latest `Release candidate gates` run for
`claude/peekalisting-audit-ui0z6l` and confirm that **`Lint application`, `Typecheck application` and
`Build production application` report a conclusion other than `skipped`.**

> **The run is expected to be RED, and that is success for WP-01.** Breaking the cascade makes previously
> hidden failures visible for the first time — the 10 typecheck errors of F-014 and the 15 failing tests of
> F-049. A red run whose steps all *executed* is the goal here; driving it green is **WP-02**.

Record the outcome in §6 of `WP-01-F-013.md`, flip F-013 to `DONE` with `CI-VERIFIED`, and update §3 above.

### 4b. Then take these two, in either order

Both were hidden by the cascade and are now visible and locally reproducible:

- **WP-10 · F-014** — 10 typecheck errors. `npx tsc -p ./jsconfig.json` exits 2.
  `src/components/peekThreads/BuyerPeekRequestsQueue.jsx:112,115,117,119,126` and
  `src/pages/BusinessProfiles.jsx:26,33,75`. Cause: `useMutation` calls lack explicit generics, so TanStack
  Query infers `TVariables` as `void`. **Type-soundness gaps, not proven runtime defects** — do not report
  them as runtime bugs.
- **WP-09 · F-049** — obsolete tests asserting removed Peek moderation and the old FindIt brand.
  **Do not simply delete every failing test**: tests `155` (owner lifecycle), `22` (image loading/decoding)
  and `62` (storage degradation) are *correct* tests failing against *real* defects, and belong to F-029,
  F-042 and a resilience gap. They must stay red.

Current local baseline: `node --test ./tests/*.test.mjs` → 768 tests, **14 fail**;
`node --test ./tests/security/*.test.mjs` → 41, **1 fail**.

---

## 5. BLOCKED REGISTER

Nothing is blocked by another package yet. Standing external blockers (Track B, `REMEDIATION-PROMPT.md` §9)
apply from the start and **cannot be cleared from inside the repo**:

| Item | Blocks | Needs |
|---|---|---|
| **B-3** (E-003) | Launch. **P0-class if it resolves badly** | Vercel console — is Preview's `VITE_SUPABASE_URL` different from Production's? If not, every preview deploy has been writing production data. |
| B-8 | WP-06 (F-011) | Counsel: operator legal name, registered address, privacy contact email, retention periods, transfer mechanism, liability cap, dispute step. **Do not invent these values.** |
| B-7 | WP-02, WP-03 | GitHub admin: branch protection requiring the 5 workflows; Pages enabled |
| B-1, B-2, B-4, B-5, B-6 | WP-31, WP-25, WP-13 | Cloudflare / Supabase / DNS consoles |

---

## 6. ENVIRONMENT CAVEATS — what this environment could not prove

Recorded so a later executor does not mistake an unrunnable check for a passing one.

| Constraint | Consequence |
|---|---|
| **Node v22.22.2** vs `engines.node >= 23.6.0` (CI uses 24) | `npm ci` warns `EBADENGINE`. Results have been consistent, but scripts using `--experimental-strip-types` may behave differently on 24. |
| **No image tooling** — no `sharp`, no PIL, no ImageMagick | **WP-19 (F-017) PWA icon rasters cannot be produced here.** The package will be `BLOCKED` with a full asset spec rather than attempted badly. |
| **No database** | pgTAP suites (WP-04, WP-15, WP-20, WP-26) can be written but not run → `STATIC-ONLY`. |
| **No Supabase / Vercel / Cloudflare console** | All of §5 stays evidence-required. |

### Corrections already made to the audit artifacts

- **Tranche assignment.** `REPORT.md` §4 prose and `findings.csv` disagree (prose puts F-005/F-023/F-037 in
  Tranche 1/3; the CSV puts them in Tranche 2 and places F-015/F-017 in Tranche 1, F-009 in Tranche 3).
  Both total 9/17/25/5 = 56. **`findings.csv` is authoritative.**
- **F-002 line numbers.** `findings.csv` cites `tests/peekaListingBrandContracts.test.mjs:1-56` with
  assertions at `:34`/`:56`. The file is **52 lines**; the FindIt-absence assertions are at `:13`, `:32`,
  `:51`. The substance of the finding is unchanged. Corrected in `REMEDIATION-PROMPT.md` WP-07.
- **Status ledger location.** `REMEDIATION-PROMPT.md` §10.1 item 7 originally said to update the
  `findings.csv` row. That was wrong: `findings.csv` is dated evidence captured at `ee6f212`, and an audit
  record you mutate is no longer a record you can check the work against. Status now lives in
  `audit/findings-status.csv`; §10.1 has been amended to match.

---

## 7. IF YOU ARE PICKING THIS UP COLD

1. `git log --oneline origin/main..HEAD` — commits read `fix(F-0nn): …`.
2. Read §4 **NEXT ACTION** above.
3. Read the package definition in `REMEDIATION-PROMPT.md` §7.
4. Read `REMEDIATION-PROMPT.md` §3.3 — the do-not-touch register — before editing anything.
5. Reproduce the finding's evidence yourself before changing code (rule 2).
6. When you finish a package: write `audit/remediation/WP-nn-F-0nn.md`, update
   `audit/findings-status.csv`, update §3 and §4 of this file, and commit all of it **together** with the
   code.
