# REMEDIATION PROGRESS — START HERE

> Every code commit updates this ledger in the same commit.

**Repo:** `mmugambiwa14-netizen/findit-marketplace`  
**Branch:** `claude/peekalisting-audit-ui0z6l`  
**Audit baseline:** `origin/main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`  
**Draft PR:** #33

Read `audit/REMEDIATION-PROMPT.md` §3.3 before editing. Never weaken protected controls or reintroduce listing moderation, Peek moderation, payments or reputation.

## Current status

| WP | Findings | Status | Evidence |
|---|---|---|---|
| WP-01 | F-013 | DONE | `cb0b6c6`; CI 31144698189 |
| WP-02 | F-012/F-058/F-060/F-061 plus F-063/F-064 | **PARTIAL** | First CI proof exposed stale trace/ordering/verifier coverage; corrective commit pending CI. |
| WP-03 | F-054 | BLOCKED | Vercel `build-rate-limit`. |
| WP-04 | F-027 | **PARTIAL** | MFA source contracts pass; clean reset is blocked earlier by F-062 historical RPC snapshot drift. |
| WP-05 | F-033 | NOT-STARTED | EXIF/GPS proof required. |
| WP-06 | F-011 | NOT-STARTED | Counsel/operator facts required. |
| WP-07 | F-001/F-002 | NOT-STARTED | Active-source brand remediation. |
| WP-08 | F-003 | NOT-STARTED | Public Peek capability decision. |

Completed elsewhere: F-014, F-049 and F-059.

## Newly exposed proof-chain defects

- **F-062:** migration `20260805073000` locks 23 authenticated SECURITY DEFINER RPCs but the actual catalogue contains 22; `discover_category_counts()` is intentionally SECURITY INVOKER. Clean reset stops before F-027.
- **F-063:** workflow pin verifier matched `uses:` but not standard `- uses:` lines, allowing mutable tags.
- **F-064:** infrastructure contract required direct `sessionStorage`, contradicting F-058's guarded storage boundary.

The current commit repairs F-060/F-063/F-064 and the certification-suite count. F-062 remains the next exact database repair.

## Exact next action

1. Commit and push the historical 22-RPC snapshot correction for F-062 with a regression contract.
2. Let PR #33 rerun Migration gates.
3. Confirm workflow pinning, package-lock normalization, trace storage and certification-count contracts pass.
4. Confirm clean reset reaches `20260807040000_admin_mfa_assurance_boundary.sql` and all 13 pgTAP assertions pass.
5. Mark F-027/F-062/F-063/F-064 and reopened F-058/F-060 DONE only with CI evidence.
6. Then proceed to WP-05/F-033.

## External blockers

- Vercel quota for F-054/WP-03.
- Preview/Production Supabase separation evidence.
- Branch protection/Pages console evidence.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
