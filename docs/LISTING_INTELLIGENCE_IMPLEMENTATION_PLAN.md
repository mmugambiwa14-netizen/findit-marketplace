# FindIt Listing Intelligence Implementation Plan

## Objective

Turn every listing into the start of a complete buying journey while preserving
FindIt's mobile-first performance, privacy, moderation, and release-safety
standards.

## Current implementation boundary

Phases 0 through 7 are source-complete. Phases 0 through 6 and the staging
portion of Phase 7 have executable hosted evidence against `FindIt Staging`
(`bwgklpxoetrrkutottdb`). The production project remains unchanged and no phase
is represented as production-certified.

The SQL boundary extends through migration `0074` with 74 contiguous migrations
and 45 non-destructive rollback capsules.

Implemented recommendation boundaries:

- Seven independently deployable recommendation Edge Functions.
- Function-level public authentication compatible with opaque Supabase
  publishable keys; personalized recommendations remain JWT-authenticated.
- Maintained Supabase CORS headers with real browser preflight coverage.
- Real abort signals for identity, recommendation, contextual, listing, service,
  and event PostgREST requests.
- Durable circuit state, request budgets, cache isolation, and fail-soft stale
  or empty responses.
- Explicit, default-off personalization consent with a 90-day first-party
  signal window and owner-controlled data clearing.
- Aggregate-only daily recommendation analytics with bounded refresh,
  reporting, and retention.
- Typed related-service results sourced from the public services marketplace,
  independently hydrated from listing results.
- Listing-detail sections with bounded loading, empty, degraded, error, retry,
  accessibility, and attribution states.
- CI typechecking for every Edge Function plus clean-reset PostgreSQL/PostGIS,
  RLS, pgTAP, source, typecheck, build, hygiene, and dependency gates.

Hosted staging evidence on 2026-07-29:

- Five previously disabled public services returned fixture-backed results
  through browser-to-Edge-to-PostgREST transport while enabled one at a time.
- Related services returned a typed public service and recorded bounded
  aggregate-safe impression and click attribution.
- A real request-budget window exhausted on the third request.
- Personalization returned no recommendations before consent, returned results
  after consent and post-consent activity, and returned to disabled after clear.
- Admin analytics returned aggregate counts without actor, session, listing,
  seller, or request identities.
- Real database lock contention produced three abortable timeouts, opened the
  persisted circuit across separate requests, isolated canonical listing
  delivery, and recovered after the circuit closed.
- The hosted nearby query required a measured 1,000 ms execution budget;
  migration `0074` calibrates only that service while preserving the 5-second
  hard ceiling.
- Cleanup left zero fixtures and open circuits. Exactly
  `recently_listed_service` remains enabled; all six other policies are disabled.

## Locked phase order

1. Phase 0 - Release safety and audit corrections
2. Phase 1 - Recommendation data foundation
3. Phase 2 - Independent recommendation services
4. Phase 3 - Contextual ecosystem intelligence
5. Phase 4 - Listing detail UX
6. Phase 5 - Privacy-preserving personalization
7. Phase 6 - Analytics
8. Phase 7 - Scale, security and production certification

## Remaining release boundary

The code is a production-ready candidate, not a production-certified release.
Before production activation:

1. Keep PR #1 draft until final review and an explicit production decision.
2. Keep six recommendation policies disabled and retain the staged
   recently-listed rollout until production capacity and rollback ownership are
   approved.
3. Apply migrations and deploy functions to production only through a named,
   reviewed release window.
4. Repeat the guarded hosted suites against the production target without using
   staging overrides, then enable services incrementally.
5. Monitor aggregate health, latency, request budgets, circuit state, and
   listing independence throughout rollout.

## Non-negotiable boundaries

- Recommendation failures never block listings, search, maps, Peek,
  authentication, messaging, seller tools, or moderation.
- Services remain disabled until explicitly enabled through audited controls.
- No offset pagination.
- No paid placement disguised as organic relevance.
- No invasive tracking, fingerprinting, or message-content ranking.
- Every recommendation remains explainable through stable reason codes.
- Hosted and production certification require executable evidence; static tests
  alone are never sufficient.
