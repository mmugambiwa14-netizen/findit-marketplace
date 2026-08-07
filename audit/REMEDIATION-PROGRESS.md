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
- F-062: **REOPENED/PARTIAL for post-boundary closure** — historical 22-RPC behavior is proven, but later feature migrations reintroduced 17 authenticated-callable public SECURITY DEFINER RPCs. Migration `20260807042000_close_post_boundary_authenticated_rpc_drift.sql` snapshots that exact catalogue, preserves each latest implementation in `private`, restores invoker wrappers, and awaits CI proof.
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

## Evidence from Migration Gates run 31154048816

- Every migration applied successfully through the pre-closure schema.
- Corrected 22-RPC, 48-policy RLS, 13-case MFA, country-helper, seller-profile, marketplace-view, support, essential-notifications and recommendation-foundation suites passed again.
- `v1_recommendation_projection_queue.sql` passed all 20 assertions: coalesced queueing, listing-write fail-open behavior, browser isolation, bounded dead-lettering, stable error code storage, explicit retry, successful recovery, suspension removal, indexes and RLS.
- The main runner then advanced to `v1_recommendation_eligibility_geospatial.sql`, whose first direct listing fixture fails at the authoritative curated publisher boundary before TAP begins. That fixture is the next database-matrix item after the authenticated-RPC security closure is proven.
- The dedicated authenticated-RPC catalogue failure was fully isolated before changing the boundary: 17 public authenticated SECURITY DEFINER functions were present. Sixteen came from the curated-business and Peek fulfilment feature migrations; the 17th was `owner_transition_listing(uuid,text)`.
- `owner_transition_listing(uuid,text)` is also the missing original 0101 invoker wrapper: the no-human-review migration replaced that wrapper in-place with a new public SECURITY DEFINER implementation while leaving its private predecessor behind. This single identity explains both the 17-function exposure and the 56/57 wrapper count.
- The closure migration is catalogue-locked to those exact 17 identities. It copies the current authoritative function definition into `private`, handles older private implementations safely, recreates the public surface as SECURITY INVOKER SQL wrappers, preserves named-role grants/defaults/results/planner attributes, keeps the original 0101 marker on `owner_transition_listing`, and fails if any unexpected privileged RPC appears.
- No publication trigger, founder-only admin rule, MFA requirement, direct table privilege, listing moderation path, Peek moderation path or retired RPC is restored or weakened.
- Frontend/source verification still has only the seven later-owned F-017/F-029/F-042 failures; immutable workflow pins, dependency normalization, trace storage boundary, lint, typechecks, Edge checks and build remain green.

## Exact next action

1. Run PR #33 Migration Gates with `20260807042000_close_post_boundary_authenticated_rpc_drift.sql`.
2. Require `v1_private_authenticated_rpc_implementations.sql` to prove zero authenticated-callable public SECURITY DEFINER functions and all 57 original 0101 wrappers restored, with the historical role-grant matrices unchanged.
3. If the closure migration or RPC suite exposes an exact implementation/result/grant incompatibility, repair only that identity; do not relax the catalogue assertion.
4. Once F-062 is re-proven, continue the main database runner at `v1_recommendation_eligibility_geospatial.sql` and repair only its stale publication fixture through approved authenticated seller context.
5. Repeat only for exact real failures; never grant direct authenticated listing writes, restore listing moderation or a retired RPC, weaken founder-only admin authorization/MFA, disable an authoritative trigger, or weaken a contract.
6. When all database suites pass, record final CI evidence and close the proof-chain findings plus reopened F-012/F-058/F-060 as supported.
7. Proceed to WP-05/F-033 only after WP-04 proof-chain closure.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
