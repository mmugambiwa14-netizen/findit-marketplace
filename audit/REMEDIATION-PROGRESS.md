# REMEDIATION PROGRESS — START HERE

> Every code commit updates this ledger in the same commit.

**Repo:** `mmugambiwa14-netizen/findit-marketplace`  
**Branch:** `claude/peekalisting-audit-ui0z6l`  
**Baseline:** `main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`  
**Draft PR:** #33

Read `audit/REMEDIATION-PROMPT.md` §3.3 before editing. Never weaken protected controls or reintroduce listing moderation, Peek moderation, payments or reputation.

## Status

- WP-01/F-013: DONE.
- WP-02/F-012/F-058/F-060/F-061: reopened PARTIAL while proof-chain follow-up F-063/F-064 reruns.
- WP-03/F-054: BLOCKED by Vercel build-rate limit.
- WP-04/F-027: PARTIAL; server aal2 boundary is committed.
- F-062: PARTIAL; historical 23-vs-22 RPC snapshot is corrected in the current commit.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`.

## Exact next action

1. Let draft PR #33 rerun Migration gates.
2. Confirm workflow pin verification now inspects standard `- uses:` lines and passes.
3. Confirm trace-storage, lock-normalization and 38-suite certification contracts pass.
4. Confirm clean reset passes migration `20260805073000` with the locked 22-RPC boundary.
5. Confirm the reset reaches `20260807040000_admin_mfa_assurance_boundary.sql`.
6. Confirm all 13 F-027 pgTAP assertions pass plus existing authorization and curated-business suites.
7. Only then mark F-027/F-062/F-063/F-064 and reopened F-058/F-060/F-012 DONE.
8. Proceed to WP-05/F-033.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
