# FindIt listing intelligence — handoff

Written 2026-07-29. Supersedes any earlier handoff for the same branch.

## 1. Where the work lives

| Item | Value |
|---|---|
| Repository | `mmugambiwa14-netizen/findit-marketplace` |
| Branch | `feature/listing-intelligence-foundation` (never work on `main`) |
| Pull request | #1, draft, must stay draft |
| Head at handoff | this commit, after `9fa6711c71e19f56f51efb6b18056dbaf8404abb` |
| Previous heads | `9fa6711` (Phase 3 handoff refresh), `06617e3` (Phase 3 completion), `7737924` (handoff), `8e2cd94` (runtime fixes), `aaeeef4` (prior session) |
| SQL boundary | migration `0068`, 68 migrations and 39 rollback capsules |
| CI on head | all four required checks pass |

Confirm the real head before doing anything:

```
git fetch origin feature/listing-intelligence-foundation
git rev-parse origin/feature/listing-intelligence-foundation
gh pr view 1 --json state,isDraft,headRefOid
gh pr checks 1
```

Do not create a replacement branch, a replacement PR, a new repository, or a
parallel implementation. Do not merge PR #1.

The main checkout at
`C:\Users\mmuga\OneDrive\Desktop\FindIt-Extensive-Product-Audit-Remediated-v2-2026-07-27`
contains intentional uncommitted branding changes. Do not reset, clean, stash or
switch that worktree. Feature edits in this continuation were made in the
separate worktree `C:\tmp\findit-listing-intel-review-9fa6711`.

## 2. What changed in this session

Earlier commits: `8e2cd94` fixed the runtime-reachability defects, `7737924`
added this document, `06617e3` completed Phase 3 and closed four hardening
findings, and `9fa6711` refreshed the handoff. All four checks passed on
`9fa6711`.

This continuation resolves the publishable-key gateway blocker and local release
gate gaps:

- Public recommendation functions and `contextual-ecosystem` now use
  `verify_jwt = false` so browsers using opaque `sb_publishable_*` keys can
  reach the function-level public boundary.
- `personalized-recommendations` remains `verify_jwt = true`.
- Recommendation identity and service RPC timeouts now abort underlying
  fetch/PostgREST work instead of only racing the caller.
- Contextual orchestration uses PostgREST `.abortSignal(...)` and CORS now
  allows `authorization`, `apikey`, `content-type`, and `x-client-info`.
- Recommendation runtime publishable-key lookup reuses
  `configuredPublishableKey()`, including `SUPABASE_PUBLISHABLE_KEY`,
  `SUPABASE_PUBLISHABLE_KEYS`, and legacy `SUPABASE_ANON_KEY`.
- Circuit-breaker persistence is registered with `EdgeRuntime.waitUntil` when
  available and awaited in non-Edge runtimes.
- CI now typechecks every Supabase Edge Function with Deno through
  `npm run typecheck:edge-functions`.
- The hosted recommendation smoke harness now checks browser-style preflight,
  Supabase client transport, public services, contextual orchestration, and the
  protected personalized boundary.
- The Windows CRLF-only Tour moderation contract now normalizes line endings
  before its branch extraction assertion.

Sections 2.1 and 2.2 below describe `8e2cd94`; section 2.3 describes `06617e3`.

### 2.1 and 2.2 — the runtime-reachability defects

`8e2cd94` fixes two defects that made the **entire Phase 2 recommendation
surface return empty results at runtime** even though every offline gate and all
four CI workflows were green on `aaeeef4`.

Both defects live on the browser-adapter to Edge-Function to PostgREST path.
No gate in the repository exercises that path end to end, which is why CI was
green and the feature was nonetheless dead.

### Defect 1 (High) — five service functions were unreachable over PostgREST

`0059` created these with **anonymous** parameters:

- `similar_listings_service_v1(uuid, text, integer)`
- `seller_recommendations_service_v1(uuid, text, integer)`
- `related_services_service_v1(uuid, text, integer)`
- `related_products_service_v1(uuid, text, integer)`
- `nearby_service_v1(uuid, text, integer, integer)`

`supabase/functions/_shared/recommendation-service.ts` calls them through
PostgREST with **named** arguments (`p_subject_listing_id`, `p_cursor`,
`p_limit`, `p_max_distance_meters`). PostgREST resolves RPC arguments by name,
so a function whose parameters have no names can never be matched. Every call
returned `PGRST202`, the runtime counted it as a failure and answered with the
fail-soft empty payload.

`0060` had already corrected `recently_listed_service_v1` and
`personalized_recommendation_service_v1` the same way. `0066` finishes the set.

Why no test caught it: `supabase/tests/v1_recommendation_services.sql` calls the
functions **positionally** (`similar_listings_service_v1(gen_random_uuid(), null, 12)`),
which works fine against anonymous parameters. Only the named-argument path
breaks, and nothing exercised it.

Fix: `supabase/migrations/0066_recommendation_service_named_arguments.sql`, with
matching rollback capsule. Parameter names cannot be introduced by
`create or replace`, so the functions are dropped and recreated — which makes
them **new** functions, so Supabase's default privileges re-grant `EXECUTE` to
`anon` and `authenticated`. The migration restates the `0027` revoke boundary.
This is a recurring drift class in this repository; restate the revoke on every
migration that creates or recreates a function.

### Defect 2 (High) — a null cursor was rejected as a bad cursor

`recommendation-service.ts` guarded the cursor with
`body.cursor !== undefined && (typeof body.cursor !== "string" || ...)`.

`src/services/recommendationServices.js` always sends an explicit `cursor` key,
`null` on a first page. `null !== undefined` is true and `typeof null !== "string"`
is true, so **every uncached first-page request** was answered `400 invalid_cursor`.

`src/services/notificationContracts.js:57` already uses the correct repository
convention (`!== null && !== undefined`); the recommendation runtime was the
outlier.

### Also fixed on the same surface

| Area | Problem | Resolution |
|---|---|---|
| `recommendation-service.ts` | A fresh cache hit returned `public` Cache-Control even for a signed-in viewer, while the equivalent cache miss returned `private` | Both paths now share `viewerCacheControl(viewerId)` |
| `contextual-ecosystem/index.ts` | `public, max-age=30` was sent on rejected requests **and** on fail-soft empty plans, so a transient outage stayed cached for the full window after recovery | Default is now `no-store`; only a complete plan gets `CACHEABLE_PLAN` |
| `contextual-ecosystem/index.ts` | The abort timer was only cleared on the success path | `clearTimeout` moved into `finally` |
| `contextualEcosystemService.js` | `sections.every(validSection)` discarded the whole plan if any single section failed the contract | Invalid sections are now dropped individually; the result is marked degraded |
| `recommendationServices.js` | No deduplication and no cap on returned items | Deduplicated by `listingId`, truncated to the requested page size |
| `recommendationServices.js` | Timeout stopped waiting but left the request in flight; no caller cancellation | Real `AbortController`; accepts a caller `signal`; reason `cancelled` |
| `recommendationEventsService.js` | A UUID was generated on every call even when a session id already existed | Reordered to read first |

Regression coverage added in `tests/recommendationServiceContracts.test.mjs` and
`tests/recommendationClientContracts.test.mjs` for the argument-name contract,
the null-cursor first-page signal, cancellation, and bounding.

### 2.3 — Phase 3 completion and runtime hardening (`06617e3`)

**Migration `0068` completes Phase 3.** The `0063` plan resolved sections from
taxonomy scope alone. Four gaps are closed:

- **Service availability.** A rule whose service is disabled is no longer
  proposed, because the section it would produce can only come back empty. All
  seven policies ship disabled, so with default configuration the plan is now
  correctly empty until a service is explicitly enabled and certified.
- **Listing state and location.** Rules may require location, price or sibling
  seller inventory, or a minimum quality score or a listing status. Only
  *presence* is tested; no coordinate, price or seller value leaves the
  orchestrator.
- **Precedence and conflict resolution.** Subcategory beats category beats
  global, ties broken deterministically by rule priority, then context priority,
  then rule id. The winning tier is returned as a stable `precedence` value so a
  plan can be explained.
- **Rule validation.** `contextual_conditions_valid_v1` enforces a closed
  vocabulary through a table constraint, so an unknown key makes a rule inert
  rather than silently universal.

The plan payload is now `contractVersion` 2. Section fields are additive, so the
existing frontend adapter is unaffected.

**Contextual operational health.** `contextual_ecosystem_health_v1` plus a
`contextual-ecosystem-health` Edge Function, behind the same trusted
monitoring-credential boundary as `recommendation-service-health`
(`FINDIT_CONTEXTUAL_HEALTH_SECRET`, constant-time compared, `verify_jwt = false`
so the function's own check is authoritative). Counts and timestamps only.

**Migration `0067` closes findings O-3 to O-6:**

| Finding | Resolution |
|---|---|
| O-3 per-isolate breaker | Durable `recommendation_service_circuit_state`, read on the same call that already fetches the policy so the hot path gains no additional round trip. The in-isolate map is kept as a fast local short-circuit. Outcomes are persisted through `EdgeRuntime.waitUntil` when available and awaited outside Edge. |
| O-4 no abuse control | Windowed request budget keyed by an opaque salted digest (`FINDIT_REQUEST_BUDGET_SALT`). No address, header value or account identifier is stored. Consumed only when a request is about to reach the database, and **fails open**. |
| O-4 cache-key amplification | Page sizes are a closed bucket set (6, 12, 24, 48, 100). The adapter requests a bucket value directly, so requested page, returned page and next cursor stay aligned. |
| O-5 bypassable body guard | `readBoundedJson` in `_shared/request-guards.ts` bounds bytes actually buffered. Used by both runtimes. |
| O-6 unbounded identity call | `auth.getUser()` is made through an abortable fetch and capped at 1000 ms. A slow response is treated as anonymous, which is safe because the one authentication-required service rejects a null viewer outright. |

**A required new secret.** `FINDIT_REQUEST_BUDGET_SALT` must be set before
deployment or the request budget silently does nothing (`clientHash` returns
null when the salt is absent, and the budget is then skipped). This is
deliberate fail-open behaviour, but it means an unset salt looks identical to a
working deployment. `FINDIT_CONTEXTUAL_HEALTH_SECRET` is likewise required for
the new health endpoint, which refuses every request without it.

## 3. Verified state

Executed locally in `C:\tmp\findit-listing-intel-review-9fa6711` on Node 24:

| Gate | Result |
|---|---|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run test:contracts` | pass, 312/312 |
| `npm run test:recommendation-contracts` | pass, 49/49 |
| `npm run verify:sql-boundary` | pass, 68 migrations, 39 rollback capsules |
| `npm run verify:hygiene` | pass, 646 files |
| `npm run verify:source-graph` | pass, 359 modules, 0 unresolved |
| `npm run audit:product-surface` | pass, 0 failures, 1 warning |
| `npm run typecheck:edge-functions` | pass, Deno checked every file under `supabase/functions` |
| `npm run audit:production` | pass, no reachable Moderate/High/Critical advisories |
| `npm run build` (NODE_ENV=production) | pass, 534,644 B raw / 157,831 B gzip |

`npm run validate:env` fails closed without local `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`, which is expected for this worktree.

**CI on `06617e3`: all four required checks pass** — `verify`, `Frontend and
source contracts`, `Database reset, RLS and recommendation certification`, and
`Reset, lint and recommendation pgTAP`. This is what validates migrations `0067`
and `0068` and the new pgTAP assertions, none of which could be run locally.

The previous Windows-only contract failure in
`tests/tourMilestone6ModerationAdmin.test.mjs` is fixed by normalizing line
endings before the literal branch extraction.

**Not verified locally:** anything needing Docker. `supabase start`, the full
migration chain, `db lint`, and all pgTAP suites could not run — the Docker
daemon is unreachable in this environment. Those run in CI only. **CI results
for `8e2cd94` were still in flight when this document was written — read them
before trusting any pgTAP or migration claim.**

## 4. Immediate next actions

1. **Configure required secrets before any hosted deployment.**
   `FINDIT_REQUEST_BUDGET_SALT`, `FINDIT_RECOMMENDATION_HEALTH_SECRET`, and
   `FINDIT_CONTEXTUAL_HEALTH_SECRET`. The budget salt fails open when unset, so
   an unconfigured deployment looks identical to a working one.

2. **Enable and certify what is currently disabled.** All seven service policies
   ship `enabled = false`, and `contextual-ecosystem` is registered
   `enabled = false` in `supabase/config.toml`. With `0068` in place, a disabled
   service is correctly never proposed, which means **the contextual plan is
   empty until services are explicitly enabled**. That is intended behaviour, not
   a fault, but it also means Phase 3 cannot be hosted-certified until at least
   one service is enabled deliberately.

3. **Then Phase 4**, and Phases 5 to 7 in the locked order.

## 5. Open findings not fixed, in priority order

### O-1 closed - publishable-key gateway boundary

`supabase/config.toml` now sets `verify_jwt = false` for `similar-listings`,
`seller-recommendations`, `related-services`, `related-products`,
`nearby-listings`, `recently-listed`, and `contextual-ecosystem`. These public
browser endpoints are protected by function-level origin, method, body, policy,
budget, and service-specific authentication checks rather than by Supabase
gateway JWT verification, because the browser key is expected to be an opaque
`sb_publishable_*` credential. `personalized-recommendations` remains
`verify_jwt = true`.

### O-2 (Medium) — `contextual-ecosystem` is `enabled = false`

`supabase/config.toml` disables the function, so it is never deployed. That is
consistent with the rule that service policies stay disabled until explicitly
certified, but **Phase 3 cannot be certified while it is off**. Plan a
deliberate enable-and-certify step, with hosted evidence, before claiming Phase
3 complete.

### O-3 to O-6 — closed in `06617e3`

All four are fixed by migration `0067` and the shared request guards. See
section 2.3 for what each resolution does. Two things to carry forward rather
than assume settled:

- The durable breaker is only meaningful if `record_recommendation_service_outcome_v1`
  is actually reached. Phase 7 should certify the breaker by driving real failures and reading
  `recommendation_service_circuit_state`, not by reading the code.
- The request budget **fails open in three separate ways**: no salt configured,
  a malformed client hash, or any internal error. That is deliberate — an abuse
  control must never remove sections from a listing page — but it means an
  ineffective budget is indistinguishable from a working one without an explicit
  test. Certify it by exhausting a window against a real deployment.

### O-7 (informational) — the adapters are not yet imported by any UI

`recommendationServices.js`, `contextualEcosystemService.js` and
`recommendationEventsService.js` have **no consumers** in `src/`. This is
correct for Phase 2 and is actively asserted by
`tests/recommendationFoundationContracts.test.mjs` ("recommendation adapters are
not imported into listing UI during Phase 2"). **Those assertions must be
deliberately updated when Phase 4 begins** — they will fail as soon as listing
detail imports an adapter, and that failure is expected, not a regression.

### O-8 (informational) — pgTAP proves SQL, not integration

Both High defects were invisible to a fully green pgTAP suite because pgTAP
calls SQL functions directly. Before certifying any later phase, add at least
one test that exercises the real transport: adapter body shape to Edge
validation to PostgREST argument resolution. The two regression tests added in
`8e2cd94` are static source contracts, which is better than nothing but is not
an integration test.

## 6. Rules that must not be broken

From the project instructions and from defects already paid for once:

- Phase order is locked: 0, 1, 2, 3, 4, 5, 6, 7. Do not skip ahead. Do not
  begin Phase 4 until Phase 3 is certified with executable evidence.
- A phase is complete only at its maximum practical implementation, testing,
  failure-isolation, operational, security and certification boundary.
- Never write "passed" without execution evidence. A queued, skipped, cancelled
  or partially passing workflow is not certification.
- No recommendation or contextual failure may block listing pages, listing
  APIs, search, Tours, chat, authentication, seller tools or moderation.
- Never expose database, Supabase, provider, stack-trace, status-code or
  internal exception text to users. Log privately, surface plain language.
- No emojis anywhere: code, UI copy, docs, tests, comments, commit messages.
- Do not identify any AI system as a contributor, author, owner or cofounder.
- Adding a migration needs **four** coordinated edits or the repo's own gates
  fail:
  1. `supabase/migrations/NNNN_name.sql`
  2. `supabase/rollback/NNNN_name.rollback.sql` — non-destructive, no
     `drop table` / `truncate` / `delete from`
  3. the release-tip anchor at the bottom of `scripts/verify-sql-boundary.mjs`
  4. **two** test anchors, not one:
     `tests/repositoryReleaseHygiene.test.mjs` and
     `tests/recommendationFoundationContracts.test.mjs`
- Every migration that creates or recreates a public-schema function must
  restate the `0027` revoke against `public, anon, authenticated`. Supabase
  re-grants `EXECUTE` to browser roles on every new function.
- Never disable RLS to make a test pass. Fix the test only when the expectation
  is genuinely wrong; otherwise fix the implementation.
- Never rewrite applied migration history to hide a defect. Add a corrective
  migration.
- Do not re-attempt vendor-chunk splitting for bundle size. It was measured in
  an earlier cycle and made the true initial payload roughly 27 percent worse.
  It is recorded as F-14.

## 7. Environment notes

- The live dev/staging Supabase project is `mfapduvnlcmmevrqjbis` (eu-west-2,
  Postgres 17.6). The project ref is not in the repository; there is no `.env`
  on disk, only `.env.example`.
- The founder-admin lock in `0030` binds admin to a SHA-256 of a normalized
  email, and the hash matches the repository owner's address. Signing up with
  that address auto-grants admin and super_admin.
- Two older migrations need mechanical adjustment to apply through MCP
  `apply_migration`: `0029` ships an explicit `begin`/`commit` (strip it, the
  tool already wraps in a transaction), and `0020`'s `alter type ... add value`
  must stay in its own migration.
- CI pins Node 22. Local Node here is 24, which strips TypeScript natively; do
  not rely on that. Any test that imports a `.ts` file at runtime must work on
  the pinned CI version.
- `core.autocrlf=true` on this machine causes literal `\n` assertions to fail
  locally against LF-committed files. Verify with `git show HEAD:<path>` before
  concluding a test is genuinely broken.
- The production build must run with `NODE_ENV=production`. A previous cycle
  lost hours to `NODE_ENV=test` leaking in from the job environment, which
  bundles React's dev build and blows the byte budget.

## 8. Phase status, stated honestly

| Phase | Source | Local | CI | Hosted | Certified |
|---|---|---|---|---|---|
| 0 — release safety | complete | pass | green on `06617e3` | no | no |
| 1 — data foundation | complete | pass | green on `06617e3` | no | no |
| 2 — independent services | complete | pass | green on `06617e3` | no | **no** |
| 3 — contextual intelligence | complete | pass | green on `06617e3` | function disabled | **no** |
| 4 — listing detail UX | not started | — | — | — | — |
| 5 — personalization | not started | — | — | — | — |
| 6 — analytics | not started | — | — | — | — |
| 7 — scale and certification | not started | — | — | — | — |

Phase 2 was reported executable-certified on `aaeeef4`. That claim was true for
the gates as written and false in substance: the services could not answer a
single real request. Treat "all gates green" as necessary, never sufficient, and
prefer one real end-to-end call over another static assertion.

**Phase 3 source is now complete**: journey-context resolution, category and
subcategory rules, listing-state awareness, location-aware orchestration,
service-availability awareness, stable context keys and reason codes, a
versioned contract, deterministic ordering, admin lifecycle controls, audit
history, rule validation, conflict resolution with explicit precedence, cache
safety, privacy boundaries, timeout handling, fail-soft fallback, failure
isolation, operational health, pgTAP coverage, source contracts, rollback
support and deployment registration.

It is **not certified**, and it cannot be until the function is enabled and
exercised against the hosted project. Do not restate the source list above as
evidence of certification; that is precisely the error made for Phase 2.

## 9. Update PR #1 after material progress

The body must keep these separated and must never blur them:

- source implemented
- locally executed
- CI passed
- hosted deployed
- production certified
- still pending

Keep the PR in draft until the entire locked sequence is complete.
