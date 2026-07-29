# Recommendation Data and Service Foundation

## Status

Phase 1 data implementation is complete through migration `0058`. Phase 2 independent service implementation currently extends through migration `0061`. Executable certification is pending successful GitHub Actions runner startup after billing is restored.

## Purpose

FindIt recommendation infrastructure is additive and isolated. Listing publication, listing detail, save, share, Peek and chat remain authoritative customer paths and never depend on recommendation availability.

## Phase 1 data boundary

The foundation provides normalized taxonomy, privacy-safe listing projections, partitioned first-party events, disposable caches, popularity aggregates, asynchronous projection jobs, retries, dead letters, publication eligibility, retention, maintenance and RLS controls.

Projection and cleanup triggers are fail-open. A recommendation failure cannot abort an authoritative listing or moderation transaction.

## Phase 2 service boundary

Seven versioned services are implemented:

- similar listings;
- more from the same seller;
- related services;
- related products and accessories;
- nearby listings using privacy-safe public geography;
- recently listed;
- authenticated personalization.

Each service has its own Edge Function entry point and database contract. Responses use cursor pagination and stable reason codes. Offset pagination and generated promotional copy are excluded.

## Runtime isolation

Each service policy controls enablement, contract version, timeout, maximum page size, fresh cache duration and stale cache duration. Policies are disabled by default. The runtime role can read policy but cannot mutate it directly.

The Edge runtime enforces origin allowlisting, payload limits, UUID and cursor validation, authenticated identity for personalization, response-shape validation, policy-driven timeouts, per-service circuit breaking and stale-cache fallback.

Personalized responses never enter shared cache.

## Cache correctness

Projection changes invalidate cache entries where the changed listing is either the subject or a returned item. Taxonomy and relationship changes invalidate contextual service caches. Invalidation is best effort and cannot block projection or listing writes.

Cache is disposable and is not an authorization source. Service queries continue to use `eligible_listing_recommendation_features`.

## Frontend boundary

`src/services/recommendationServices.js` exposes one independent, fail-soft adapter per service. Adapters validate requests and responses, apply a client timeout and return empty degraded results instead of throwing.

During Phase 2, listing detail does not import these adapters. UI integration remains Phase 4 work.

## Certification

The authoritative workflow applies migrations through `0061`, runs database lint, six recommendation pgTAP suites, source contracts, typechecks and production build checks.

The implementation is committed but not certified, and all services remain disabled until executable gates pass.
