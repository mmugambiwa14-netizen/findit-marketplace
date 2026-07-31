# FindIt Consolidated Engineering and Release Report

Reviewed: 2026-07-31  
Repository: `mmugambiwa14-netizen/findit-marketplace`  
Implementation branch: `feature/listing-intelligence-foundation`  
Release pull request: `#1` — open, draft, unmerged  
Staging database boundary: `0101`  
Production database boundary: `0049` — intentionally unchanged

## Executive status

FindIt is an independent React/Vite and Supabase marketplace with no active
Base44 runtime or package dependency. The branch contains the Zimbabwe-first V1
marketplace, Peek video listings, independent recommendation services and the
MapLibre/MapTiler map stack.

| Area | Current status |
|---|---|
| Base44 elimination | Complete |
| Listings, search, services and profiles | Implemented |
| Messaging and essential notifications | Implemented behind release flags |
| Peek lifecycle | Implemented and hosted-accepted |
| Recommendation services | Seven independent services enabled on staging |
| Maps | MapLibre GL JS 5.12.0 + MapTiler Cloud implemented |
| Public privileged RPC exposure | Anonymous and authenticated definer exposure cleared |
| Deployment security | Repository-owned CSP and security headers implemented |
| Workflow supply chain | All third-party Actions pinned to immutable commits |
| Internal certification | Implemented; exact-source certification currently blocked by stale committed lock metadata |
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

Payments, subscriptions, escrow, premium listings, AI automation, listing
expiry, international publishing, phone verification, currency conversion and
service-radius controls remain deliberately fail-closed.

Device location is opt-in. Coordinates are used only to resolve a supported
public city through MapTiler. The resolver and Home storage retain only country,
province, city, city name and source. Manual location remains mandatory as a
fallback.

## Privileged RPC boundary

Migration `0101_private_authenticated_rpc_implementations.sql` closed the final
advisor-reported public privileged RPC surface:

- pre-migration catalog: 57 authenticated-callable public definers
- catalog fingerprint: `ce6194659e01b758dc20948daf351bea`
- post-migration public authenticated definers: zero
- public `SECURITY INVOKER` compatibility wrappers: 57
- private privileged implementations: 57
- authenticated grants preserved: 57
- service-role grants preserved: 53
- anonymous and `PUBLIC` execute grants: zero

The hosted semantic matrix verified owner tools, listing transitions,
notifications, messaging, participant isolation, conversation reporting, admin
reads/actions, audit writing, fail-closed submission/media/Peek paths and
suspended-account denial. All fixtures rolled back. The exact rollback capsule
restored all 57 original functions and the exact fingerprint inside a
non-persisted transaction; staging remained hardened after that transaction was
rolled back.

## Internal release engineering

The repository now contains:

- external document bootstrap with no inline JavaScript;
- repository-owned Vercel SPA rewrites, CSP and security headers;
- script-safe CSP with inline styles limited to `style-src-attr` for runtime
  geometry and theme state;
- deterministic deployment-security and workflow-pinning checks;
- immutable commit pins for every third-party GitHub Action;
- centralized 34-suite migration and 13-suite recommendation database runners;
- a Security Advisor regression baseline that passed all ten assertions on
  staging in a rolled-back transaction;
- deterministic package-lock normalization before all workflow installs;
- a lock-derived dependency inventory with integrity and registry checks;
- `npm run certify:internal`, which records source hashes and every gate result;
- 90-day retention of certification and dependency evidence.

Exact-source certification requires the working tree to match the requested
commit. The committed `package-lock.json` still contains retired Leaflet root
metadata and the old Node engine. Workflows normalize it before installation,
but that mutation intentionally prevents exact certification. The large lock
must be normalized and committed through a normal checkout before the branch can
receive an unchanged-source certificate.

MapLibre remains exactly pinned to version `5.12.0` at the UNPKG origin and is
restricted by CSP. Its official runtime, worker and CSS have not yet been
vendored because the current execution environment could not retrieve those
assets. This is documented rather than represented as completed.

## Verification boundary

The last complete three-workflow GitHub Actions certification remains migration
`0091`:

- Release candidate gates: `30578963083`
- Migration gates: `30578963043`
- Recommendation database gates: `30578963068`

Migrations `0092` through `0101` have repository migrations, rollback capsules,
source contracts and hosted staging evidence. Staging currently has:

- 101 canonical migration rows from `0001` through `0101`
- zero sequence mismatches
- zero generated-version residue
- zero due Peek cache invalidations after bounded recovery
- zero anonymous-callable public privileged functions
- zero authenticated-callable public privileged functions

Recent GitHub Actions jobs still fail before executable steps begin and contain
no steps or logs. Final clean-checkout, build and clean-database certification
on one unchanged release head remains mandatory.

## Remaining gates

Internal source boundary:

1. Generate and commit the normalized `package-lock.json` from a normal checkout.
2. Run `npm run certify:internal` on that unchanged commit.
3. Vendor the official pinned MapLibre runtime assets when asset retrieval is
   available, then remove UNPKG from CSP.

External and operational boundary:

1. Restore GitHub Actions execution and pass all suites through `0101`.
2. Configure and browser-certify an origin-restricted MapTiler key and approved
   style.
3. Enable leaked-password protection, founder/admin TOTP MFA and CAPTCHA/risk
   controls; configure production SMTP and Google OAuth callbacks.
4. Configure production domain, secrets, monitoring destinations, backup/PITR,
   isolated restore evidence and a named cutover window.
5. Complete physical browser, device, accessibility, capacity and cost
   acceptance.

## Final verdict

The product, staging database, privileged RPC boundary and internal release
engineering are hardened to the maximum boundary available through the current
connectors. Production remains blocked by the exact committed lockfile,
conventional CI recovery, runtime asset vendoring and external
provider/operational gates. Production project `jvbpxnfxkptuexgssplj` has not
been migrated beyond `0049`.
