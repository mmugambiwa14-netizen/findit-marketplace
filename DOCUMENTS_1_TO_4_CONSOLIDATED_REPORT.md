# FindIt Consolidated Engineering and Release Report

Reviewed: 2026-07-31  
Repository: `mmugambiwa14-netizen/findit-marketplace`  
Implementation branch: `feature/listing-intelligence-foundation`  
Release pull request: `#1` — open, draft, unmerged  
Staging database boundary: `0100`  
Production database boundary: `0049` — intentionally unchanged

## Executive status

FindIt is an independent React/Vite and Supabase marketplace with no active
Base44 runtime or package dependency. The branch contains the Zimbabwe-first V1
marketplace, Peek video listings and independent recommendation services.

The current branch is a staging release candidate under active security
hardening. It is not approved for production and must not be merged solely from
this report.

| Area | Current status |
|---|---|
| Base44 elimination | Complete |
| Canonical listings, search, services and profiles | Implemented |
| Messaging and essential notifications | Implemented behind release flags |
| Peek lifecycle | Implemented and hosted-accepted |
| Recommendation services | Seven independent services enabled on staging |
| Maps | MapLibre GL JS 5.12.0 + MapTiler Cloud implemented |
| Staging migrations | Canonical `0001` through `0100` |
| Production migrations | Locked at `0049` |
| Production recommendation | Do not release yet |

## 1. Preserved product boundary

The application preserves its marketplace capabilities while separating the UI
from provider-specific integrations through services and repositories. Current
public and protected surfaces include:

- Discover and cursor-based public search
- Property, vehicle and machinery listings
- Services marketplace
- Listing and service publishing with private media upload paths
- Saved listings, seller profiles and business/dealer profiles
- Plain-text conversations and participant isolation
- Essential notifications
- Contact support, reporting and moderation
- Peek upload, processing, playback, moderation, cleanup and cache invalidation
- Seven isolated recommendation services with consent-gated personalization

Payments, subscriptions, escrow, premium listings, AI automation, listing
expiry, international publishing, phone verification, currency conversion and
service-radius controls remain deliberately fail-closed for the current V1.

## 2. Current architecture

- Frontend: React and Vite
- Authentication and database: Supabase Auth and PostgreSQL
- Authorization: RLS plus bounded RPC contracts
- Media: private Supabase Storage buckets and trusted upload functions
- Maps: MapLibre GL JS `5.12.0` with MapTiler Cloud styles and geocoding
- Spatial data: PostGIS-backed marketplace location and recommendation queries
- Workers: Supabase Edge Functions invoked by trusted scheduler credentials
- Observability: bounded database metrics and operational alerts

Device location is opt-in. It resolves to a supported public city and does not
persist exact coordinates from the location selector. Manual location remains a
required fallback.

## 3. Verification boundary

The last complete three-workflow GitHub Actions certification remains the
`0091` migration boundary:

- Release candidate gates: `30578963083`
- Migration gates: `30578963043`
- Recommendation database gates: `30578963068`

Migrations `0092` through `0100` have repository migrations, rollback capsules,
source contracts and hosted staging evidence. Migration `0100` passed a hosted
rollback-only transaction, permanent application, guarded ledger
reconciliation and rollback-capsule validation.

Staging currently has:

- 100 canonical migration rows from `0001` through `0100`
- zero sequence mismatches
- zero generated-version residue
- zero due Peek cache invalidations after bounded queue recovery
- zero anonymous-callable `SECURITY DEFINER` functions

Conventional clean-database CI on the final unchanged branch head remains
mandatory because recent GitHub Actions runs have failed before runner steps
begin.

## 4. Remaining boundaries

Repository-owned feature and release-control drift found by the July 31 audit
has been corrected through migration `0100` and the MapLibre/MapTiler product
changes. Remaining work is:

1. Continue moving the 57 authenticated-callable public definer functions
   behind non-exposed private implementations and public invoker wrappers.
2. Restore GitHub Actions runner execution and run all source, build and
   clean-database suites through `0100`.
3. Configure and browser-certify a protected MapTiler key for each deployment
   origin.
4. Complete provider-side Auth hardening: leaked-password protection, TOTP MFA,
   CAPTCHA/risk controls, production SMTP and public Google OAuth callbacks.
5. Configure production domain, secrets, monitoring destinations, backup/PITR,
   isolated restore evidence and a named cutover window.
6. Complete physical browser, device and assistive-technology acceptance.

## Final verdict

The staging implementation is materially stronger and its release controls now
match the product. Production remains blocked by authenticated-function
hardening, conventional CI recovery and external provider/operational gates.
Production project `jvbpxnfxkptuexgssplj` has not been migrated beyond `0049`.
