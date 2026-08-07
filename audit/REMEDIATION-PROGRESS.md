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
- F-062: **REOPENED/PARTIAL for post-boundary closure** — the new closure migration applies cleanly and the original authenticated-RPC suite now passes 16/16, proving zero authenticated-callable public SECURITY DEFINER functions and all 57 original wrappers restored. Historical newer-boundary provenance correction is awaiting CI.
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

## Evidence from Recommendation database-gates run 31156136049

- `20260807042000_close_post_boundary_authenticated_rpc_drift.sql` applied successfully on clean reset.
- `v1_private_authenticated_rpc_implementations.sql` passed all 16 assertions. This proves the actual security closure: no authenticated-callable public SECURITY DEFINER function remains, all 57 original 0101 compatibility wrappers exist, all have private privileged implementations, all 57 public wrappers are invoker SQL functions with empty search paths, and the historical role-grant matrices remain intact.
- The next suite, `v1_private_new_authenticated_rpc_implementations.sql`, failed only its first five provenance/count assertions: 20 wrappers carried the 20260805073000 marker while the test incorrectly expected 23.
- The historical migration itself explicitly locked **22** privileged RPCs, not 23. `discover_category_counts()` was born separately as a direct public SECURITY INVOKER SQL read RPC and was never one of those 22 privileged implementations. The pgTAP had incorrectly added it to the private-wrapper catalogue.
- Two genuine members of the historical 22 — `queue_response_peek_binding(uuid,uuid)` and `seller_peek_request_queue(bigint,timestamptz,uuid,integer)` — were later redefined by Peek fulfilment work. The closure preserved their behavior/security but temporarily replaced their historical provenance comments with the new closure marker.
- `20260807042100_restore_authenticated_boundary_provenance.sql` restores those two original markers and explicitly asserts that `discover_category_counts()` remains public, SQL, SECURITY INVOKER, empty-search-path, anonymously/authenticated callable, and has no private privileged twin.
- The corrected pgTAP now locks the real 22-RPC boundary and certifies `discover_category_counts()` separately rather than weakening it into a SECURITY DEFINER path.
- No publication trigger, founder-only admin rule, MFA requirement, direct table privilege, listing moderation path, Peek moderation path or retired RPC is restored or weakened.
- The main database matrix had already advanced past F-072 to `v1_recommendation_eligibility_geospatial.sql`, whose first direct listing fixture still needs the next sequential repair after F-062 closes.

## Exact next action

1. Run PR #33 Recommendation database gates and Migration Gates with the provenance migration/test correction.
2. Require both authenticated-RPC suites to pass completely: original boundary 16/16 and newer-boundary suite with the exact historical 22 wrappers plus the separate discover invoker assertions.
3. Once F-062 is fully re-proven, continue the main database runner at `v1_recommendation_eligibility_geospatial.sql` and repair only its stale publication fixture through approved authenticated seller context.
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
