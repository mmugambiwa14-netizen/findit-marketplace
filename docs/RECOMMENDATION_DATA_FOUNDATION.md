# Recommendation Data Foundation

Status: Phase 1 implementation complete; executable certification pending successful GitHub Actions runner startup.

## Boundary

The recommendation foundation is additive. Public listing reads, listing detail routes, seller actions, Tours, saves, sharing and chats do not depend on recommendation tables, workers, caches or event ingestion.

Recommendation failures may delay projections, aggregates or personalization inputs, but they must never prevent a listing from loading or publishing.

## Migration sequence

| Migration | Responsibility |
|---|---|
| `0050_recommendation_data_foundation.sql` | Normalized taxonomy, contextual relationships, listing projections, partitioned behavioural events, cache and daily popularity aggregates. |
| `0051_recommendation_projection_ingestion_and_retention.sql` | Deterministic projection functions, bounded first-party event ingestion, retention, monthly partition preparation and popularity refresh. |
| `0052_recommendation_taxonomy_weights_and_admin.sql` | Versioned organic ranking profiles, audited admin operations and initial category-to-service/product relationships. |
| `0053_recommendation_foundation_hardening.sql` | Identity exclusivity, attribution validation, event boundaries, immutable configuration history and hot-path indexes. |
| `0054_recommendation_foundation_certification_corrections.sql` | Incremental popularity updates, cursor-aware backfill metadata and bounded operational health. |
| `0055_recommendation_projection_queue.sql` | Coalescing asynchronous projection queue, bounded concurrent workers, capped retry backoff and preserved dead letters. |
| `0056_recommendation_partition_and_configuration_integrity.sql` | Safe migration of late rows from the default event partition, taxonomy cycle protection, audited weight replacement and million-row health-query safeguards. |
| `0057_recommendation_eligibility_geospatial_and_deletion_closure.sql` | Active-seller eligibility, privacy-safe public geography with a GiST index, deletion-compatible behavioural foreign keys and table-level event-subject validation. |
| `0058_recommendation_publication_fail_open_closure.sql` | Service-only current-eligibility view, immediate best-effort projection cleanup for non-public content and active-actor validation. |

Every migration has a non-destructive rollback capsule. Rollback disables access and workers while preserving records, projections, behavioural evidence, configuration history and dead letters.

## Data model

### Taxonomy and relationships

`recommendation_taxonomy_nodes` stores stable categories, subcategories, services, products, tags and locations. Public reads expose only active nodes.

`recommendation_relationships` stores explainable relationships such as `similar`, `complements`, `requires`, `alternative` and `accessory`. Public reads require the relationship and both endpoint nodes to be active and within their validity window.

Taxonomy attributes are size-limited and restricted to an explicit metadata allowlist. Admin updates reject missing parents, self-parenting and recursive cycles.

### Listing feature projections

`listing_recommendation_features` stores deterministic, service-owned projections for public, unsuspended listings owned by active sellers. Projections include:

- stable category and subcategory keys;
- seller, country and public location keys;
- seller-native price and currency;
- normalized property, vehicle or machinery specification tokens;
- deterministic quality, freshness and popularity signals;
- privacy-safe canonical public geography;
- projection version and timestamps.

Draft, expired, unavailable, deleted or suspended content is removed from the projection surface. Seller suspension removes existing projections immediately and queues affected listings for reconciliation. Seller restoration queues fresh projections.

The geospatial projection uses only `listings.public_location`, which is derived from the canonical public location record. Exact owner-supplied coordinates are never copied into recommendation storage. Nearby queries use a partial GiST index on the public geography column.

Recommendation services must query `eligible_listing_recommendation_features`, not the raw projection table. The service-only view rechecks current listing status, content suspension and seller status so a stale projection row can never make ineligible content recommendable.

### Event collection

`recommendation_events` is range-partitioned by `occurred_at`. An event belongs to exactly one authenticated account or one anonymous session. Anonymous sessions are held only in browser session storage and expire after 30 days; authenticated events expire after 180 days.

The ingestion RPC accepts only approved event types and a small context allowlist. It rejects raw search text, messages, email addresses, phone numbers, contact inference, advertising identifiers, fingerprints and arbitrary metadata.

Recommendation impressions and clicks require a request identifier, a recognized versioned service name and a stable reason code. Non-recommendation events cannot spoof recommendation attribution.

A table-level trigger verifies that the actor is active and that listing and seller events still reference public subjects owned by active accounts. Event foreign keys cascade on explicit listing or account deletion so recommendation history cannot block required deletion and privacy workflows.

### Cache and popularity

`recommendation_cache` is disposable and service-owned. A cache miss or cache failure cannot affect listing delivery.

`recommendation_popularity_daily` stores daily aggregates. Rolling scores are updated incrementally, and stale non-zero values are reset without rewriting every projection row.

## Asynchronous projection

Listing and category-detail writes enqueue one coalesced job per listing. Trigger functions catch queue failures and return the original listing write result. When a listing becomes non-public or suspended, the trigger also performs immediate best-effort projection removal while preserving the listing or moderation transition if recommendation infrastructure is unavailable.

`process_listing_recommendation_projection_jobs`:

- uses `FOR UPDATE SKIP LOCKED` for safe parallel workers;
- enforces a maximum batch of 500 jobs;
- applies capped exponential retry backoff;
- stores only stable failure codes;
- moves exhausted jobs to preserved dead letters;
- never stores raw database error text;
- never changes listing publication or availability.

The maintenance endpoint supports separate `projection`, `maintenance` and `all` modes. GitHub Actions schedules projection draining every five minutes and partition, aggregate and retention maintenance daily, only when `FINDIT_RECOMMENDATION_WORKERS_ENABLED=true`.

## Administration

Only the existing database admin predicate can call taxonomy, relationship and weight-profile administration functions. Browser roles cannot write configuration tables directly.

Every accepted configuration change records immutable before-and-after state. Activating a replacement ranking profile also records the automatic deactivation of the displaced profile.

Ranking profiles are versioned and organic. Paid placement is excluded from these scores and must use a separately labelled future surface.

## Privacy and access controls

All Phase 1 tables and the default event partition have RLS enabled. Customer roles cannot directly read projections, the eligible service view, caches, aggregates, weight profiles, configuration audit records, projection jobs or dead letters.

Authenticated users may read only their own event history while their account remains active. Guests cannot read raw events. Suspended users cannot add or read behavioural events.

Service-role workers alone can query currently eligible projections, process projection jobs, create partitions, rebuild popularity, purge expired data, retry dead letters and read the payload-free health snapshot.

## Operational controls

The following controls are recorded in `marketplace_operational_controls`:

- `recommendation_foundation`;
- `recommendation_projection`;
- `recommendation_event_collection`;
- `recommendation_retention`.

The internal Edge Function requires a dedicated `FINDIT_RECOMMENDATION_WORKER_SECRET`, validates JSON and request size, uses bounded limits and returns safe stable errors. It does not return event payloads or identities.

## Certification suites

Phase 1 includes:

- static source and rollback contracts;
- listing-route isolation contracts;
- maintenance endpoint contracts;
- guest, owner, unrelated-user, suspended-user, moderator and admin adversarial RLS tests;
- asynchronous queue, retry, concurrency and dead-letter tests;
- late-row default-partition migration tests;
- active-seller eligibility and restoration tests;
- geospatial index-plan and exact-coordinate isolation tests;
- account and listing deletion-cascade tests;
- stale-projection publication and immediate cleanup tests;
- deterministic weight and immutable-audit tests;
- 2,000-record index-plan and concurrent-insert cursor tests;
- migration reset and database lint gates in GitHub Actions.

The code boundary is complete. Phase 2 must not begin until the repository's GitHub Actions environment successfully starts the migration gate and records passing frontend and database jobs.