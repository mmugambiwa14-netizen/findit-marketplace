# FindIt Listing Intelligence Implementation Plan

## Objective

Turn every listing into the start of a complete buying journey while preserving FindIt's mobile-first performance, privacy, moderation, and release-safety standards.

## Current implementation boundary

Phases 0 through 3 are source-complete and staging-certified. Phase 4 listing
detail UX is source-complete, passes all current CI gates, and is certified on
the GitHub Pages staging frontend against the staging Supabase project.

The SQL boundary currently extends through migration `0070` with 70 migrations
and 41 matching rollback capsules.

Implemented Phase 2 boundaries:

- Seven separately deployable recommendation Edge Functions.
- Service-role-only database contracts through the mandatory publication eligibility view.
- Versioned, cursor-only deterministic ranking with stable reason codes.
- Dedicated global-service query paths and no runtime access to the shared dispatcher.
- Policy-controlled enablement, timeout, maximum page size, fresh cache and stale cache windows.
- Public fresh/stale cache support; personalized output is excluded from shared cache.
- Strict request, origin, UUID, cursor, distance and response-shape validation.
- Hard timeouts, per-service circuit breakers and fail-soft empty or stale responses.
- Seven frontend adapters that return safe empty results. The shared Phase 4
  listing-detail child consumes them only after canonical listing delivery.
- Admin-only audited service enablement and runtime configuration.
- Bounded, audited cache purge using `FOR UPDATE SKIP LOCKED`.
- Privacy-safe service health reporting with no identity or behavioural fields.
- Stable service-policy UUIDs for durable configuration audit history.
- Service policies remain disabled by default.
- CI and local gates include recommendation foundation, projection queue, eligibility/geospatial, publication boundary, independent services, service operations and scale suites.

Phase 2 has clean-reset, pgTAP, source-contract, typecheck, production-build and
real staging transport evidence for the enabled recently-listed service. The
other six policies remain disabled. None of the listing-intelligence phases is
production-certified.

## Locked phase order

1. Phase 0 — Release safety and audit corrections
2. Phase 1 — Recommendation data foundation
3. Phase 2 — Independent recommendation services
4. Phase 3 — Contextual ecosystem intelligence
5. Phase 4 — Listing detail UX
6. Phase 5 — Privacy-preserving personalization
7. Phase 6 — Analytics
8. Phase 7 — Scale, security and production certification

## Non-negotiable boundaries

- Recommendation failures never block listing pages or marketplace actions.
- Recommendation services remain disabled until explicitly enabled through audited controls.
- No offset pagination.
- No paid placement disguised as organic relevance.
- No invasive tracking, fingerprinting or message-content ranking.
- Every recommendation remains explainable through stable reason codes.
