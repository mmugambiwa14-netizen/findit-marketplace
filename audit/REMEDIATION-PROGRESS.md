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
- F-066: **REOPENED/PARTIAL** — Migration Gates run 31157145537 exposed a post-closure regression: country-helper suite is 8/9 because the no-human-review rewrite of `owner_transition_listing` omitted the independent country publication guard. `20260807042300_restore_owner_transition_country_gate.sql` restores only that guard and is awaiting CI proof.
- F-067: behavior proven; seller-profile suite passes 10/10.
- F-068: behavior proven; marketplace-view suite passes 21/21.
- F-069: behavior proven; contact-support suite passes 12/12.
- F-070: behavior proven; essential-notifications suite passes 24/24 through the real media/upload/listing-submission path with human listing review absent.
- F-071: behavior proven; recommendation-foundation suite passes 62/62.
- F-072: behavior proven; recommendation projection-queue suite passes 20/20 in Migration Gates run 31154048816.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; proof-chain statuses will be appended in the final proof-record commit only after the full database matrix closes.

## Evidence from runs 31156730006 and 31157145537

- Both authenticated-RPC certification suites are green at 16/16 each. Zero authenticated-callable public SECURITY DEFINER functions remain and all historical public invoker compatibility boundaries are preserved.
- `v1_database_lint_runtime_contract_repairs.sql` is now green 10/10 after `20260807042200_restore_seller_peek_queue_variable_precedence.sql` restored only the parser-precedence directive on the current fulfilment-aware seller queue.
- The authoritative full Migration Gates matrix then reached `v1_private_country_helper_implementations.sql` and passed 8/9. Only assertion 4 failed: three of the four stored private caller paths still invoke the canonical public country helpers, but `private.owner_transition_listing(uuid,text)` no longer invokes `public.is_country_publishable(...)`.
- Root cause is deterministic. Migration 0046 established the country gate on owner submission. Migration `20260807030000_remove_listing_content_review_from_mvp.sql` correctly removed human review and made owner submission go directly to `available`, but accidentally omitted the independent country-publishability check. The later authenticated-RPC closure faithfully copied that newer body into private, exposing the omission to the existing country-helper certification.
- `20260807042300_restore_owner_transition_country_gate.sql` keeps the no-review MVP behavior and restores only `public.is_country_publishable(coalesce(listing_row.country_code, 'ZW'))` before owner submission can transition to `available`. The public RPC remains a SECURITY INVOKER wrapper to the private implementation, and the migration asserts that zero authenticated public SECURITY DEFINER drift is reintroduced.
- The dedicated recommendation runner has already advanced beyond these boundaries to `v1_recommendation_eligibility_geospatial.sql`, where its first direct listing fixture is rejected by the authoritative curated publisher trigger with `42501: Authentication required`. That fixture is the next sequential repair after F-066 returns to 9/9.
- Frontend/source verification remains separately red on later-owned contract/asset work; lint, typechecks, Edge checks, SQL boundary checks and production build remain green.

## Exact next action

1. Run PR #33 Migration Gates with `20260807042300_restore_owner_transition_country_gate.sql`.
2. Require `v1_private_country_helper_implementations.sql` to return to 9/9 while MFA, RPC, RLS and earlier suites remain green.
3. Continue the database matrix to `v1_recommendation_eligibility_geospatial.sql`. Repair its stale direct-listing fixture through an approved authenticated Cars publisher context; do not disable or bypass `enforce_curated_listing_publisher()`.
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
