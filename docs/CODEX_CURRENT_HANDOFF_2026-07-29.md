# FindIt Current Codex Handoff

Updated: 2026-07-29

This is the authoritative handoff for the current machine and repository state.
It supersedes machine paths, branch heads, Node versions, and Supabase target
claims in older handoff documents. Do not treat
`docs/HANDOFF_FOR_CODEX.md` on the feature branch as current without checking
this document first.

## 1. Project location

Primary working copy:

```text
C:\Users\mmuga\OneDrive\Desktop\FindIt-Extensive-Product-Audit-Remediated-v2-2026-07-27
```

GitHub repository:

```text
https://github.com/mmugambiwa14-netizen/findit-marketplace
```

Repository visibility: private.

Default branch: `main`.

An isolated read-only review worktree also exists at:

```text
C:\tmp\findit-listing-intel-review-9fa6711
```

That worktree is detached at the recommendation branch head and was used only
for review and verification. No source changes were made there. A new session
may reuse it for inspection, but should create a clean branch/worktree before
editing.

Do not use this older temporary clone as the primary project:

```text
C:\Users\mmuga\AppData\Local\Temp\findit-audit-clone-780a145-lf
```

## 2. Current Git state

The primary working copy is on `main`:

```text
main HEAD:        780a145eb00f5e957437d4e1b8c5b33999809672
origin/main:      780a145eb00f5e957437d4e1b8c5b33999809672
```

The primary working copy is dirty because it contains intentional, uncommitted
logo and branding work. Do not reset, clean, overwrite, or checkout another
branch in this working copy.

Modified files:

```text
index.html
src/components/AppErrorBoundary.jsx
src/components/AuthLayout.jsx
src/components/admin/AdminSidebarCollapsible.jsx
src/components/create-listing/GuestGate.jsx
src/components/layout/SiteFooter.jsx
src/components/layout/TopNav.jsx
src/components/listings/MakeOfferButton.jsx
src/components/listings/ReportListingDialog.jsx
tests/brandLegalEmailFounderContracts.test.mjs
```

Untracked branding paths:

```text
preview-assets/brand/
public/
src/assets/brand/
src/components/BrandLogo.jsx
```

The logo work previously passed lint, typecheck, the then-current contract
suite, and the production build. Re-run those gates before committing because
the repository has moved since that verification.

## 3. Recommendation branch and PR

The substantial newer work is not on `main`. It is here:

```text
branch: feature/listing-intelligence-foundation
head:   9fa6711c71e19f56f51efb6b18056dbaf8404abb
base:   main
ahead:  189 commits
behind: 0 commits
```

Pull request:

```text
https://github.com/mmugambiwa14-netizen/findit-marketplace/pull/1
state: open
draft: yes
mergeable: yes
merge state: clean
```

All four current GitHub checks pass on `9fa6711`:

```text
Frontend and source contracts
Reset, lint and recommendation pgTAP
verify
Database reset, RLS and recommendation certification
```

Important: `main` has no GitHub branch protection. The checks run, but GitHub
does not enforce them as required merge checks. Keep PR #1 in draft and do not
merge it.

## 4. What the feature branch contains

The feature branch adds the listing-intelligence backend foundation:

```text
19 migrations:       0050 through 0068
19 new rollbacks
68 total migrations
39 total rollback capsules
recommendation data projection and eligibility
seven independent recommendation services
contextual ecosystem planning
request budgets, cache controls, and circuit-breaker state
Edge Functions, browser adapters, workers, health endpoints, CI, and tests
```

This is not yet a user-visible recommendation feature:

```text
All seven recommendation service policies start disabled.
The contextual plan is empty while the policies are disabled.
The recommendation adapters have no UI consumers.
Phase 4 listing-detail UX has not started.
Phases 5 through 7 have not started.
Nothing from this branch has been hosted-certified in the current cycle.
```

Do not describe the feature as complete, deployed, or production-certified.

## 5. Verification already performed

Local checks performed against feature head `9fa6711`:

```text
npm run lint                          PASS
npm run typecheck                     PASS
npm run verify:sql-boundary           PASS, 68 migrations / 39 rollbacks
npm run verify:hygiene                PASS, 644 files
npm run verify:source-graph           PASS, 358 modules / 0 unresolved
npm run audit:product-surface         PASS, 0 failures / 1 warning
npm run build                         PASS
production JS budget                  534,644 B raw / 157,831 B gzip
npm run test:contracts                307 of 308 locally
```

The one local contract failure is
`tests/tourMilestone6ModerationAdmin.test.mjs:67`. The test matches a literal
LF sequence while Windows checks the file out with CRLF. It passes on Linux CI.
The test should eventually normalize line endings so the local gate is
reproducible.

Database reset, schema lint, RLS, migration-chain, and pgTAP checks passed in
GitHub Actions. No current hosted end-to-end recommendation request has passed.

## 6. Confirmed blockers from the review

### P1 - Public recommendation authentication is incompatible with publishable keys

`supabase/config.toml` sets `verify_jwt = true` for the six anonymous
recommendation services and `contextual-ecosystem`. The browser uses the current
`sb_publishable_*` key format, which is not a JWT. Anonymous calls are rejected
by the Edge gateway before the handler runs.

Keep `personalized-recommendations` authenticated. Give public services an
explicit publishable/public authentication boundary and test both anonymous and
signed-in calls through the actual browser transport.

### P1 - Contextual ecosystem CORS is incomplete

`supabase/functions/contextual-ecosystem/index.ts` allows only `apikey` and
`content-type`. Supabase browser calls also use `authorization` and
`x-client-info`. The preflight therefore blocks the browser request.

Use Supabase's maintained CORS headers or include the complete required set, and
add an executable browser preflight test.

### P1 - Recommendation identity resolution reads only a legacy key variable

`supabase/functions/_shared/recommendation-service.ts` reads only
`SUPABASE_ANON_KEY`. It does not support the current hosted
`SUPABASE_PUBLISHABLE_KEYS` JSON map or local `SUPABASE_PUBLISHABLE_KEY`.

Reuse the established helper pattern from
`supabase/functions/_shared/tour-runtime.ts`.

### P1 - Supabase deployment target is inconsistent

The older feature handoff names project `mfapduvnlcmmevrqjbis`. That project is
not visible in the Supabase account currently authenticated on this machine.
Do not deploy to that reference.

The current authenticated Supabase organization is:

```text
organization id/slug: pyktbmobvwktiuiqbobd
```

Active FindIt projects visible in that organization:

```text
FindIt Staging
ref:    bwgklpxoetrrkutottdb
region: eu-west-2
state:  ACTIVE_HEALTHY

FindIt Marketplace
ref:    jvbpxnfxkptuexgssplj
region: eu-west-2
state:  ACTIVE_HEALTHY
```

The local Supabase CLI is currently linked to:

```text
jvbpxnfxkptuexgssplj (FindIt Marketplace)
```

Older setup scripts and `docs/SUPABASE_SETUP.md` default to:

```text
bwgklpxoetrrkutottdb (FindIt Staging)
```

Before any migration, secret, or Edge Function deployment, perform a
non-destructive target audit and make one project reference authoritative in
the scripts and documentation. Never infer the target from an old handoff.

### P2 - Server timeout code does not cancel all underlying work

The contextual RPC passes `{ signal }` as an unsupported RPC option. The
PostgREST builder requires `.abortSignal(signal)`.

The shared recommendation RPC and identity lookup use `Promise.race`, which
stops waiting but does not cancel the underlying request. This can continue to
consume Edge and database resources after a timeout response.

### P2 - Durable circuit-breaker persistence is best effort

Recommendation outcome persistence is neither awaited nor registered with
`EdgeRuntime.waitUntil`. The Edge isolate can terminate before the database
write completes. The durable-breaker claim is therefore not certified.

### P2 - Hosted smoke coverage is not representative

The hosted smoke harness sends only `apikey`, does not exercise browser CORS,
does not include the contextual orchestrator, and has not passed against the
current hosted target. Add real adapter-to-Edge-to-PostgREST coverage.

### P2 - Deployment variable inventory is incomplete

The environment documentation omits:

```text
FINDIT_REQUEST_BUDGET_SALT
FINDIT_CONTEXTUAL_HEALTH_SECRET
FINDIT_RECOMMENDATION_HEALTH_SECRET
```

Do not put real values in the repository.

### P3 - The feature-branch handoff contains stale facts

Known stale statements in `docs/HANDOFF_FOR_CODEX.md` on the feature branch:

```text
Head is listed as 06617e3; actual head is 9fa6711.
CI is described as Node 22; workflows use Node 24.
Hygiene count is listed as 642; the current local run inspected 644.
contextual-ecosystem is said to be enabled=false in config.toml; it is not.
The working-copy path points to an older Downloads location.
The named Supabase project is not visible in the current account.
```

Update or replace that document after the implementation blockers are fixed.

## 7. Current local preview state

The primary working copy currently has a Vite process listening on all
interfaces:

```text
http://127.0.0.1:5173
http://192.168.1.118:5173  (phone on the same Wi-Fi; address may change)
```

The process was started with:

```text
vite --host 0.0.0.0 --mode preview
```

Port `4173` also has two older preview/static-server processes, including one
from the stale temporary clone. Do not use port `4173` as evidence of the
current primary application.

There is no confirmed hosted recommendation preview or production deployment
from PR #1.

## 8. Safe continuation sequence

1. Read this file and inspect the primary dirty `main` worktree without changing
   it.
2. Fetch `origin` and confirm the PR head before editing.
3. Create or reuse a separate worktree based on
   `origin/feature/listing-intelligence-foundation`.
4. Keep PR #1 draft and do not merge to `main`.
5. Fix the publishable-key/JWT boundary and the contextual CORS contract.
6. Reuse the current publishable-key resolver used by Tours and uploads.
7. Replace false timeouts with real request cancellation.
8. Register non-blocking circuit persistence with `EdgeRuntime.waitUntil`, or
   await it if measured latency is acceptable.
9. Add Edge Function typechecking so unsupported SDK options fail CI.
10. Repair the hosted smoke harness and add actual CORS and transport coverage.
11. Complete the environment inventory without writing secrets to Git.
12. Audit `jvbpxnfxkptuexgssplj` and `bwgklpxoetrrkutottdb` non-destructively,
    then make the intended staging target explicit everywhere.
13. Deploy only to the confirmed staging target, run migrations and functions,
    keep policies disabled, and execute hosted health and transport tests.
14. Enable one non-personalized service deliberately in staging and certify its
    failure isolation.
15. Begin Phase 4 only after Phase 3 has executable hosted evidence.
16. Integrate recommendation sections into listing detail without making listing
    delivery depend on them.
17. Re-run all local and GitHub gates, update the PR body and handoff, and leave
    the PR draft until the full locked sequence is complete.

## 9. Rules for the next session

```text
Do not reset or clean the primary worktree.
Do not overwrite uncommitted logo work.
Do not create a replacement repository or replacement PR.
Do not merge PR #1.
Do not deploy to mfapduvnlcmmevrqjbis.
Do not expose Supabase keys or other credentials in logs, docs, commits, or chat.
Do not enable recommendation policies in production.
Do not claim hosted or production certification from static tests.
Do not let recommendation failure block listings, search, maps, Peek, auth,
messaging, seller tools, or moderation.
```

## 10. Definition of the next safe milestone

The next milestone is complete only when:

```text
Anonymous browser calls work with the actual publishable key.
Signed-in personalization validates a real user JWT.
Contextual CORS preflight succeeds.
Recommendation and contextual database requests are genuinely cancellable.
Circuit-breaker persistence is proven across requests.
The hosted smoke uses the confirmed staging target and real transport.
At least one deliberately enabled staging service returns a valid result.
Listing pages continue to work when every recommendation endpoint is disabled
or unavailable.
All local gates and all GitHub checks pass on the same commit.
```

