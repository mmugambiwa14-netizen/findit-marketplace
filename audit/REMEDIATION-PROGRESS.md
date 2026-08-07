# REMEDIATION PROGRESS — START HERE

> Every code commit updates this ledger in the same commit.

**Repo:** `mmugambiwa14-netizen/findit-marketplace`  
**Branch:** `claude/peekalisting-audit-ui0z6l`  
**Baseline:** `main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`  
**Draft PR:** #33

Read `audit/REMEDIATION-PROMPT.md` §3.3 before editing. Never weaken protected controls or reintroduce listing moderation, Peek moderation, payments or reputation.

## Status

- WP-01/F-013: DONE.
- WP-02/F-012/F-058/F-060/F-061: PARTIAL while F-063/F-064 proof-chain closure is recorded.
- WP-03/F-054: BLOCKED by Vercel build-rate limit.
- WP-04/F-027: **BEHAVIOR PROVEN, PACKAGE PARTIAL** — clean reset reached the MFA suite and all 13 assertions passed in Migration Gates run 31148806214.
- F-062: behavior proven; the corrected 22-RPC boundary applied successfully.
- F-065: behavior proven; the 48-policy RLS initialization suite passed.
- F-066: PARTIAL; the later country-helper test now follows private caller implementations and awaits rerun.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; F-065/F-066 must be appended in the final proof-record commit.

## Evidence from Migration Gates run 31148806214

- Every migration applied successfully.
- The corrected 22-RPC snapshot passed.
- `v1_rls_auth_initialization_plans.sql` passed all four assertions, covering exactly 48 initialized policies and zero raw per-row calls.
- `v1_admin_mfa_assurance_boundary.sql` passed all 13 assertions.
- The runner then failed later at country-helper assertion 4 because it inspected public caller bodies after migrations 0097/0101 had moved them to private.

## Exact next action

1. Let draft PR #33 rerun Migration gates.
2. Confirm `v1_private_country_helper_implementations.sql` passes all 9 assertions.
3. Continue through every remaining database certification suite, including existing authorization and curated-business suites.
4. Confirm source contracts remain at only the seven later-owned F-017/F-029/F-042 failures.
5. Record final CI evidence and mark F-027/F-062/F-063/F-064/F-065/F-066 and reopened F-012/F-058/F-060 DONE where supported.
6. Proceed to WP-05/F-033.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
