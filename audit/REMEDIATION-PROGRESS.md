# REMEDIATION PROGRESS — START HERE

> Every code commit updates this ledger in the same commit.

**Repo:** `mmugambiwa14-netizen/findit-marketplace`  
**Branch:** `claude/peekalisting-audit-ui0z6l`  
**Baseline:** `main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`  
**Draft PR:** #33

Read `audit/REMEDIATION-PROMPT.md` §3.3 before editing. Never weaken protected controls or reintroduce listing moderation, Peek moderation, payments or reputation.

## Status

- WP-01/F-013: DONE.
- WP-02/F-012/F-058/F-060/F-061: PARTIAL while F-063/F-064 proof-chain reruns.
- WP-03/F-054: BLOCKED by Vercel build-rate limit.
- WP-04/F-027: PARTIAL; server aal2 boundary is committed and the clean reset now reaches it.
- F-062: PARTIAL; historical 23-vs-22 RPC snapshot is corrected and the reset passes it.
- F-065: PARTIAL; five post-boundary RLS policies are normalized in the current commit.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; F-065 must be added when executable proof is recorded.

## Evidence from Migration Gates run 31148480088

- Every migration, including `20260807040000_admin_mfa_assurance_boundary.sql`, applied successfully.
- Clean reset then failed the first database suite because exactly five later policies retained per-row `auth.uid()` calls.
- Critical Infrastructure and Buyer Journey contracts passed on the same head.
- Workflow pin verification, environment validation, lint, all typechecks, Edge checks and production build passed.
- Source contracts remained red only for separately assigned product findings plus the database-proof follow-up addressed here.

## Exact next action

1. Let draft PR #33 rerun Migration gates.
2. Confirm `v1_rls_auth_initialization_plans.sql` reports all 48 initialized policies and zero raw calls.
3. Confirm the runner continues to `v1_admin_mfa_assurance_boundary.sql` and all 13 assertions pass.
4. Confirm existing private authorization and curated-business suites remain green.
5. Inspect the source suite and verify all proof-chain contracts pass; only the seven already assigned F-017/F-029/F-042 failures may remain.
6. Then mark F-027/F-062/F-063/F-064/F-065 and reopened F-012/F-058/F-060 DONE with exact run/job evidence.
7. Proceed to WP-05/F-033.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
