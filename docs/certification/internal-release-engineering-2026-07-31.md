# Internal Release Engineering Certification

Date: 2026-07-31  
Branch: `feature/listing-intelligence-foundation`  
Staging database boundary: `0101`  
Production database boundary: `0049` — unchanged

## Completed internally

### Browser and deployment boundary

- Removed inline document JavaScript from `index.html`.
- Added an external, fail-safe document bootstrap for deep-link restoration and theme initialization.
- Added repository-owned Vercel SPA rewrites and security headers.
- Content Security Policy rejects inline scripts, external script origins and eval.
- Inline style attributes are allowed only through `style-src-attr` because the application and MapLibre require runtime geometry and theme styling.
- Added HSTS, clickjacking protection, MIME-sniffing protection, referrer and permissions policies, OAuth-compatible opener isolation, and immutable application-asset caching.
- Added deterministic deployment-security verification and source contracts.

### Map runtime boundary

- MapLibre GL JS remains pinned to `5.12.0`.
- The official JavaScript and CSS distribution files are committed under `public/vendor/maplibre`.
- The browser loads those assets from FindIt's own origin.
- UNPKG has been removed from the production Content Security Policy.
- `verify:maplibre-assets` compares the committed assets with the pinned upstream distribution.
- Internal certification records separate SHA-256 hashes for the vendored JavaScript and stylesheet.

### Supply-chain boundary

- Every third-party GitHub Action in all seven workflows is pinned to an approved immutable 40-character commit SHA.
- Added a workflow pinning allowlist and source contract.
- `package-lock.json` now matches `package.json`, uses the Node `>=23.6.0` engine boundary and contains no retired Leaflet root metadata.
- Added deterministic package-lock normalization verification before workflow cache calculation and `npm ci` execution.
- Added a lock-derived dependency inventory with integrity, registry, license, production/development classification, and retired-package checks.
- Certification and staging acceptance retain their JSON evidence for 90 days.

### Certification boundary

- Added `npm run certify:internal`.
- The report records the commit, runtime versions, migration tip, source hashes, vendored MapLibre asset hashes, every gate result, output, and dependency inventory hash.
- Certification directly runs the vendored MapLibre verification.
- Certification requires both all gates to pass and the working tree to match the requested commit exactly.
- A modified checkout cannot be represented as an exact release certification.

### Database boundary

- Added a pgTAP Security Advisor regression baseline covering public privileged functions, invoker/private pairs, `PUBLIC` grants, fail-closed RLS tables, and certified map metadata.
- The complete ten-assertion baseline passed on staging in a rolled-back transaction.
- Centralized the clean-database migration matrix into 34 versioned suites.
- Centralized the recommendation database matrix into 13 versioned suites.
- Both scripts pin Supabase CLI `2.84.2`, lint the database, fail on a missing suite, and stop local resources through an exit trap.

## Remaining verification boundary

The previous repository-owned lockfile and MapLibre-vendoring blockers are closed.

Exact internal certification still requires an execution environment capable of starting the workflow or a clean local checkout that can run all Node, Deno, build and Supabase gates. Current GitHub Actions jobs continue to terminate before any executable step appears and expose no logs.

## Current decision

Repository-owned release engineering is complete through the current branch head and staging remains canonical through migration `0101`. Production remains untouched at migration `0049`.

Do not represent the branch as conventionally certified until `npm run certify:internal`, the migration gates and the recommendation database gates pass on one unchanged commit. Provider configuration, GitHub runner recovery and physical browser/device acceptance remain separate external gates.
