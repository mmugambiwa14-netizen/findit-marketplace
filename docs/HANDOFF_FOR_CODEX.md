# FindIt release handoff

Written 2026-07-29. This supersedes every earlier handoff for this branch.

## Work location and safety

| Item | Value |
|---|---|
| Repository | `mmugambiwa14-netizen/findit-marketplace` |
| Feature branch | `feature/listing-intelligence-foundation` |
| Implementation evidence head | `dd035aebacad6fab7f726b3f7c497dc3fa59866d` |
| Pull request | #1, draft, open, must not be merged without an explicit production release decision |
| Feature worktree | `C:\tmp\findit-listing-intel-work` |
| SQL boundary | migration `0076`, 76 migrations, 47 rollback capsules |

The main worktree at
`C:\Users\mmuga\OneDrive\Desktop\FindIt-Extensive-Product-Audit-Remediated-v2-2026-07-27`
contains intentional uncommitted branding work. Never reset, clean, stash,
overwrite, or switch branches in that worktree.

Do not create another repository, replacement branch, or replacement PR. Keep
PR #1 draft. Do not deploy to the inaccessible legacy project
`mfapduvnlcmmevrqjbis`.

## Release state

The complete implemented V1 staging surface is active:

- Peek is enabled in the frontend, bottom navigation, router, backend feature
  control, first-party processor, cleanup, cache, and observability workers.
- The canonical public route is `/peek`; `/tours` is a compatibility redirect.
- All seven recommendation policies are enabled on staging.
- Recommendation sections remain independent from canonical listing delivery.
- Business profiles, messaging, essential notifications, international
  listings, manual/current location, reporting, and Google OAuth are enabled in
  the staging build.
- Deferred commerce, subscription, escrow, premium, AI, marketing, and reminder
  concepts are excluded from the V1 release surface. Their closed values are a
  production-validator requirement, not disabled shipped functionality.

Migrations install runtime policies closed for safe bootstrap. The guarded
staging activation enables Peek and all seven recommendation policies only
after lifecycle, transport, scale, cleanup, and zero-residue checks pass.

## Implemented boundaries

- Public recommendation functions and contextual orchestration support opaque
  Supabase publishable keys at the function-level public boundary.
- Personalized recommendations retain authenticated gateway enforcement and
  explicit user consent.
- Browser CORS permits the maintained Supabase client header set.
- Identity, recommendation, contextual, analytics, and event requests use real
  abort signals and bounded timeouts.
- Circuit state is durable across Edge isolates and persistence is registered
  with `EdgeRuntime.waitUntil` or awaited outside Edge.
- Request budgets store only salted digests and fail open so recommendation
  controls cannot take down listing delivery.
- All Supabase Edge Functions are Deno-typechecked by local and CI release
  gates.
- Listing details render bounded independent recommendation sections with
  loading, empty, degraded, error, retry, accessibility, analytics, and
  cancellation states.
- Peek uses private source, playback, and thumbnail storage with signed access,
  bounded upload intents, leased processing, FFmpeg transcoding, moderation,
  cleanup, cache invalidation, and operational health.
- The application has one canonical `/peek` route. It resolves to the real
  catalogue when Peek is enabled and to the placeholder only in preview mode.

## Local verification

Executed on Node 24 in the isolated feature worktree:

| Gate | Result |
|---|---|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run typecheck:migration` | pass |
| `npm run typecheck:active` | pass, 227 active modules |
| `npm run typecheck:edge-functions` | pass, all Edge Function entry points and shared runtimes |
| `npm run test:contracts` | pass, 357/357 |
| `npm run verify:sql-boundary` | pass, 76 contiguous migrations and 47 rollback capsules |
| `npm run verify:hygiene` | pass, 690 text files |
| `npm run verify:source-graph` | pass, 377 modules and zero unresolved imports |
| `npm run audit:product-surface` | pass, zero failures and zero warnings |
| `npm run audit:production` | pass, no reachable Moderate, High, or Critical advisories |
| `npm run validate:env` | pass with Peek and every implemented worker enabled |
| Production Pages build | pass, JS 536,072 B raw / 158,212 B gzip; CSS 69,529 B raw / 12,410 B gzip |

Local Docker is unavailable because Docker Desktop cannot bootstrap its WSL
data disk. Both clean GitHub database jobs are the authoritative full reset,
schema lint, RLS, and pgTAP evidence.

## GitHub evidence

All four PR checks passed on implementation head `dd035ae`:

- Frontend and source contracts
- Database reset, RLS and recommendation certification
- Reset, lint and recommendation pgTAP
- Release verification

Final hosted acceptance:

| Item | Value |
|---|---|
| Workflow run | `30496750148` |
| Accepted head | `dd035aebacad6fab7f726b3f7c497dc3fa59866d` |
| Artifact | `tour-acceptance-30496750148-1` |
| Result | success |
| Scope | static release gates, generated-video lifecycle, FFmpeg processing, playback, thumbnail, catalogue, moderation, scale, observability, cleanup, activation, evidence upload |

The repository variable `FINDIT_TOURS_ACCEPTANCE_ID` is pinned to that artifact.

Maintenance workflow run `30493820035` passed all nine jobs:

- media cleanup
- listing expiry
- recommendation projection
- recommendation maintenance
- Peek processing
- Peek cleanup
- Peek cache invalidation
- Peek observability
- essential notification fanout

## Supabase evidence

Confirmed staging target:

`FindIt Staging` (`bwgklpxoetrrkutottdb`, eu-west-2)

Production project:

`FindIt Marketplace` (`jvbpxnfxkptuexgssplj`, eu-west-2)

Production was inspected non-destructively and remains at migration `0049`. It
was not deployed to or modified.

Staging is migrated through `0076`. Migrations `0075` and `0076` correct
hosted PostgreSQL claim-output ambiguity for Peek processing and cleanup.

Hosted evidence includes:

- browser-style CORS preflights with authorization, apikey, content-type, and
  x-client-info;
- anonymous public recommendation transport and authenticated personalized
  transport;
- real Edge-to-PostgREST results for all seven services;
- contextual planning, public listing hydration, consent and clear behavior,
  aggregate-only analytics, timeout classification, durable circuit opening
  and recovery, request-budget exhaustion, and listing independence;
- generated video upload, first-party FFmpeg transcode, signed playback,
  thumbnail delivery, catalogue ordering, moderation, retries, cleanup,
  cache invalidation, scale, and observability;
- exact-target activation only after zero disposable `example.test` profiles.

The final post-acceptance audit reports:

| Check | Value |
|---|---:|
| Peek backend enabled | true |
| Enabled recommendation policies | 7 |
| Disabled recommendation policies | 0 |
| Open circuits | 0 |
| Circuit states with failures | 0 |
| Open operational alerts | 0 |
| Peek cleanup dead letters | 0 |
| Peek cache dead letters | 0 |
| Recommendation dead letters | 0 |
| Recommendation projection jobs | 0 |
| Notification fanout dead letters | 0 |
| Due notification fanout | 0 |
| Disposable test users | 0 |

No hosted or production claim is based on static tests alone.

## Deployment

Staging frontend:

`https://mmugambiwa14-netizen.github.io/findit-marketplace/`

Pages deployment run `30497490722` succeeded from accepted implementation head
`dd035ae`. The live root returns the 200 application shell, `/peek` returns the
expected Pages route-handoff document, and the deployed main asset is
`assets/index-gjDqwLZg.js`. The compiled bundle contains the Peek label,
canonical route, and exact staging project reference.

The Pages workflow must build from the feature branch with:

- `FINDIT_STAGING_TOURS_ENABLED=true`
- `FINDIT_STAGING_TOURS_PREVIEW=false`
- `FINDIT_STAGING_TOURS_BACKEND_ENABLED=true`
- `FINDIT_TOURS_WORKERS_ENABLED=true`
- `FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED=true`
- `FINDIT_RECOMMENDATION_WORKERS_ENABLED=true`
- `FINDIT_TOURS_RELEASE_ACCEPTED=true`
- `FINDIT_TOURS_ACCEPTANCE_ID=tour-acceptance-30496750148-1`

## Remaining external release boundary

The code and staging candidate are complete. A production release still needs
an explicit owner decision and named rollout window because the production
Supabase project is intentionally untouched. During that window:

1. Apply migrations and deploy functions to the production project with
   rollback ownership.
2. Configure production secrets, SMTP, final domain, OAuth callbacks,
   monitoring, and recovery ownership.
3. Repeat the guarded transport, auth, timeout, circuit, worker, cleanup,
   consent, analytics, listing-independence, Peek lifecycle, and device checks
   against production.
4. Enable production policies only after that production evidence passes.

This boundary is not a source defect and must not be bypassed by pointing the
staging frontend at production.
