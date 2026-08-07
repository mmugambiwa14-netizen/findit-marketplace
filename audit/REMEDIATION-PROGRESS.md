# REMEDIATION PROGRESS — START HERE

> This file is the branch handoff. Every branch commit that changes code must update this ledger in the same commit.

**Repo:** `mmugambiwa14-netizen/findit-marketplace`  
**Branch:** `claude/peekalisting-audit-ui0z6l`  
**Audit baseline:** `origin/main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`  
**Execution spec:** `audit/REMEDIATION-PROMPT.md` — 35 work packages, 60 tracked findings after CI exposed F-058…F-061.

```bash
git fetch origin
git checkout claude/peekalisting-audit-ui0z6l
git pull
git log --oneline origin/main..HEAD
```

---

## 1. Files to read

| Path | Role |
|---|---|
| `audit/REMEDIATION-PROGRESS.md` | Current status, blockers and exact next action. |
| `audit/REMEDIATION-PROMPT.md` | Full approved remediation plan. Read §3.3 before editing. |
| `audit/findings-status.csv` | Machine-readable per-finding state. |
| `audit/remediation/*.md` | Evidence records for completed work. |

The underlying audit evidence under `audit/PHASE-*`, `audit/REPORT.md`, `audit/findings.csv` and `audit/EXTERNAL-EVIDENCE.md` is frozen evidence and must not be rewritten as remediation status.

---

## 2. Non-negotiable rules

1. Confirm cited evidence before editing.
2. Never weaken an existing control merely to make a test green.
3. Never reintroduce listing moderation, Peek moderation, payments or reputation.
4. Do not touch the §3.3 protected controls: contact-boundary grant ordering, `protect_user_managed_fields`, media-ownership proof, `safeUrl.js`, fail-closed `ProtectedRoute`, owner transition ownership predicates, preview auth boundary, enumeration-safe recovery or global logout.
5. `DONE` requires a proving test that failed before and passes after. Otherwise use `PARTIAL`, `STATIC-ONLY` or `UNPROVEN` literally.
6. Do not write a commit's own SHA into files inside that commit; backfill it in the next commit.

---

## 3. Current status

### Tranche 0

| WP | Findings | Status | Commit | Evidence |
|---|---|---|---|---|
| WP-01 | F-013 | **DONE** | `cb0b6c6` | Local 12/12 and CI run 31144698189 proved no verification-step cascade. |
| WP-02 | F-012 plus F-058/F-060/F-061 | **PARTIAL** | pending current commit | Three newly exposed repository defects are corrected by inspection; proving CI/local execution is still required before any is `DONE`. |
| WP-03 | F-054 | NOT-STARTED | — | Requires green staging deploy. |
| WP-04 | F-027 | NOT-STARTED | — | Requires aal1/aal2 pgTAP behavior. |
| WP-05 | F-033 | NOT-STARTED | — | Requires EXIF/GPS stripping proof. |
| WP-06 | F-011 | NOT-STARTED | — | Blocked on counsel-supplied legal facts. |
| WP-07 | F-001/F-002 | NOT-STARTED | — | Full active-source brand contract required. |
| WP-08 | F-003 | NOT-STARTED | — | Public Peek route/capability decision required. |

### Completed non-Tranche-0 work

| Item | Status | Commit | Evidence |
|---|---|---|---|
| WP-09 / F-049 | **DONE** | `051cf8a` | Obsolete tests reconciled; contracts 14 → 11 red; security 41/41 green. |
| WP-10 / F-014 | **DONE** | `8dc68fd` | `typecheck` and `typecheck:active` passed locally. |
| F-059 | **DONE** | `f50fc4a` | Peek moderation copy removed; contract 508 green. |

### Current WP-02 changes

- **F-058:** `src/lib/traceContext.js` now uses `readStoredString`/`writeStoredString` from `src/lib/browserStorage.js` rather than touching `sessionStorage` directly.
- **F-060:** `.github/workflows/buyer-journey-certification.yml` now normalizes `package-lock.json` before the hosted `npm ci` step.
- **F-061:** `.github/workflows/pages-preview.yml` now pins `actions/checkout` to immutable SHA `3d3c42e5aac5ba805825da76410c181273ba90b1`.

These changes are **PARTIAL / UNPROVEN** in this execution environment because the local shell cannot resolve GitHub to clone/install/run the repository. Do not upgrade them to `DONE` until the proving tests execute.

### Totals

60 tracked findings:

- **4 DONE:** F-013, F-014, F-049, F-059
- **3 PARTIAL:** F-058, F-060, F-061
- **0 BLOCKED findings** inside the repository work stream
- **53 NOT-STARTED**

---

## 4. Exact next action

1. Open or refresh a PR from `claude/peekalisting-audit-ui0z6l` to `main` so pull-request workflows execute.
2. Inspect the `Release candidate gates` and relevant journey workflow results.
3. Required proving evidence:
   - `npm run audit:product-surface` exits 0 and no longer reports `UNSAFE_BROWSER_STORAGE: src/lib/traceContext.js`.
   - Browser-storage resilience contract 62 passes if it is owned by the same defect.
   - Package-lock normalization contract 226 passes.
   - Workflow-pinning contract 768 passes.
4. If those pass, update F-058/F-060/F-061 to `DONE`, add the run URL and step conclusions, and continue WP-02/F-012.
5. WP-02 closes only when the release-candidate gate is genuinely green or every remaining red is assigned to a later finding with an explicit package boundary; branch protection/Pages evidence remains Track B item B-7.

### Known suite baseline before this commit

Previous executor recorded:

- `node --test ./tests/*.test.mjs` → 769 tests, 10 red
- `node --test ./tests/security/*.test.mjs` → 41/41 green

Accounted-for reds before this commit:

| Tests | Owner |
|---|---|
| 760, 762, 763, 764, 765 | F-017 PWA raster assets |
| 22 | F-042 image derivatives |
| 155 | F-029 sold transition |
| 62 | F-058 browser-storage resilience; re-check now |
| 226 | F-060 lockfile normalization; re-check now |
| 768 | F-061 immutable checkout pin; re-check now |

Do not delete or weaken these tests.

---

## 5. External blocked register

| Item | Launch impact | Required external evidence |
|---|---|---|
| B-3 / E-003 | P0-class if Preview writes production | Vercel Preview and Production `VITE_SUPABASE_URL` separation. |
| B-8 | Blocks final legal copy | Operator legal name/address/privacy contact/retention/transfer/liability/dispute facts from counsel/operator. |
| B-7 | Blocks WP-02/WP-03 closure | GitHub branch protection requiring the five workflows and Pages configuration. |
| B-1/B-2/B-4/B-5/B-6 | Blocks later infrastructure packages | Cloudflare, Supabase and DNS console evidence. |

Do not invent external values or silently mark them verified.

---

## 6. Environment caveats

- The previous executor had Node 22 while CI uses Node 24; repository engines require `>=23.6.0`.
- The previous environment lacked image tooling, so F-017 rasters were blocked there.
- The previous environment lacked a database, so pgTAP work could only be static.
- This execution environment cannot resolve `github.com` from the local shell; repository reads/writes are performed through the connected GitHub API. Therefore the current three changes remain `UNPROVEN` until CI runs.
- No Supabase, Vercel, Cloudflare or DNS console access is available here.

---

## 7. Handoff invariant

The branch head must always explain itself. If code and this ledger disagree, inspect `git log origin/main..HEAD`, correct the ledger, and do not proceed until the handoff is coherent.
