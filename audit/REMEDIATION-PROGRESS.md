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
- F-062: **BEHAVIOR PROVEN, PACKAGE PARTIAL** — post-boundary authenticated RPC drift is closed. Recommendation database-gates run 31156730006 proves both the original 0101 boundary and newer 22-RPC boundary at 16/16 each, with zero authenticated-callable public SECURITY DEFINER functions, all 57 original wrappers restored, and `discover_category_counts()` preserved as a direct least-privilege invoker read RPC.
- F-065: behavior proven; 48-policy RLS suite passes.
- F-066: behavior proven; country-helper suite passes 9/9.
- F-067: behavior proven; seller-profile suite passes 10/10.
- F-068: behavior proven; marketplace-view suite passes 21/21.
- F-069: behavior proven; contact-support suite passes 12/12.
- F-070: behavior proven; essential-notifications suite passes 24/24 through the real media/upload/listing-submission path with human listing review absent.
- F-071: behavior proven; recommendation-foundation suite passes 62/62.
- F-072: behavior proven; recommendation projection-queue suite passes 20/20 in Migration Gates run 31154048816.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; proof-chain statuses will be appended in the final proof-record commit only after the full database matrix closes.

## Evidence from Recommendation database-gates run 31156730006

- `20260807042000_close_post_boundary_authenticated_rpc_drift.sql` and `20260807042100_restore_authenticated_boundary_provenance.sql` both applied successfully on clean reset.
- `v1_private_authenticated_rpc_implementations.sql` passed all 16 assertions: zero authenticated-callable public SECURITY DEFINER functions, all 57 original 0101 wrappers restored, private privileged twins present, invoker/empty-search-path public wrappers intact, and historical role-grant matrices preserved.
- `v1_private_new_authenticated_rpc_implementations.sql` passed all 16 assertions after restoring the real historical 22-RPC boundary and separately certifying `discover_category_counts()` as a direct public SQL SECURITY INVOKER read RPC with no private privileged twin.
- F-062 is therefore behavior-proven again. No protected authorization or publication boundary was weakened to achieve this.
- The next suite, `v1_database_lint_runtime_contract_repairs.sql`, failed only its first assertion: two of the three previously ambiguous PL/pgSQL functions retained `#variable_conflict use_column`, while `private.seller_peek_request_queue(bigint,timestamptz,uuid,integer)` no longer did.
- Root cause is deterministic: the 42000 closure correctly replaced the stale private seller queue with the newer fulfilment-aware authoritative body from the public RPC. That newer definition post-dated the earlier 050745 lint repair and therefore did not contain the parser-precedence directive.
- `20260807042200_restore_seller_peek_queue_variable_precedence.sql` restores only `#variable_conflict use_column` to the latest private seller queue implementation. It also asserts the function remains private SECURITY DEFINER, its public counterpart remains an authenticated SECURITY INVOKER wrapper with empty search path, and zero authenticated public SECURITY DEFINER drift has reappeared.
- This is parser/lint compatibility only: no queue ordering, fulfilment state, pagination, privilege, return shape or product behavior is changed.
- The main database matrix had already advanced past F-072 to `v1_recommendation_eligibility_geospatial.sql`, whose first direct listing fixture still needs the next sequential repair after the lint compatibility suite is green.
- Frontend/source verification still has only the seven later-owned F-017/F-029/F-042 failures; immutable workflow pins, dependency normalization, trace storage boundary, lint, typechecks, Edge checks and build remain green outside those owned source contracts.

## Exact next action

1. Run PR #33 Recommendation database gates and Migration Gates with `20260807042200_restore_seller_peek_queue_variable_precedence.sql`.
2. Require `v1_database_lint_runtime_contract_repairs.sql` to pass all 10 assertions while both authenticated-RPC suites remain green.
3. Continue the main database runner through the next exact failure. The known next fixture is `v1_recommendation_eligibility_geospatial.sql`, whose direct listing setup must cross the curated publishing boundary through an approved authenticated seller context rather than bypassing the trigger.
4. Repeat only for exact real failures; never grant direct authenticated listing writes, restore listing moderation or a retired RPC, weaken founder-only admin authorization/MFA, disable an authoritative trigger, or weaken a contract.
5. When all database suites pass, record final CI evidence and close the proof-chain findings plus reopened F-012/F-058/F-060 as supported.
6. Proceed to WP-05/F-033 only after WP-04 proof-chain closure.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
