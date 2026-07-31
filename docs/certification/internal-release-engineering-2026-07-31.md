# Internal Release Engineering Certification

Date: 2026-07-31  
Branch: `feature/listing-intelligence-foundation`  
Staging database boundary: `0101`  
Production database boundary: `0049` — unchanged

## Completed internally

### Browser and deployment boundary

- Removed inline document JavaScript from `index.html`.
- Added an external, fail-safe document bootstrap for deep-link restoration and
  theme initialization.
- Added repository-owned Vercel SPA rewrites and security headers.
- Content Security Policy rejects inline scripts and eval.
- Inline style attributes are allowed only through `style-src-attr` because the
  application and MapLibre require runtime geometry and theme styling.
- Added HSTS, clickjacking protection, MIME-sniffing protection, referrer and
  permissions policies, OAuth-compatible opener isolation, and immutable asset
  caching.
- Added deterministic deployment-security verification and source contracts.

### Supply-chain boundary

- Every third-party GitHub Action in all seven workflows is pinned to an
  approved immutable 40-character commit SHA.
- Added a workflow pinning allowlist and source contract.
- Added deterministic package-lock normalization before every workflow cache
  calculation and `npm ci` execution.
- Added a lock-derived dependency inventory with integrity, registry, license,
  production/development classification, and retired-package checks.
- Certification and staging acceptance retain their JSON evidence for 90 days.

### Certification boundary

- Added `npm run certify:internal`.
- The report records the commit, runtime versions, migration tip, source hashes,
  every gate result, output, and dependency inventory hash.
- Certification requires both all gates to pass and the working tree to match
  the requested commit exactly.
- A normalized but modified checkout cannot be represented as an exact release
  certification.

### Database boundary

- Added a pgTAP Security Advisor regression baseline covering public privileged
  functions, invoker/private pairs, `PUBLIC` grants, fail-closed RLS tables, and
  certified map metadata.
- The complete ten-assertion baseline passed on staging in a rolled-back
  transaction.
- Centralized the clean-database migration matrix into 34 versioned suites.
- Centralized the recommendation database matrix into 13 versioned suites.
- Both scripts pin Supabase CLI `2.84.2`, lint the database, fail on a missing
  suite, and stop local resources through an exit trap.

## Explicit internal blockers

### Committed package lock

The committed `package-lock.json` still contains stale root metadata for
Leaflet, `@types/leaflet`, and the old Node engine. The normalization script
produces the correct installation boundary before every workflow install, but
that changes the checkout.

The repository connector cannot safely replace this large lockfile because the
contents API requires one complete full-file write beyond the available
transfer boundary. Therefore exact-source certification intentionally fails
until the normalized lockfile is generated and committed from a normal
checkout or functioning runner.

Required command from an ordinary repository checkout:

```bash
node ./scripts/normalize-package-lock.mjs --write
git add package-lock.json
git commit -m "Normalize dependency lock after MapLibre migration"
```

No dependency versions are changed by this normalization; it synchronizes root
metadata and removes retired, unreferenced Leaflet lock entries.

### MapLibre runtime asset

MapLibre remains exactly pinned to version `5.12.0` and restricted by CSP to the
UNPKG origin. The runtime asset could not be downloaded through the current
execution environment, so it has not been falsely represented as self-hosted.
A later ordinary checkout can vendor the official runtime, worker and CSS,
record their hashes, and remove UNPKG from CSP.

## Current decision

Repository-owned release engineering is complete to the maximum boundary
available through the connected repository and staging database. Production
remains untouched at migration `0049`.

Do not represent the branch as an exact internally certified commit until the
normalized lockfile is committed and the full certification command passes on
that unchanged commit. Provider configuration, GitHub runner recovery and
physical browser/device acceptance remain separate external gates.
