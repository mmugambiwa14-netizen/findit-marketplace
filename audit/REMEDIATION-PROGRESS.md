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
- F-062: **BEHAVIOR PROVEN, PACKAGE PARTIAL** — post-boundary authenticated RPC drift is closed. Both original and newer authenticated-RPC suites pass 16/16 with zero authenticated-callable public SECURITY DEFINER functions and all compatibility boundaries preserved.
- F-065: behavior proven; 48-policy RLS suite passes.
- F-066: **BEHAVIOR PROVEN AGAIN** — Migration Gates run 31159384054 proves the restored owner country-publication guard and returns the country-helper suite to 9/9 while the no-human-review MVP behavior remains intact.
- F-067: behavior proven; seller-profile suite passes 10/10.
- F-068: behavior proven; marketplace-view suite passes 21/21.
- F-069: behavior proven; contact-support suite passes 12/12.
- F-070: behavior proven; essential-notifications suite passes 24/24 through the real media/upload/listing-submission path with human listing review absent.
- F-071: behavior proven; recommendation-foundation suite passes 62/62.
- F-072: behavior proven; recommendation projection-queue suite passes 20/20.
- Recommendation geospatial certification: **BEHAVIOR PROVEN** — Recommendation database-gates run 31159888350 passes `v1_recommendation_eligibility_geospatial.sql` 19/19 through the curated Cars publisher boundary.
- Recommendation publication-boundary certification: **PARTIAL / fixture repair awaiting CI** — the next suite reached its direct Cars fixture before TAP and was rejected by `enforce_curated_listing_publisher()` with `42501: Authentication required`. The fixture now uses an approved Cars business/category plus matching seller JWT and clears fixture auth immediately after publication.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; proof-chain statuses will be appended in the final proof-record commit only after the full database matrix closes.

## Evidence from Recommendation database-gates run 31159888350

- All authenticated-RPC, database-lint and security-advisor suites remained green.
- `v1_recommendation_foundation.sql` passed 62/62.
- `v1_recommendation_projection_queue.sql` passed 20/20.
- `v1_recommendation_eligibility_geospatial.sql` passed all 19 assertions after its fixture crossed the authoritative curated Cars publisher boundary. Privacy-safe geography, GiST use, seller suspension/restoration, event eligibility and deletion cascades all remained intact.
- The runner then reached `v1_recommendation_publication_boundary.sql` and stopped before TAP at its first direct Cars listing insert with `42501: Authentication required` from `enforce_curated_listing_publisher()`.
- The curated publisher trigger is insert-only. The publication-boundary test therefore needs approval/auth context only for its initial controlled fixture insert; its later suspension and status mutations do not cross that trigger.
- The test now creates an approved Cars business/category for its seller, sets matching seller JWT claims for the listing insert, writes through the authoritative trigger, and clears fixture claims before the worker and eligibility assertions.
- No production trigger, direct-table privilege, country gate, admin/MFA rule, listing moderation path, Peek moderation path, payment path or reputation system is weakened or bypassed.
- Frontend/source verification remains separately red on later-owned source-contract/asset work; lint, typechecks, Edge checks, SQL boundary checks and production build remain green outside those known contracts.

## Exact next action

1. Run PR #33 Migration Gates and Recommendation database gates with the publication-boundary fixture correction.
2. Require `v1_recommendation_publication_boundary.sql` to complete its full TAP plan while geospatial remains 19/19 and all earlier suites stay green.
3. Continue the database matrix to the next exact failure and repair only that boundary.
4. Never grant direct authenticated listing writes, restore listing moderation or a retired RPC, weaken curated publishing, weaken founder-only admin authorization/MFA, disable an authoritative trigger, or weaken a contract merely to turn CI green.
5. When all database suites pass, record final CI evidence and close proof-chain findings plus reopened F-012/F-058/F-060 as supported.
6. Proceed to WP-05/F-033 only after WP-04 proof-chain closure.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
