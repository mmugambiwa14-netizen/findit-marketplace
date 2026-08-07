# REMEDIATION PROGRESS — START HERE

> Every code commit updates this ledger in the same commit.

**Repo:** `mmugambiwa14-netizen/findit-marketplace`  
**Branch:** `claude/peekalisting-audit-ui0z6l`  
**Baseline:** `main` @ `ee6f21231e5e963068efe8c4320f560f7a25f8f3`  
**Draft PR:** #33

## Branch topology — ONE integration path

```text
main (protected canonical base, merge target only)
  └── claude/peekalisting-audit-ui0z6l   ← ALL remediation, Cloudflare migration and certification work
```

`claude/peekalisting-audit-ui0z6l` is the **single** integration branch. Do **not** open another
remediation branch, and do **not** do implementation work on `main` — `main` is the protected merge target
and is only written by merging this branch once it is genuinely ready.

The reason this is stated explicitly: the repository previously fragmented into thirteen unreconciled
branches each holding a different piece of PeekaListing with no single integration path
(`REMEDIATION-PROMPT.md` §6 priority 3). That is the failure mode to avoid, not repeat.

Some CI evidence below records runs dispatched on `claude/peekalisting-remediation-handoff-d1mr2x`. That
branch was a strict descendant of this one and has been **fast-forwarded back into it losslessly** — no
merge commit, no cherry-pick, no divergence, and `ab2d533` remains in this branch's history. Those run
references are kept verbatim because they are the actual provenance of the proofs; the commits themselves
now live here.

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
- F-073: **BEHAVIOR PROVEN** — Recommendation database-gates run 31162602508 passes `v1_recommendation_services.sql` **29/29**. The suite asserted the pre-activation disabled catalog and contradicted the authoritative release-control migration; it now certifies post-activation behavior and still proves the disabled degradation path.
- F-074: **BEHAVIOR PROVEN** — run 31162845487 passes `v1_recommendation_service_operations.sql` **37/37** with services holding at 29/29. The stale pre-activation expectation is now a metadata/policy-table drift check.
- F-075: **BEHAVIOR PROVEN** — run 31163209835 passes `v1_recommendation_scale.sql` (9 tests, PASS) with the fixture crossing the curated publisher boundary through the authoritative trigger.
- F-076: **BEHAVIOR PROVEN** — run 31163529073 passes `v1_contextual_ecosystem_intelligence.sql` **44/44**.
- F-077, F-078, F-079: **BEHAVIOR PROVEN** — run 31164127969 passes personalization 20/20, analytics 23/23 and related-services 14/14.
- **RECOMMENDATION DATABASE MATRIX: GREEN.** Run 31164127969 reports
  `Recommendation database certification passed: 15 suites completed.` — the first fully green run of this
  matrix. The machine-readable register `audit/findings-status.csv` has now been appended with F-065…F-079,
  per the convention that proof-chain statuses land once the full matrix closes.
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

## Evidence from Recommendation database-gates run 31162602508

Dispatched on `claude/peekalisting-remediation-handoff-d1mr2x` @ `dfafd0b`.

- `v1_recommendation_services.sql` passed **29/29**, closing F-073.
- Every earlier suite held: publication-boundary 14/14, geospatial 19/19, foundation 62/62,
  projection-queue 20/20, database-lint 10/10, security-advisor 10/10, and both authenticated-RPC suites.
- The matrix advanced to its next exact failure: `v1_recommendation_service_operations.sql`, **1 failed of
  37** — test 16, "operational controls do not enable services during migration".

## F-074 — service-operations suite carried the same pre-activation expectation

`supabase/tests/v1_recommendation_service_operations.sql:82-85` asserted
`bool_and(not enabled)` over `recommendation_service_policies` — the identical pre-0100 expectation that
F-073 resolved, in a second file. Notably the assertion immediately following it already tolerates "a later
certification correction" for `schema_version`, so this file was half-updated for the same class of change.

**Repair.** Replaced with a consistency check that the `recommendation_foundation` operational control and
the authoritative policy table agree: `service_policy_source` names the policy table, `services_enabled` is
true, and `active_service_policy_count` equals the live count of enabled policies. This is a real drift
detector between the metadata 0100 writes and the table it describes — strictly more useful than the
obsolete assertion, and it holds the plan at 37 assertions. No control is weakened.

## Evidence from Recommendation database-gates run 31162845487

Dispatched on `claude/peekalisting-remediation-handoff-d1mr2x` @ `2b5b651`.

- `v1_recommendation_service_operations.sql` passed **37/37**, closing F-074.
- `v1_recommendation_services.sql` held at **29/29**; publication-boundary 14/14, geospatial 19/19,
  foundation 62/62, projection-queue 20/20 all held.
- Next exact failure: `v1_recommendation_scale.sql:57` — a hard SQL error, not an assertion failure.
  `ERROR: Authentication required` raised from `public.enforce_curated_listing_publisher()` line 7,
  aborting before `plan()` ("No plan found in TAP output", exit 3).

## F-075 — scale fixture did not cross the curated publisher boundary

Identical class to the publication-boundary repair already proven on this branch, in a third file. The
scale suite bulk-inserts 2,000 `kind = 'car'` listings plus one later concurrent-insert row directly into
`public.listings`, and the `listings_enforce_curated_publisher` BEFORE INSERT trigger rejects every one of
them without an authenticated publisher.

`enforce_curated_listing_publisher()` matches on **`new.kind`**, not the `category` column
(`20260806070000_enforce_curated_publishing_at_database_boundary.sql:11`), so `category = 'scale-cars'` is
irrelevant — the seller needs an approved **`car`** category and `new.seller_id = auth.uid()`.

**Repair.** Applied the same proven pattern: an approved fixture business plus a `car`
`business_category_approvals` row for the fixture seller, with JWT claims set only across each insert and
cleared immediately after. Both insert sites are bracketed separately, so the projection worker and every
assertion still run with no fixture auth in scope. The fixture writes **through** the authoritative trigger
rather than around it — no trigger is disabled, no direct-table privilege is granted, and no curated
publishing rule is weakened.

## Evidence from Recommendation database-gates run 31163209835

Dispatched on `claude/peekalisting-remediation-handoff-d1mr2x` @ `fd97873`.

- `v1_recommendation_scale.sql` **PASSED** (9 tests, 3s), closing F-075. The 2,000-row fixture now writes
  through `listings_enforce_curated_publisher` rather than aborting against it, so the projection drain,
  index-plan assertions and cursor-stability assertions in that suite executed for the first time in CI.
- `v1_recommendation_service_operations.sql` held at 37/37 and `v1_recommendation_services.sql` at 29/29.
- Next exact failure: `v1_contextual_ecosystem_intelligence.sql`, **1 failed of 43** — test 41,
  "rules are reported against their disabled services", have 0 / want 7.

## F-076 — contextual health counter asserted the pre-activation reading

Fourth instance of the pre-activation class. `contextual_ecosystem_health_v1()` derives
`rulesReferencingDisabledServices` by joining active rules to `recommendation_service_policies` where
`not policy.enabled` (`0068_contextual_ecosystem_completion.sql:274-279`). Before 0100 every service was
disabled, so all seven active rules were counted and the suite asserted 7.

The stated invariant in the test's own comment is that *a plan can never advertise a section whose service
would refuse to answer*. Pre-0100 that held **vacuously** — everything was disabled. Post-0100 it holds in
the useful direction: every active rule targets an enabled service, so the counter correctly reads 0.

**Repair.** Asserted 0, and — because a bare 0 is also what a broken counter would report — added a second
assertion that switches one service off inside the test transaction and requires the counter to detect the
stranded rule, then restores it. The drift detector is now proved to actually detect drift, which the
original 7-expectation never established.

## Evidence from Recommendation database-gates run 31163529073

Dispatched on `claude/peekalisting-remediation-handoff-d1mr2x` @ `e179fb3`.

- `v1_contextual_ecosystem_intelligence.sql` passed **44/44**, closing F-076.
- Next exact failure: `v1_recommendation_personalization.sql:66`, aborting before `plan()` with
  `Authentication required` from `enforce_curated_listing_publisher()`.

## F-077 / F-078 / F-079 — the final three suites

With both recurring classes now established and CI-proven four times over, the remaining three suites were
read directly rather than discovered one CI round-trip at a time. Each defect below is evidenced in the
fixture source, not assumed:

| Suite | Class | Evidence |
|---|---|---|
| `v1_recommendation_personalization.sql` | fixture | inserts `kind='car'` **and** `kind='property'` listings for one seller, so **both** approvals are required |
| `v1_recommendation_analytics.sql` | fixture | inserts a `kind='car'` listing with no authenticated publisher |
| `v1_recommendation_related_services.sql` | fixture **and** pre-activation | inserts a listing for one user and a service for another — the only suite crossing `enforce_curated_service_publisher` — and asserted `service_disabled` |

**F-079 detail.** The service publisher trigger requires `provider_id = auth.uid()` plus an approved
`'service'` category, and the two inserts belong to different users, so each gets its own fixture-auth
window with claims switched between them. Its stale assertion is retargeted to `degraded = false` rather
than to a success `reason`, because `0073_executable_related_services.sql` returns **no** `reason` key on
the success path; `degraded` is the precise discriminator, holding for a live answer while still failing on
both `service_disabled` and `timeout`. The disabled path is retained by toggling the policy off inside the
transaction and re-asserting `service_disabled`.

## Evidence from Recommendation database-gates run 31164127969 — MATRIX GREEN

Dispatched on `claude/peekalisting-remediation-handoff-d1mr2x` @ `1734823`.

```
Recommendation database certification passed: 15 suites completed.
```

| Suite | Result |
|---|---|
| `v1_private_authenticated_rpc_implementations` / `..._new_...` | PASS |
| `v1_database_lint_runtime_contract_repairs` | 10/10 |
| `v1_security_advisor_baseline` | 10/10 |
| `v1_recommendation_foundation` | 62/62 |
| `v1_recommendation_projection_queue` | 20/20 |
| `v1_recommendation_eligibility_geospatial` | 19/19 |
| `v1_recommendation_publication_boundary` | 14/14 |
| `v1_recommendation_services` | 29/29 |
| `v1_recommendation_service_operations` | 37/37 |
| `v1_recommendation_scale` | PASS |
| `v1_contextual_ecosystem_intelligence` | 44/44 |
| `v1_recommendation_personalization` | 20/20 |
| `v1_recommendation_analytics` | 23/23 |
| `v1_recommendation_related_services` | 14/14 |

Every suite passes on a clean `supabase db reset` across the full migration chain, with the SQL boundary and
migration/rollback pairing checks green in the same job.

## What this does and does not close

**Closed.** The recommendation/contextual database certification chain: F-065…F-079, recorded in
`audit/findings-status.csv`.

**NOT closed — do not mark these supported yet.** F-012 requires *all five* workflows green, and this run
proves only the database matrix. The frontend/source-contract surface was still red at the last full PR run
(`Frontend and source contracts`, `Repository, build and PWA gates`, `validate`, `verify`,
`repository-contracts`) and nothing in this session touched it. **F-012, F-058, F-060 therefore remain
open**, as do the proof-chain closures that depend on them. Marking them done on the strength of a green
database matrix would repeat exactly the F-002 failure mode the audit calls out: a control reporting success
over a surface it does not cover.

## Frontend and source-contract surface — LOCAL EVIDENCE

Run locally after `npm ci` (this environment has no database, but the JS suites, lint, typechecks and the
production build all run):

| Gate | Before | After |
|---|---|---|
| `node --test ./tests/*.test.mjs` | 766/776, **10 red** | **775/776**, 1 red |
| `node --test ./tests/security/*.test.mjs` | 41/41 | 41/41 |
| `npm run lint` | pass | pass |
| `npm run typecheck` / `typecheck:active` | pass | pass (293 modules) |
| `npm run build` + 5 post-build gates | pass | pass |

**The single remaining red is expected and must stay red:** test 158, *owner journey supports edit pause
resume relist unavailable and permanent delete*. `REMEDIATION-PROMPT.md` §WP-09 names this a **correct test
failing against a real defect**, owned by **F-029 / WP-15**. Do not touch it here.

Closed on this surface: **F-080** (npm-ci workflow count drifted 8→12; also closes F-060's proving test),
**F-081** (certification contracts bound to exact assertion wording that F-069/F-070 legitimately reworded),
**F-042 image contract** (one remaining `<img>`), **F-017** (PWA raster set), **F-082** (brand contract
contradicted the installability contract).

### F-017 — the shortcut that was available and wrong

A raster set already sat in `public/brand/findit-icon-*.png`, and pointing the manifest at it would have
turned all five red assertions green in one line. Those files depict the **retired FindIt mark** — a
magnifier and pin over a house and car — while the current identity is the binocular mark. Taking that
shortcut would have shipped the old logo as the PeekaListing home-screen icon.

Instead the set was rasterized from the approved `peekalisting-binoculars.svg` at 32/64/180/192/512 plus a
dedicated maskable 512 (mark scaled to 60% on `#050914`, since Android crops maskables to the inscribed
safe-zone circle and the test correctly refuses a maskable that reuses the plain file).

`public/offline.html` was also still showing users the FindIt raster — a real brand regression on the page
shown exactly when things are going wrong. Repointed.

**F-082** is worth noting as a genuine contradiction, not staleness: `peekaListingBrandContracts` demanded
every manifest icon be the SVG while `webAppManifest` demanded every icon be PNG. Mutually unsatisfiable.
The brand contract now asserts brand *ownership* (every icon a PeekaListing asset, none a FindIt raster),
which is strictly harder to pass and would have caught the shortcut above.

## SCOPE CORRECTION — "matrix green" means the recommendation runner, not all databases

Read this before quoting the green result above.

`scripts/run-recommendation-database-certification.sh` runs **15** suites, and those 15 are green
(run 31164127969, re-confirmed on this branch by the *Reset, lint and recommendation pgTAP* job in run
31165810890). That is what "recommendation database matrix green" means and all it means.

The Migration Gates job *Clean database migration and pgTAP* runs the **full** set: `Files=54, Tests=657`.
It is still red. Several of those 54 fail with the signature already diagnosed four times this session —
a hard SQL error before `plan()`, `Non-zero exit status: 3`, `Parse errors: No plan found in TAP output`.

> **Correction.** An earlier revision of this section named `v1_verified_business_journey.sql` as a member
> of the curated-publisher fixture class. That was inferred from its failure *signature* and is **wrong**:
> that suite never inserts into `public.listings` or `public.services`, only into `business_profiles`,
> `business_applications` and `business_category_approvals`. Its hard error has a different, still
> undiagnosed cause. The signature is shared by any pre-`plan()` SQL error, so it identifies a shape of
> failure, not a cause — diagnose each suite rather than pattern-matching from the summary line.

**Do not read the recommendation result as whole-database certification.** It is one runner of three.

## Current PR #33 CI inventory @ `ecaace9`

| Job | Result | Reading |
|---|---|---|
| Reset, lint and recommendation pgTAP | **success** | 15-suite recommendation matrix holds on this branch |
| security-behaviour, media-worker-image, contracts (x4) | **success** | — |
| Clean database migration and pgTAP | failure | full 54-suite matrix; curated-publisher fixture class (**F-084**) |
| Database reset, RLS and recommendation certification | failure | broader RLS matrix, same job family |
| Frontend and source contracts | failure | expected: F-029 test 158 |
| repository-contracts (listing publication) | failure | expected: F-029 test 158 |
| Repository, build and PWA gates | failure | not yet diagnosed |
| verify | failure | not yet diagnosed |
| validate (Cloudflare) | failure → **fixed by F-083**, awaiting re-run | |

## F-083 — the Cloudflare provisioning gate was dead

`cloudflare-provisioning-gates.yml:39` ran `node --test tests/criticalInfrastructureContracts.test.mjs`.
No such file exists; the real one is `tests/criticalHighInfrastructureContracts.test.mjs`, which
`critical-infrastructure-gates.yml` references correctly. CI reported `Could not find …` and exited 1 under
`bash -e`, which then skipped **every** remaining validation in the job: Edge Function typecheck, Wrangler
configuration dry-run, media worker image build, and the FFmpeg/non-root runtime checks.

So the entire Cloudflare provisioning validation had never run, behind a single red X that gave no
indication four further gates were unreached. RC-1 again, now on the authoritative hosting path.

Fixed both the specific defect (correct filename, plus that file added to the workflow's `paths` filter so
a change to the contract can trigger the gate) and the structural one (`if: ${{ !cancelled() &&
steps.install.outcome == 'success' }}` on each independent validation, reusing WP-01's idiom; the
FFmpeg check stays gated on the image build because it genuinely consumes it).

## F-084 — verified inventory of the curated-publisher fixture class

Rather than discover these one CI round-trip at a time, the whole class was identified statically: every
`supabase/tests/*.sql` that inserts directly into `public.listings` or `public.services` with **no**
`request.jwt.claim` set anywhere before that insert. Six suites match, and each was then read to confirm
the insert is fixture setup rather than a deliberate negative test:

| Suite | First unauthenticated insert | Confirmed |
|---|---|---|
| `database_auth_rls_smoke.sql` | `:118` listings | setup |
| `mvp_listing_location_privacy.sql` | `:40` listings | setup |
| `v1_admin_operations.sql` | `:18` listings | setup |
| `v1_legal_domain_isolation.sql` | `:67` **services** | setup |
| `v1_rls_matrix.sql` | `:24` listings | setup |
| `v1_tour_foundation.sql` | `:74` listings | setup |

None is asserting that an unauthenticated insert is rejected, so adding fixture auth to any of them removes
no coverage. Each needs approvals matching the `kind` of **every** listing it inserts (and `'service'` for
`v1_legal_domain_isolation.sql`, which crosses `enforce_curated_service_publisher`), per seller, with claims
cleared before the assertions begin.

Note `v1_admin_operations.sql` and `v1_legal_domain_isolation.sql` promote users to admin in their setup.
`enforce_curated_listing_publisher()` short-circuits for admins, so those two may only need a JWT subject
rather than category approvals — verify which, rather than adding approvals reflexively.

## State after F-029, F-083, F-084 (partial) and F-085

**The entire JS surface is green.** `tests/*.test.mjs` **776/776**, `tests/security/*.test.mjs` 41/41,
lint clean, `typecheck` and `typecheck:active` clean, production build plus its five post-build gates clean.
This is the first time the contract suite has been fully green.

**F-029 is closed and was not what the audit thought.** At baseline it was a real defect; on this branch the
owner lifecycle is fully implemented — `owner_transition_listing` allows submit/pause/resume/unavailable
(`20260807030000:48`) each with per-action source-status guards (`:60-69`), and `MyListings.jsx` wires every
action plus delete. The only failing assertion looked for the RPC name in
`src/services/listingCreationService.js`; it lives one layer down in
`src/repositories/listingCreationRepository.js:38`, which is this codebase's architecture. The contract now
asserts both halves of the path. The §3.3-protected ownership predicate was read and left untouched.

**F-029 was the single root cause of four failing CI jobs** — `Frontend and source contracts`,
`repository-contracts`, `Repository, build and PWA gates`, and *both* failing steps of the `verify` job
(Release candidate gates runs the contract suite twice: directly, and again inside
`Run reproducible internal certification`). All four should now clear.

**F-083 is confirmed working.** In the Cloudflare gate, five validations that had *never executed* now run
and pass: shell provisioning, infrastructure contracts, Edge Functions typecheck, media worker image build,
and the FFmpeg/non-root runtime check. It exposed exactly one genuine defect, **F-085**: the step rendered
`wrangler.toml` to `/tmp`, but wrangler resolves `main` relative to the config's own directory, so the entry
point could never resolve. Fixed by rendering at the repository root; reproduced both failure and fix
locally, where the dry-run then validates the whole binding surface (Durable Object, KV, queue, 3× R2, vars).

## F-084 — partial: the fixes worked and revealed the next layer

The six fixture repairs are effective. Total executed assertions in the full matrix rose **657 → 694**, and
`v1_rls_matrix` and `v1_tour_foundation` now get *past* their fixtures (4 and 13 assertions execute) before
erroring later, where previously they died at the insert. Six suites still end in a pre-`plan()` hard error:

| Suite | Assertions before the error |
|---|---|
| `v1_marketplace_profile_media.sql` | 9 (1 also failed) |
| `v1_tour_foundation.sql` | 13 |
| `v1_reconciled_privilege_and_notification_boundaries.sql` | 5 |
| `v1_peek_fulfilment_journey.sql` | 4 |
| `v1_rls_matrix.sql` | 4 |
| `v1_verified_business_journey.sql` | 1 |

These are **later** errors, not the original fixture class, so each needs its own diagnosis. Do not assume
the curated-publisher pattern applies again — that assumption already produced one wrong call this session.

## WP-05 / F-033 — DOES NOT REPRODUCE, control already present

The audit marked F-033 **LIKELY**, not CONFIRMED: the *absence of a strip step* was evidenced, the
*presence of GPS in served objects* was not. Rule 1 says confirm before editing. It does not hold.

`supabase/functions/_shared/trusted-image.ts` already strips metadata server-side, per format:

- **JPEG** — APP1 (`0xe1`, the EXIF marker), APP13 (`0xed`, IPTC), COM (`0xfe`), APP3–APP12 and APP15
- **PNG** — `eXIf`, `tEXt`, `zTXt`, `iTXt`, `tIME` chunks
- **WebP** — `EXIF` and `XMP` chunks, and it clears the VP8X feature-flag bits so the container stops
  advertising metadata it no longer carries

Both upload paths use it *before* the object exists — `listing-image-upload/index.ts:104` and
`marketplace-image-upload/index.ts:90` call `prepareTrustedImage(originalBytes)` and then upload the
returned **stripped** `bytes` (`:129` / `:120`), never `originalBytes`. The checksum and the upload intent
are computed over the stripped bytes too, so the authorised object and the stored object are the same thing.

The proving test the plan asked for already exists: `tests/trustedImageSanitization.test.mjs` builds PNG,
JPEG and WebP fixtures whose metadata payload is literally `GPS=-17.8252,31.0335` — Harare — and asserts
removal in all three, with `tests/storageUploadBoundary.test.mjs` covering the upload boundary. Both pass.

**Recorded as not-reproduced rather than fixed.** Writing a second strip step here would have been a phantom
fix over a working control, which §4 rule 1 exists to prevent. The Appendix C gates *"EXIF/GPS posture safe"*
and *"Exact property location safe"* can be satisfied from this evidence; a hosted spot-check of one served
object is still worth doing as Track B confirmation, but no in-repo work remains.

## Exact next action

1. Confirm the F-029 and F-085 pushes turn `verify`, `Repository, build and PWA gates`,
   `Frontend and source contracts`, `repository-contracts` and `validate` green.
2. Continue F-084: take each of the six suites above to its exact error and repair only that boundary.
3. `Repository, build and PWA gates` carries a smaller RC-1 cascade of its own — its contract-gate failure
   skips `Build production PWA` and `Compose final journey evidence`. Apply WP-01's `if:` idiom there too so
   those two stop hiding behind an unrelated failure.
4. Then WP-05/F-033 (EXIF/GPS stripping — do the hosted geotag check first), and the Cloudflare migration
   proper: `vercel.json`, `docs/deployment/vercel-staging-preview.md` and the Vercel assertions in
   `scripts/verify-deployment-security.mjs` are the remaining legacy surface.
2. Diagnose `Repository, build and PWA gates` and `verify`, which have not been looked at yet.
3. Confirm F-083 turns the Cloudflare gate green, and that its four previously-unreachable validations now
   actually execute rather than merely not-failing.
4. Only then consider F-012 supported, and with it F-058/F-060. Its gate must explicitly carve out F-029,
   which stays red until WP-15 lands.
2. Only then consider F-012 supported, and with it F-058/F-060. **F-029 will still be red** — that is
   correct and is WP-15's to close, so F-012's gate must account for it explicitly rather than waiting for a
   fully green suite that cannot exist until WP-15 lands.
3. Then WP-15/F-029 (owner lifecycle action — extend `owner_transition_listing` without altering its
   ownership predicate, per §3.3), or WP-05/F-033 (EXIF/GPS stripping), which the prompt marks independent.
4. Never grant direct authenticated listing writes, restore listing moderation or a retired RPC, weaken
   curated publishing, weaken founder-only admin authorization/MFA, disable an authoritative trigger, or
   weaken a contract merely to turn CI green.

**Two recurring classes to expect.** (a) *Pre-activation staleness* — assertions written before
`0100_release_control_consistency.sql` enabled the service catalog; likely in
`v1_recommendation_personalization.sql` and `v1_recommendation_related_services.sql`, which both reference
`service_disabled`. (b) *Fixtures that bypass the curated publisher boundary* — any suite inserting directly
into `public.listings` or `public.services`. Verify each against the migration chain before changing
anything, and repair fixtures by crossing the boundary, never by disabling it.
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
