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
- F-070: behavior proven; essential-notifications suite passes 24/24 in Migration Gates run 31152533443 through the real media/upload/listing-submission path with human listing review absent.
- F-071: PARTIAL; recommendation-foundation fixtures now cross the authoritative curated Cars publisher boundary with approved owner context and await clean-database rerun.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; F-065/F-066/F-067/F-068/F-069/F-070/F-071 will be appended in the final proof-record commit.

## Evidence from Migration Gates run 31152533443

- Every migration applied successfully.
- Corrected 22-RPC, 48-policy RLS, 13-case MFA, country-helper, seller-profile, marketplace-view and support suites passed again.
- `v1_essential_notifications.sql` passed all 24 assertions: validated media, authenticated approved-seller auto-publication, zero human listing approval/rejection notifications, owner status change, expiry notice/idempotency, report resolution, account status, safe-link/marketing constraints, read state, forgery denial and cross-user isolation.
- The runner then stopped before the TAP plan in `v1_recommendation_foundation.sql` at its first direct listing fixture with `42501: Authentication required` from `enforce_curated_listing_publisher()`.
- F-071 keeps the publication trigger authoritative. The recommendation test needs deliberate `available`, `draft` and content-suspended states rather than a listing-creation journey, so trusted SQL fixture creation now uses an approved Cars owner plus matching JWT and clears that JWT before recommendation authorization tests.
- No recommendation production function, listing privilege, moderation flow or publication trigger is changed.
- Frontend/source verification still has only the seven later-owned F-017/F-029/F-042 failures; immutable workflow pins, dependency normalization, trace storage boundary, lint, typechecks, Edge checks and build remain green.

## Exact next action

1. Let draft PR #33 rerun Migration gates with F-071.
2. Confirm `v1_recommendation_foundation.sql` completes its TAP plan with three queued fixture projections, exactly one public recommendation projection, event isolation, audited admin configuration and service-worker maintenance behavior intact.
3. Continue the database runner through every remaining suite in order.
4. Repeat only for exact real failures; never grant direct authenticated listing writes, restore listing moderation or a retired RPC, weaken founder-only admin authorization/MFA, disable an authoritative trigger, or weaken a contract.
5. When all database suites pass, record final CI evidence and close F-027/F-062/F-063/F-064/F-065/F-066/F-067/F-068/F-069/F-070/F-071 plus reopened F-012/F-058/F-060 as supported.
6. Proceed to WP-05/F-033 only after WP-04 proof-chain closure.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
