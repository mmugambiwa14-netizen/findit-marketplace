# REMEDIATION PROGRESS — START HERE

> Every code commit updates this ledger in the same commit.

**Repo:** `mmugambiwa14-netizen/findit-marketplace`  
**Branch:** `claude/peekalisting-audit-ui0z6l`  
**Baseline:** `main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`  
**Draft PR:** #33

Read `audit/REMEDIATION-PROMPT.md` §3.3 before editing. Never weaken protected controls or reintroduce listing moderation, Peek moderation, payments or reputation.

## Status

- WP-01/F-013: DONE.
- WP-02/F-012/F-058/F-060/F-061: PARTIAL pending final proof-chain closure record.
- WP-03/F-054: BLOCKED by Vercel build-rate limit.
- WP-04/F-027: **BEHAVIOR PROVEN, PACKAGE PARTIAL** — all 13 server-side MFA assertions passed in Migration Gates run 31148806214.
- F-062: behavior proven; 22-RPC historical boundary applies.
- F-065: behavior proven; 48-policy RLS suite passes.
- F-066: behavior proven; country-helper suite passed in run 31149324338.
- F-067: PARTIAL; seller-profile fixture now crosses the real curated publishing trigger and awaits rerun.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; F-065/F-066/F-067 will be appended in the final proof-record commit.

## Evidence from Migration Gates run 31149324338

- Every migration applied successfully.
- Corrected 22-RPC, 48-policy RLS, 13-case MFA and private-country-helper suites passed.
- The runner stopped next at `v1_private_public_seller_profile_implementation.sql` because its fixture inserted listings without authenticated actor or approved category state.
- Frontend/source verification still has only the seven later-owned F-017/F-029/F-042 failures; workflow pinning, lock normalization, trace boundary, lint, typechecks, Edge checks and build are green.

## Exact next action

1. Let draft PR #33 rerun Migration gates.
2. Confirm `v1_private_public_seller_profile_implementation.sql` passes all ten assertions while the listing inserts cross the production trigger.
3. Continue the database runner through every remaining suite, especially private/public listing search, authenticated RPC implementations, Security Advisor, recommendations and curated-business behavior.
4. Repeat only for exact real failures; never disable an authoritative trigger or weaken a contract.
5. When all 38 suites pass, record final CI evidence and close F-027/F-062/F-063/F-064/F-065/F-066/F-067 plus reopened F-012/F-058/F-060 as supported.
6. Proceed to WP-05/F-033.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
