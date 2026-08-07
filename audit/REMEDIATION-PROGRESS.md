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
- F-070: PARTIAL; essential-notifications certification now uses the real media-upload and authenticated listing-submission RPC path, then exercises current owner/status/expiry/report/account events with human listing approval/rejection explicitly absent; awaiting clean-database rerun.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; F-065/F-066/F-067/F-068/F-069/F-070 will be appended in the final proof-record commit.

## Evidence from Migration Gates run 31151771259

- Every migration applied successfully.
- Corrected 22-RPC, 48-policy RLS, 13-case MFA, country-helper, seller-profile, marketplace-view and support suites passed again.
- The runner reached `v1_essential_notifications.sql` but failed before the TAP plan with `42501: permission denied for table listings` because the intermediate F-070 fixture attempted a direct authenticated `INSERT` into `public.listings`.
- That denial is the intended least-privilege runtime boundary. The canonical listing certification proves the supported path is: service-role upload authorization -> validated storage object -> upload completion -> authenticated `create_v1_listing_submission(...)`.
- The current F-070 repair now uses that same production path and stores the generated listing ID in a temporary fixture table for all downstream notification assertions.
- Human `listing_approved` / `listing_rejected` review remains absent from the current MVP; no moderation endpoint or direct table grant is restored.
- Frontend/source verification still has only the seven later-owned F-017/F-029/F-042 failures; immutable workflow pins, dependency normalization, trace storage boundary, lint, typechecks, Edge checks and build remain green.

## Exact next action

1. Let draft PR #33 rerun Migration gates with the runtime-authoritative F-070 listing fixture.
2. Confirm `v1_essential_notifications.sql` completes its full TAP plan through validated media, authenticated approved-seller auto-publication, zero human listing approval/rejection notifications, owner status change, expiry notice/idempotency, report resolution, account status, read-state and isolation assertions.
3. Continue the database runner through every remaining suite in order.
4. Repeat only for exact real failures; never grant direct authenticated listing writes, restore listing moderation or a retired RPC, weaken founder-only admin authorization/MFA, disable an authoritative trigger, or weaken a contract.
5. When all database suites pass, record final CI evidence and close F-027/F-062/F-063/F-064/F-065/F-066/F-067/F-068/F-069/F-070 plus reopened F-012/F-058/F-060 as supported.
6. Proceed to WP-05/F-033 only after WP-04 proof-chain closure.

## External blockers

- Vercel quota/staging deploy.
- Preview/Production Supabase separation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
