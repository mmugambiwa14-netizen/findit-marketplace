# Milestone 5 / E — Public Tours Catalogue

## Completed boundary

Milestone 5 enables the public `/tours` catalogue as a listing-backed discovery surface. It does not create independent video posts, creator identities, social engagement, or a second save/chat model.

Implemented:

- A service-role-only `public_tour_feed` read model covering Property, Vehicles, Equipment, and eligible Services.
- Deterministic keyset pagination using `(published_at, tour_id)` with bounded pages and no deep offsets.
- One denormalized feed record per canonical parent containing listing/service identity, price, public location, availability, up to three useful attributes, seller context, and Tour duration.
- A public `tour-feed` Edge Function that validates filters, invokes the service-only read model, batch-signs private thumbnails and cover images, and never returns source or playback storage paths.
- One-hour signed card assets for long catalogue sessions and restored positions. Playback remains a separate five-minute signed boundary requested only after explicit Play.
- A dark cinematic catalogue with search, category chips, optional location filtering, large 16:9 cards, manual bounded pagination, and approximately one-and-a-half cards per mobile viewport.
- Thumbnail-first playback with no automatic sound, no full-file preload, low-data awareness, poster fallback, retry handling, and one active video at a time.
- Canonical View listing, Share, Save, Chat, and Contact actions. Saving a Tour saves its listing; services continue through their existing detail/contact path.
- URL-backed filters and session restoration for scroll position, active Tour, and practical playback position when returning from a listing.
- Parent lifecycle enforcement: only ready, approved Tours belonging to available/under-offer listings or active non-legal services enter the feed.
- Migration `0038_v1_public_tours_catalogue.sql`, targeted rollback, contracts, and guarded local/hosted catalogue smoke commands.

## Security and identity boundary

- Browser roles cannot execute the feed RPC directly.
- The Edge Function returns signed card URLs, not private bucket paths.
- Public feed responses contain no playback URL. Playback is signed only after the existing eligibility function rechecks the canonical parent.
- Tour source objects remain private and are never referenced by the catalogue.
- The catalogue has no public likes, comments, followers, reactions, creator feeds, engagement counts, autoplay sound, or full-screen swipe loop.
- Sold, rented, hired, expired, removed, rejected, reported, failed, or otherwise ineligible content is excluded at query time.

## Verification

Dependency-independent gates:

```bash
npm run test:tours-contracts
npm run test:contracts
npm run verify:base44-elimination
npm run validate:env
```

Authorized local Supabase catalogue acceptance:

```bash
npm run test:tours-discovery-local
```

Authorized hosted staging acceptance:

```bash
FINDIT_ALLOW_HOSTED_TESTS=true \
FINDIT_EXPECTED_PROJECT_REF=<exact-staging-ref> \
npm run test:tours-discovery-hosted
```

Dependency-backed acceptance after a successful locked install:

```bash
npm ci
npm run lint
npm run typecheck
npm run typecheck:migration
npm run typecheck:active
npm run build
npm run audit:production
```

## Staging activation order

1. Back up the confirmed staging database and record the current frontend deployment.
2. Apply migrations `0031` through `0038` in order and deploy all Tour Edge Functions, including `tour-feed`.
3. Configure the Tour processor, callback, worker, cleanup, cache, bucket, and origin settings.
4. Keep `VITE_FEATURE_TOURS=false` while running upload, processing, seller, integration, lifecycle, and discovery smokes.
5. Inspect the `public_tour_feed` query plan against substantial fixtures and verify cursor pages have no duplicates or omissions.
6. Test thumbnail loading, explicit playback, low bandwidth, signed-URL expiry, unavailable-parent removal, scroll restoration, and mobile memory on the deployed staging frontend.
7. Enable Tours in staging only after operational alerts, storage growth, processing latency, playback failures, and feed latency have named thresholds and responders.
8. Keep production disabled until staging acceptance and rollback rehearsal are signed.

## Rollback

1. Set `VITE_FEATURE_TOURS=false` and redeploy the previous frontend if required.
2. Disable backend Tour publication and writes; pause processing without deleting media.
3. Apply `supabase/rollback/0038_v1_public_tours_catalogue.rollback.sql` only against the confirmed target.
4. Preserve Tour rows and objects for investigation and controlled cleanup.

The targeted rollback removes only the feed RPC and its seven supporting indexes. It does not delete listings, services, Tours, source media, playback outputs, thumbnails, saves, or conversations.

## Packaging verification limit

Implementation and dependency-independent verification are complete: 67/67 Tour contracts, 162/162 repository contracts, Base44 elimination, development and production environment validation, JSON/YAML parsing, secret hygiene, and static syntax/import verification across 286 modules pass.

A fresh locked dependency install could not complete in the packaging environment because the configured package registry returned HTTP 503 responses for locked dependency tarballs. Installed lint, installed project typechecks, and the Vite production build therefore remain explicit deployment gates. The lockfile-based production dependency audit passed with no reachable Moderate, High, or Critical advisories. PostgreSQL migration execution, query-plan inspection, browser/device acceptance, and live Supabase smoke also remain deployment gates because no authorized Supabase target or local stack was available in this session.
