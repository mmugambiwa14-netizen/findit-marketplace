# REMEDIATION PROGRESS — START HERE

> This file is the branch handoff. Every branch commit that changes code must update this ledger in the same commit.

**Repo:** `mmugambiwa14-netizen/findit-marketplace`  
**Branch:** `claude/peekalisting-audit-ui0z6l`  
**Audit baseline:** `origin/main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`  
**Execution spec:** `audit/REMEDIATION-PROMPT.md` — 35 work packages, 60 tracked findings.

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
| WP-02 | F-012/F-058/F-060/F-061 | **DONE** | `7e5b084` | CI run 31146750894: product-surface audit and all three proving contracts passed; failures fell 10 → 7 and every remaining red is assigned to WP-15/WP-18/WP-19. |
| WP-03 | F-054 | **BLOCKED** | — | Vercel reports `build-rate-limit`; a green staging deployment requires external plan/quota availability. |
| WP-04 | F-027 | NOT-STARTED | — | Requires server-side aal1 denial and aal2 allow behavior, preferably pgTAP. |
| WP-05 | F-033 | NOT-STARTED | — | Requires EXIF/GPS stripping proof. |
| WP-06 | F-011 | NOT-STARTED | — | Blocked on counsel/operator-supplied legal facts. |
| WP-07 | F-001/F-002 | NOT-STARTED | — | Full active-source brand contract required. |
| WP-08 | F-003 | NOT-STARTED | — | Public Peek route/capability decision required. |

### Completed non-Tranche-0 work

| Item | Status | Commit | Evidence |
|---|---|---|---|
| WP-09 / F-049 | **DONE** | `051cf8a` | Obsolete tests reconciled; contracts 14 → 11 red; security 41/41 green. |
| WP-10 / F-014 | **DONE** | `8dc68fd` | `typecheck` and `typecheck:active` passed locally. |
| F-059 | **DONE** | `f50fc4a` | Peek moderation copy removed; contract 508 green. |

### WP-02 proof

Implementation commit: `7e5b0842d098f68f695d3d5e4bafb51e083b6877`

GitHub Actions:

- Release candidate gates: run `31146750894`, job `92767637096`.
- Buyer Journey Certification: run `31146750853`, contracts job passed.
- Full contracts: 769 total, 762 passed, 7 failed.
- Previously failing F-058 browser-storage resilience contract passed.
- Previously failing F-060 lockfile-normalization contract passed.
- Previously failing F-061 immutable-workflow-pin contract passed.
- `npm run audit:product-surface` passed.
- Lint, app/migration/active/Edge typechecks, security advisor, product audit, build and internal certification all ran and passed after the contract failure.

The remaining seven contract failures are intentionally not hidden:

| Count | Finding | Later package |
|---:|---|---|
| 5 | F-017 PWA raster/maskable/apple-touch icon assets | WP-19 |
| 1 | F-042 listing-card image derivatives | WP-18 |
| 1 | F-029 sold lifecycle transition | WP-15 |

WP-02's approved closure condition was either a completely green release gate **or** explicit assignment of every remaining red to a later package. The second condition is now satisfied. This does not claim the repository is fully green.

### Totals

60 tracked findings:

- **8 DONE:** F-012, F-013, F-014, F-049, F-058, F-059, F-060, F-061
- **1 BLOCKED:** F-054
- **51 NOT-STARTED**

---

## 4. Exact next action

Proceed to **WP-04 / F-027** without weakening the existing fail-closed browser guard.

1. Re-read the F-027 package in `audit/REMEDIATION-PROMPT.md` and the §3.3 do-not-touch register.
2. Inventory every administrator RPC and existing `is_admin`/MFA helper.
3. Add one server-authoritative assurance-level predicate with a pinned `search_path`.
4. Enforce it on privileged admin RPC paths without trusting browser state.
5. Write behavior tests proving:
   - authenticated administrator with `aal1` is denied;
   - authenticated administrator with `aal2` is allowed;
   - ordinary user remains denied at both levels.
6. If no executable local database is available, record SQL/static work as `STATIC-ONLY`, push it to the draft PR and obtain pgTAP execution evidence before marking F-027 `DONE`.

Do not work around WP-03's Vercel quota failure in product code.

---

## 5. External blocked register

| Item | Launch impact | Required external evidence |
|---|---|---|
| B-3 / E-003 | P0-class if Preview writes production | Vercel Preview and Production `VITE_SUPABASE_URL` separation. |
| B-8 | Blocks final legal copy | Operator legal name/address/privacy contact/retention/transfer/liability/dispute facts from counsel/operator. |
| B-7 | Blocks deployment governance closure | GitHub branch protection requiring the release workflows and Pages configuration. |
| F-054 / WP-03 | Blocks staging deployment proof | Vercel plan/quota availability followed by a green staging deploy. |
| B-1/B-2/B-4/B-5/B-6 | Blocks later infrastructure packages | Cloudflare, Supabase and DNS console evidence. |

Do not invent external values or silently mark them verified.

---

## 6. Environment caveats

- The previous executor had Node 22 while CI uses Node 24; repository engines require `>=23.6.0`.
- The previous environment lacked image tooling, so F-017 rasters were blocked there.
- The previous environment lacked a database, so pgTAP work could only be static.
- This execution environment cannot resolve `github.com` from the local shell; repository reads/writes use the connected GitHub API.
- GitHub Actions is the execution proof boundary for the current branch.
- No Supabase, Vercel, Cloudflare or DNS console access is available here.

---

## 7. Handoff invariant

The branch head must always explain itself. If code and this ledger disagree, inspect `git log origin/main..HEAD`, correct the ledger, and do not proceed until the handoff is coherent.
