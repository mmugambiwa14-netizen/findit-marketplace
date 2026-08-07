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
- WP-04/F-027: **BEHAVIOR PROVEN, PACKAGE PARTIAL** — all 13 server-side MFA assertions pass on clean reset.
- F-062: behavior proven; 22-RPC historical boundary applies.
- F-065: behavior proven; 48-policy RLS suite passes.
- F-066: behavior proven; country-helper suite passes 9/9.
- F-067: behavior proven; seller-profile suite passes 10/10.
- F-068: behavior proven; marketplace-view suite passes 21/21 in Migration Gates run 31150080956.
- F-069: PARTIAL; contact-support certification now targets the live keyset admin RPC while explicitly preserving the retired offset RPC revocation; awaiting rerun.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; F-065/F-066/F-067/F-068/F-069 will be appended in the final proof-record commit.

## Evidence from Migration Gates run 31150080956

- Every migration applied successfully.
- Corrected 22-RPC, 48-policy RLS, 13-case MFA, country-helper, seller-profile and marketplace-view suites passed.
- `v1_private_marketplace_view_implementation.sql` passed all 21 assertions while listing and service fixtures crossed the authoritative curated publisher triggers.
- The runner stopped next at `v1_contact_support.sql`: the retired offset function `admin_support_request_rows(...)` correctly returned database-level `permission denied for function admin_support_request_rows`, while the stale test expected the pre-retirement application error `admin access required`.
- Migration `20260805033000_disable_legacy_offset_admin_rpcs.sql` deliberately revoked the old offset endpoint from authenticated users; `admin_support_request_rows_page(...)` is the live keyset replacement and retains authenticated EXECUTE with admin authorization inside the function.
- Frontend/source verification still has only the seven later-owned F-017/F-029/F-042 failures; immutable workflow pins, dependency normalization, trace storage boundary, lint, typechecks, Edge checks and build remain green.

## Exact next action

1. Let draft PR #33 rerun Migration gates with F-069.
2. Confirm `v1_contact_support.sql` proves the retired offset RPC remains unreachable, ordinary users are rejected by the live keyset endpoint, admins can page the inbox, and resolution/audit behavior passes.
3. Continue the database runner through every remaining suite in order.
4. Repeat only for exact real failures; never restore a retired RPC, disable an authoritative trigger, or weaken a contract.
5. When all database suites pass, record final CI evidence and close F-027/F-062/F-063/F-064/F-065/F-066/F-067/F-068/F-069 plus reopened F-012/F-058/F-060 as supported.
6. Proceed to WP-05/F-033 only after WP-04 proof-chain closure.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
