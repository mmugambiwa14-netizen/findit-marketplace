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
- F-068: behavior proven; marketplace-view suite passes 21/21.
- F-069: behavior proven; contact-support suite passes 12/12.
- F-070: behavior proven; essential-notifications suite passes 24/24 through the real media/upload/listing-submission path with human listing review absent.
- F-071: behavior proven; recommendation-foundation suite passes 62/62 in Migration Gates run 31153272606.
- F-072: PARTIAL; recommendation projection-queue fixture now crosses the authoritative curated Cars publisher boundary and removes obsolete human-moderation narrative; awaiting clean-database rerun.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; F-065/F-066/F-067/F-068/F-069/F-070/F-071/F-072 will be appended in the final proof-record commit.

## Evidence from Migration Gates run 31153272606

- Every migration applied successfully.
- Corrected 22-RPC, 48-policy RLS, 13-case MFA, country-helper, seller-profile, marketplace-view, support and essential-notifications suites passed again.
- `v1_recommendation_foundation.sql` passed all 62 assertions with three controlled listing states crossing the curated Cars publisher boundary and the existing projection/event/admin/worker contracts unchanged.
- The runner then stopped before TAP in `v1_recommendation_projection_queue.sql` at its first public listing fixture with `42501: Authentication required` from `enforce_curated_listing_publisher()`.
- F-072 keeps that publication trigger authoritative. The projection-queue test needs one controlled public Cars listing to simulate queue failure/dead-letter/retry behavior, so trusted SQL fixture creation now uses an approved Cars owner plus matching JWT and clears fixture auth before the queue assertions.
- The same test's old comment claimed owner title edits re-queued listings for moderation. The final `protect_listing_managed_fields()` no longer does that in the no-review MVP, so the comment is corrected and the post-failure trusted update is described only as deterministic re-enqueue after the simulated queue dependency recovers.
- A separate Recommendation database-gates run exposed an authenticated-RPC catalogue failure (17 authenticated-callable public SECURITY DEFINER functions; 56/57 expected wrappers). It is queued for investigation after the current F-072 matrix step so remediation remains sequential.
- Frontend/source verification still has only the seven later-owned F-017/F-029/F-042 failures; immutable workflow pins, dependency normalization, trace storage boundary, lint, typechecks, Edge checks and build remain green.

## Exact next action

1. Let draft PR #33 rerun Migration gates with F-072.
2. Confirm `v1_recommendation_projection_queue.sql` completes its full TAP plan: coalesced queueing, listing-write fail-open behavior, browser isolation, bounded dead-lettering, stable error codes, explicit retry, successful recovery, suspension removal, indexes and RLS.
3. Continue the main database runner through every remaining suite in order.
4. Once F-072 is proven, investigate the dedicated Recommendation database-gates authenticated-RPC catalogue failure exactly: enumerate the 17 final public SECURITY DEFINER functions and identify the missing 57th wrapper before changing any security boundary.
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
