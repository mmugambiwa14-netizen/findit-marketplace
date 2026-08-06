# Milestone 4 / D — Listing and Tour Integration

## Completed boundary

Milestone 4 integrates approved Tours into every canonical listing surface without creating a separate saved, profile, or messaging identity for video.

Implemented:

- Metadata-only public Tour summaries for listing and service cards. Public list queries never receive source, playback, or thumbnail storage paths.
- Signed playback access only from the existing eligibility-controlled playback function on a listing or service detail request.
- Tour-aware cards across search, saved listings, seller profiles, dealer inventory, business inventory, and service profiles.
- Canonical deep links using the existing listing or service route with `?media=tour`; cards still open the parent listing and saving still uses `saved_listings`.
- Asset wording uses `Tour` / `Watch tour`; services use `See their work`.
- Explicit-playback media behavior with image fallback, photo preservation, playback-error recovery, no autoplay sound, and no disabled no-video control.
- Under-offer listings remain enquiry-eligible and visible in public browse/search. Sold, rented, expired, or otherwise unavailable listings leave active browse and lose public Tour eligibility.
- Existing saved listings retain the canonical unavailable listing row, media metadata, and authorized private image access. Existing conversation participants retain the same context so View listing continues to work after a status change. New saves remain restricted to enquiry-eligible listings.
- New conversations can start only for available or under-offer listings. Existing conversation history remains available after a status change.
- Chat inbox and thread headers now include listing thumbnail, title, price, availability, Tour badge, and a View listing path without exposing private Tour storage data.
- Seller inventory exposes Tour management for draft, rejected, pending-review, expired, available, and under-offer listings only where the backend parent state permits it. Live content edits rely on the managed-field review transition and never issue a duplicate owner submission; Tour-only management does not falsely claim that the listing was resubmitted.
- Seller, service, Tour, and lifecycle mutations invalidate every canonical React Query projection.
- Database invalidations cover Tour-feed-relevant parent content changes and suppress no-op updates.
- Migration `0037_v1_listing_tour_integration.sql`, targeted rollback, contracts, and guarded Supabase integration smoke.

## Security and identity boundary

- Every Tour remains owned by exactly one canonical listing or service.
- Public card data exposes only Tour identity, parent identity, duration, and publication time.
- Playback and thumbnail locators are short-lived signed values returned only after current public eligibility is rechecked.
- Saved-listing and existing-conversation access is user-specific and does not make unavailable listings or private images public.
- Messages remain listing conversations. No saved-Tour table, Tour conversation, creator feed, follower system, or video engagement identity was introduced.

## Verification

Dependency-independent gates:

```bash
npm run test:tours-contracts
npm run test:contracts
npm run verify:base44-elimination
```

Authorized local Supabase integration:

```bash
npm run test:tours-integration-local
```

Authorized hosted integration:

```bash
FINDIT_ALLOW_HOSTED_TESTS=true \
FINDIT_EXPECTED_PROJECT_REF=<exact-staging-ref> \
npm run test:tours-integration-hosted
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

## Rollback

1. Set `VITE_FEATURE_TOURS=false`.
2. Disable backend Tour publication and writes.
3. Apply `supabase/rollback/0037_v1_listing_tour_integration.rollback.sql` only against the confirmed target.
4. Preserve Tour rows and media while caches and listing visibility are reconciled.

The targeted rollback removes the metadata-summary RPC, restores the previous listing/media/storage policies, restores the previous messaging function shapes, and returns Tour invalidation triggers to status-only behavior. It does not delete Tour data.

## Packaging verification limit

Implementation and dependency-independent verification are complete: 56/56 Tour contracts, 151/151 repository contracts, Base44 elimination, development and production environment validation with Tours closed, JSON/YAML parsing, secret hygiene, and static syntax/import verification across 279 modules pass.

A fresh locked dependency install could not complete in the packaging environment: the configured internal npm registry returned HTTP 503 and direct `registry.npmjs.org` requests failed DNS resolution with `EAI_AGAIN`. Lint, installed project typechecks, production build, production dependency audit, PostgreSQL migration execution, and live Supabase smoke therefore remain explicit release-acceptance gates. No authorized Supabase target or local stack was available in this session.
