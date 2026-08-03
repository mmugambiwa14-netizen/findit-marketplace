# FindIt Consolidated Engineering and Release Report

Reviewed: 2026-07-31  
Repository: `mmugambiwa14-netizen/findit-marketplace`  
Implementation branch: `feature/listing-intelligence-foundation`  
Release pull request: `#1` — open, draft, unmerged  
Staging database boundary: `0101`  
Production database boundary: `0049` — intentionally unchanged

## Executive status

FindIt is an independent React/Vite and Supabase marketplace with no active Base44 runtime or package dependency. The branch contains the Zimbabwe-first V1 marketplace, Peek video listings, independent recommendation services and the MapLibre/MapTiler map stack.

| Area | Current status |
|---|---|
| Base44 elimination | Complete |
| Listings, search, services and profiles | Implemented |
| Messaging and essential notifications | Implemented behind release flags |
| Peek lifecycle | Implemented and hosted-accepted |
| Recommendation services | Seven independent services enabled on staging |
| Maps | First-party MapLibre GL JS 5.12.0 runtime + MapTiler Cloud |
| Public privileged RPC exposure | Anonymous and authenticated definer exposure cleared |
| Deployment security | Repository-owned CSP and security headers implemented |
| Workflow supply chain | All third-party Actions pinned to immutable commits |
| Dependency lock | Normalized; retired Leaflet metadata removed |
| Internal certification | Implemented; conventional execution still blocked by unavailable runners |
| Staging migrations | Canonical `0001` through `0101` |
| Production migrations | Locked at `0049` |
| Production recommendation | Do not release yet |

## Product and architecture boundary

Current customer and operator capabilities include:

- Discover and cursor-based public search
- Property, vehicle and machinery listings
- Services marketplace
- Listing and service publishing with private media paths
- Saved listings, seller profiles and business/dealer profiles
- Plain-text conversations with participant isolation
- Essential notifications
- Support, reporting and moderation
- Peek upload, processing, playback, moderation, cleanup and cache invalidation
- Seven isolated recommendation services with consent-gated personalization
- MapLibre rendering, MapTiler styles/geocoding and PostGIS spatial queries

Payments, subscriptions, escrow, premium listings, AI automation, listing expiry, international publishing, phone verification, currency conversion and service-radius controls remain deliberately fail-closed.

Device location is opt-in. Coordinates are used only to resolve a supported public city through MapTiler. The resolver and Home storage retain only country, province, city, city name and source. Manual location remains mandatory as a fallback.

## Privileged RPC boundary

Migration `0101_private_authenticated_rpc_implementations.sql` closed the final advisor-reported public privileged RPC surface:

- pre-migration catalog: 57 authenticated-callable public definers
- catalog fingerprint: `ce6194659e01b758dc20948daf351bea`
- post-migration public authenticated definers: zero
- public `SECURITY INVOKER` compatibility wrappers: 57
- private privileged implementations: 57
- authenticated grants preserved: 57
- service-role grants preserved: 53
- anonymous and `PUBLIC` execute grants: zero

Hosted semantic and exact rollback matrices passed with zero fixture residue.

## Maps and deployment security

- MapLibre GL JS is pinned to `5.12.0`.
- Official JavaScript and CSS assets are committed under `public/vendor/maplibre`.
- The browser loads MapLibre from FindIt's own origin.
- UNPKG is absent from the production CSP.
- `script-src` is first-party only.
- The repository verifies committed MapLibre assets against the exact pinned upstream distribution.
- Internal certification records SHA-256 hashes for both vendored assets.
- Vercel SPA rewrites, HSTS, clickjacking protection, MIME-sniffing protection, Referrer Policy, Permissions Policy and OAuth-compatible opener isolation are repository-owned.

## Supply chain and certification

- Every third-party GitHub Action is pinned to an approved immutable commit SHA.
- `package-lock.json` matches the active manifest and Node `>=23.6.0` boundary.
- Retired Leaflet and `@types/leaflet` lock metadata is removed.
- Clean-database verification is centralized into 34 migration/security suites and 13 recommendation suites.
- A ten-assertion Security Advisor baseline passed on staging in a rolled-back transaction.
- `npm run certify:internal` records source, migration, dependency, deployment, provider and vendored-runtime hashes plus every gate result.
- Exact certification refuses a modified checkout.
- Certification and dependency evidence is retained for 90 days.

## Verification boundary

The last complete three-workflow GitHub Actions certification remains migration `0091`:

- Release candidate gates: `30578963083`
- Migration gates: `30578963043`
- Recommendation database gates: `30578963068`

Migrations `0092` through `0101` have repository migrations, rollback capsules, source contracts and hosted staging evidence. Staging currently has:

- 101 canonical migration rows from `0001` through `0101`
- zero sequence mismatches
- zero generated-version residue
- zero due Peek cache invalidations
- zero anonymous-callable public privileged functions
- zero authenticated-callable public privileged functions

Current GitHub Actions jobs still terminate before executable steps begin and expose no steps or logs. Final clean-checkout, build and clean-database certification on one unchanged release head remains mandatory.

## Remaining external and operational gates

1. Restore GitHub Actions execution and pass all suites through `0101`.
2. Configure and browser-certify an origin-restricted MapTiler key and approved style.
3. Enable leaked-password protection, founder/admin TOTP MFA and CAPTCHA/risk controls; configure production SMTP and Google OAuth callbacks.
4. Configure production domain, secrets, monitoring destinations, backup/PITR, isolated restore evidence and a named cutover window.
5. Complete physical browser, device, accessibility, capacity and cost acceptance.

## Final verdict

The product, staging database, privileged RPC boundary, map runtime, dependency lock and internal release engineering are hardened through the current branch head. Production remains blocked by conventional CI recovery and external provider/operational gates. Production project `jvbpxnfxkptuexgssplj` has not been migrated beyond `0049`.
