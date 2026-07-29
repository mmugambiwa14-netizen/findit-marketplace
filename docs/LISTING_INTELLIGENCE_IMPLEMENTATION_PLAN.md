# FindIt Listing Intelligence Implementation Plan

## Objective

Turn every listing into the start of a complete buying journey while preserving FindIt's mobile-first performance, privacy, moderation, and release-safety standards.

## Phase 0 — Release Safety and Audit Corrections

Scope:

- Make hosted smoke-test intent explicit and impossible to confuse with local execution.
- Keep preview authentication bypass development-only and explicitly configured.
- Remove conflicting OAuth feature switches.
- Require production release identity, telemetry configuration, and strict feature manifests.
- Keep recommendation failures isolated from listing delivery.

Completion gate:

- Production validation rejects preview bypass, fixture mode, conflicting OAuth flags, unsafe hosted targets, and incomplete release metadata.
- No production listing route depends on recommendation availability.

## Phase 1 — Recommendation Data Foundation

Scope:

- Add normalized recommendation taxonomy for categories, subcategories, products, services, tags, locations, complementary relationships, and ranking weights.
- Add listing feature projections for property, vehicle, machinery, and service similarity.
- Add privacy-preserving behavioural event tables for views, saves, Peek watches, searches, chats, seller follows, and recommendation clicks.
- Add recommendation cache, cursor indexes, geospatial indexes, freshness indexes, seller indexes, and popularity aggregates.
- Enforce RLS, retention rules, managed fields, suspension-aware publication filters, and auditability.

Completion gate:

- Migrations lint and reset locally.
- Every new public table has RLS.
- Adversarial tests cover guest, owner, unrelated user, suspended user, moderator, and admin access.
- No raw invasive tracking identifier is required.

Implementation state:

- Source implementation is complete through migration `0058` with matching non-destructive rollback capsules.
- Listing projection is asynchronous and fail-open. Listing and detail writes only enqueue work inside a protected exception boundary; projection failures cannot abort listing transactions.
- Projection workers use bounded `FOR UPDATE SKIP LOCKED` batches, capped retries, stable-code dead letters and no raw database-error persistence.
- Privacy-limited event ingestion, partition preparation, retention, popularity aggregation, audited taxonomy/weight controls, health reporting and cursor/index scale fixtures are implemented.
- Active-seller, publication, public-geography and deletion-compatible event boundaries are implemented.
- Source contracts and five Phase 1 pgTAP suites cover isolation, RLS, spoofing, privacy, retention, partition migration, queue failure, recovery, publication and query plans.
- The executable gate remains open because GitHub Actions is disabled by the account billing state. Phase 1 is implemented but not certified.

## Phase 2 — Independent Recommendation Services

Services:

- similar_listings_service
- seller_recommendations_service
- related_services_service
- related_products_service
- nearby_service
- recently_listed_service
- personalized_recommendation_service

Architecture:

- Stable versioned API contracts.
- Cursor pagination only.
- Independent timeout, cache, error, and observability boundaries.
- Deterministic rules-first ranking with a replaceable ranker interface for future semantic or behavioural models.
- Recommendation responses contain reason codes, not generated promotional copy.

Completion gate:

- Each service can fail independently.
- Listing detail remains available when every recommendation service is unavailable.
- Scale fixtures demonstrate index-backed query plans and stable cursor behaviour under concurrent inserts.

Implementation state:

- Source implementation currently extends through migration `0061`, with matching rollback capsules.
- Seven database contracts and seven separately deployable Supabase Edge Functions are implemented.
- The shared dispatcher is not executable by the runtime service role; global services have dedicated query paths.
- Service policy controls provide independent enablement, contract version, timeout, page-size and cache windows.
- All service policies remain disabled by default.
- Public recommendation responses can use fresh and stale disposable cache entries; personalized responses never enter shared cache.
- Projection and taxonomy changes trigger best-effort cache invalidation without blocking authoritative writes.
- The Edge runtime validates origin, payload size, UUIDs, cursors, page limits, policy values and response identity.
- Hard timeouts, stale fallback and a per-service circuit breaker prevent repeated failures from cascading.
- Personalized recommendations require a verified authenticated user.
- Frontend adapters exist for all seven services and always degrade to an empty result rather than throwing into listing delivery.
- Listing detail does not import or invoke these adapters during Phase 2.
- Static contracts and a dedicated Phase 2 pgTAP suite are committed, and CI includes all Phase 1 and Phase 2 database suites.
- Executable reset, lint, pgTAP, typecheck and build certification remain pending until GitHub Actions billing is restored.

## Phase 3 — Contextual Ecosystem Mapping

Scope:

- Implement category-aware relationships for property, vehicles, machinery, and services.
- Support complementary service graphs and related product/accessory graphs.
- Add seller reputation, listing quality, activity, popularity, distance, price-band, and specification weights.
- Add admin-controlled weighting and taxonomy management with audit history.

Completion gate:

- No generic service block appears without a contextual relationship.
- Suspended, expired, deleted, unapproved, or private records never enter recommendations.
- Every recommendation is explainable through stable reason codes.

## Phase 4 — Listing Detail Recommendation UX

Order:

1. Similar Listings
2. More From This Seller
3. Related Services
4. Related Products / Accessories
5. Nearby Listings
6. Recently Listed
7. Recommended For You

UX requirements:

- Independent lazy-loaded sections.
- Horizontal mobile cards, skeletons, safe error states, empty-state suppression, View All, and cursor pagination.
- Progressive images and virtualization on expanded result pages.
- No empty headings.
- No recommendation error may affect the listing, Peek, seller, save, share, or chat actions.

Completion gate:

- Mobile browser acceptance passes.
- Every section independently handles loading, success, empty, timeout, and error states.
- Accessibility and reduced-motion checks pass.

## Phase 5 — Personalization and Privacy

Scope:

- Use saved listings, viewed listings, Peek history, searches, chats, favourite sellers, price preferences, location preferences, and category preferences.
- Avoid cross-site tracking, advertising identifiers, fingerprinting, hidden contact inference, or sale of behavioural data.
- Add clear retention, consent, account deletion, and personalization reset controls.
- Provide anonymous-session recommendations using local, short-lived context only.

Completion gate:

- Personalization can be disabled and reset.
- Account deletion removes or irreversibly anonymizes eligible behavioural records.
- Sensitive messaging content is never used as recommendation text input.

## Phase 6 — Analytics and Experimentation

Metrics:

- Listing session duration
- Listings viewed
- Peeks watched
- Chats initiated
- Seller profile visits
- Cross-category discovery
- Related-service clicks
- Related-product clicks
- Saves
- Return visits
- Recommendation click-through rate
- Enquiry conversion

Scope:

- Privacy-safe event schema.
- Server-validated recommendation impression and click events.
- Experiment assignment independent from ranking APIs.
- Bot and duplicate-event controls.

Completion gate:

- Metrics can be reproduced from documented event definitions.
- Analytics failure cannot block customer actions.

## Phase 7 — Scale, Security, and Release Certification

Scope:

- Million-record fixtures for listings, services, products, users, events, and caches.
- Query-plan budgets, cache hit targets, p95 latency targets, load shedding, rate limits, and circuit breakers.
- Browser E2E, RLS adversarial tests, migration rollback rehearsal, backup restore, worker monitoring, and hosted acceptance.
- Immutable release version, commit SHA, migration version, feature manifest, and deployment evidence.

Completion gate:

- GitHub Actions are operational.
- Staging and production-target smoke tests are distinguishable and independently evidenced.
- Monitoring and alert destinations are connected.
- Native isolated restore evidence exists.
- Production launch checklist is signed.

## Non-negotiable boundaries

- Recommendations remain helpful, not paid-placement disguised as relevance.
- Future monetized placements must be visibly labelled and ranked outside organic recommendation scores.
- No offset pagination.
- No recommendation section may block or destabilize listing detail.
- No permanent deletion for ordinary moderation actions; suspend and preserve evidence.
- Technical errors remain private; users receive plain-language recovery states.
- Future AI ranking must fit the same API contracts and authorization boundaries.
