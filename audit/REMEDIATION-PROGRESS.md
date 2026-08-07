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
- WP-03/F-054: **RECLASSIFIED AS CLOUDFLARE MIGRATION WORK** — no longer blocked, because it is no longer a Vercel problem. See "Hosting platform decision" below.
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
- Recommendation publication-boundary certification: **BEHAVIOR PROVEN** — the fixture repair worked. Run 31160257131 passes `v1_recommendation_publication_boundary.sql` 14/14 through the authoritative curated Cars publisher trigger, with geospatial holding at 19/19.
- F-073: **REPAIRED, AWAITING CI** — `v1_recommendation_services.sql` asserted the pre-activation disabled catalog and contradicted the authoritative release-control migration. Repaired to certify post-activation behavior while retaining disabled-path proof.
- F-014, F-049, F-059: DONE.

The full machine-readable register remains `audit/findings-status.csv`; proof-chain statuses will be appended in the final proof-record commit only after the full database matrix closes.

## Hosting platform decision — Vercel retired, Cloudflare authoritative

PeekaListing is moving off Vercel entirely. Vercel deployment infrastructure in this repository is now
**legacy infrastructure pending migration/removal**. Vercel and Cloudflare are explicitly *not* to be kept
as parallel production hosting systems.

Intended production direction:

```text
GitHub → CI/CD → Cloudflare → PeekaListing Web / PWA → Supabase Backend
```

No remediation effort is to be spent repairing Vercel deployments, quotas, staging or configuration, and
no new Vercel dependency or integration may be introduced. Vercel deployment success is **not** a release
requirement. Every previously Vercel-shaped item is reclassified as either *obsolete* or *Cloudflare
migration work*:

| Previously | Reclassified as | Why |
|---|---|---|
| WP-03/F-054 staging deploy blocked by Vercel build-rate limit | **Cloudflare migration work** | The capability is still required — `src/lib/stagingCapabilityPolicy.js:37-39` gates messaging, notifications, Peeks and current-location on a trusted staging environment, and WP-08/F-003 Peek release acceptance depends on it. The platform changes; the requirement does not. |
| B-3 / E-003 Vercel preview isolation | **Cloudflare migration work** | Preview-writing-production-Supabase is a backend isolation concern that survives the platform change. Only the Vercel-specific mechanism is obsolete. |
| WP-08/F-003 "set `VITE_FEATURE_TOURS` for Production in Vercel" | **Cloudflare migration work** | The release-acceptance decision stands; the configuration surface becomes Cloudflare. |
| Vercel quota exceeded / Vercel staging unavailable | **Obsolete** | Vercel is being retired; these are no longer defects to fix. |

Groundwork already present in-repo: `.github/workflows/provision-cloudflare-staging.yml`,
`.github/workflows/cloudflare-provisioning-gates.yml`, `workers/edge/`, and the
`integration/cloudflare-provisioning` branch. `vercel.json`, `docs/deployment/vercel-staging-preview.md`
and the Vercel assertions in `scripts/verify-deployment-security.mjs` and the deployment contract tests are
the legacy surface to migrate or remove — **not** in this package, and not to be extended meanwhile.

## Evidence from Recommendation database-gates run 31160257131

- `v1_recommendation_publication_boundary.sql` passed **14/14**, closing the fixture repair that was
  outstanding at handoff. The curated Cars publisher boundary was crossed through the authoritative
  insert-only trigger, not around it.
- `v1_recommendation_eligibility_geospatial.sql` held at **19/19**, `v1_recommendation_foundation.sql` at
  **62/62**, `v1_recommendation_projection_queue.sql` at **20/20**, database-lint at 10/10 and
  security-advisor baseline at 10/10.
- The matrix then advanced to its next exact failure: `v1_recommendation_services.sql`, 4 failed of 25
  (tests 11, 19, 20, 22).

## F-073 — recommendation services suite asserted the pre-activation catalog

**The test was stale, not the control.** `supabase/migrations/0059_independent_recommendation_services.sql`
installs the seven-service catalog with every service disabled.
`supabase/migrations/0100_release_control_consistency.sql:12-14` is the **reviewed release-control
activation point**: it enables that exact catalog and refuses to apply unless precisely seven policies end
up enabled (`:42-44`), then flips `services_enabled` and `orchestration_executes_services` to true. No later
migration touches `recommendation_service_policies`, so 0100 is authoritative and final.

The four failures were all the pre-activation expectation meeting post-activation reality:

| Test | Asserted | Actual | Reading |
|---|---|---|---|
| 11 | 0 services enabled | 7 | 0100 enabled the catalog by design |
| 19 | policy reads `enabled=false` | `true` | same |
| 20 | `service_disabled` | `subject_not_eligible` | service is live, so it proceeds to the subject lookup and correctly refuses a random UUID |
| 22 | `service_disabled` | `personalization_not_enabled` | service is live, so it reaches the opt-in preference check in `0071:205-211` and correctly returns before any `recommendation_events` access |

Both "actual" values are the correct fail-closed outcomes, verified by reading the function bodies
(`0059:184` and `0071:211`) rather than inferred from CI output.

**Repair.** The suite now certifies the authoritative post-activation state. Simply flipping the four
expectations would have silently deleted all coverage of the disabled degradation path, so that path is
retained instead by toggling two policies off inside the test transaction and re-proving that a disabled
service degrades *before* any subject lookup and *before* any event access. Net effect is stronger than the
original: 25 → 29 assertions, covering both the enabled and disabled boundaries.

No production trigger, grant, policy, country gate, admin/MFA rule, curated-publishing rule, listing
moderation path, Peek moderation path, payment path or reputation system is weakened, bypassed or
reintroduced. The fixture toggle is a transaction-local mutation performed as the test role and rolled
back; the runtime `service_role` still cannot mutate service policy, which the same suite asserts.

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

1. Run PR #33 Recommendation database gates with the F-073 services-suite repair.
2. Require `v1_recommendation_services.sql` to complete its full 29-assertion TAP plan while
   publication-boundary holds at 14/14, geospatial at 19/19, foundation at 62/62 and projection-queue at 20/20.
3. Continue the database matrix to the next exact failure and repair only that boundary. The suites after
   `v1_recommendation_services.sql` in runner order are the remaining unproven surface.
4. Never grant direct authenticated listing writes, restore listing moderation or a retired RPC, weaken curated publishing, weaken founder-only admin authorization/MFA, disable an authoritative trigger, or weaken a contract merely to turn CI green.
5. When all database suites pass, record final CI evidence and close proof-chain findings plus reopened F-012/F-058/F-060 as supported.
6. Proceed to WP-05/F-033 only after WP-04 proof-chain closure.

**Standing rule for this matrix.** When a pgTAP assertion and a migration disagree, establish which
migration is authoritative *by reading the migration chain in order* before changing either. Where a later
reviewed migration intentionally changed behavior, the older assertion is stale and the test is what gets
repaired — and the repair must preserve whatever real control the stale assertion was incidentally covering
(F-073 is the worked example).

## External blockers

- Preview/Production Supabase separation — **now Cloudflare migration work**, no longer Vercel preview isolation.
- Branch protection/Pages settings.
- Counsel/operator legal facts.
- Cloudflare/Supabase/DNS console evidence.
- ~~Vercel quota/staging deploy~~ — **removed. Obsolete: Vercel is being retired** (see "Hosting platform decision").

## Environment

Local shell cannot resolve GitHub and no local DB is available. GitHub Actions is the execution proof boundary.
