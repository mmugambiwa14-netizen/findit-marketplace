# PeekaListing Current Stage Reconciliation

Status: promoted and canonical

Canonical branch: `main`

Promotion PR: `#34`

Promotion merge: `c7ea23d1465aa37e9e0481a9874fffb21e86ffdd`

Purpose: keep one canonical source containing the latest accepted current-stage frontend, backend, database, security, infrastructure, release, and preview work. Completeness is established by current file content and certification gates, not by branch names or raw commit-count comparisons.

## Promotion result

`integration/complete-current-stage` was fully certified and merged into `main` with a normal merge commit so the prior `main` preview-history commits and the complete integration lineage were both preserved.

After merge, the integration branch was fast-forwarded to the merge commit and verified identical to `main` at that point. It is retained only as a historical alias until branch deletion is available; new product work must use `main`.

The promotion head `304cd007a0a4e19b7bcaaca0ee3f3cf334489c0d` passed the complete GitHub certification matrix before merge. The final merge preserves that exact source as an ancestor of canonical `main`.

## Included current-stage capability

Canonical `main` contains the accepted work from the listing-intelligence, curated-marketplace, security-hardening, verified-business, Peek, release-certification, and post-audit remediation lines, including:

- listing intelligence and category-aware listing foundation
- Sub-Saharan location registry and privacy-safe location handling
- contextual camera, location, and notification permission foundations
- seller contact privacy and audited reveal boundaries
- listing and service media/PWA hardening
- curated business publishing
- business applications and category-specific approvals
- verified business approval synchronization
- public business profiles
- managed listing requests and the Advertise through PeekaListing flow
- immediate validated listing publication for approved categories
- Public Peeks
- buyer Peek Requests
- seller Peek fulfilment state and Response Peek binding
- messaging and inbox protections
- essential notifications
- saved listings and account flows
- admin operations, reports, support, business applications, and managed listings
- MFA and admin assurance boundaries
- RLS, RPC, grant, contact-column, and private-schema hardening
- recommendation foundation, scale work, and security corrections
- Cloudflare queue, worker, media, Turnstile, headers, and staging provisioning foundations
- release, migration, security, journey, database, and scale certification gates
- PeekaListing brand, PWA identity, browser metadata, offline copy, and current permission copy
- post-audit remediation and hosted RPC security convergence
- GitHub Pages stale-cache recovery for both legacy FindIt and current PeekaListing cache identities

## Reconciliation decisions

Historical branch ancestry was not imported merely to make every old commit an ancestor. A branch can report unique commits while its relevant files are already byte-identical or superseded by the canonical implementation.

- `feature/listing-intelligence-foundation`: contained by the canonical lineage; no current-stage commits ahead.
- `feature/curated-business-marketplace`: contained by the canonical lineage; no current-stage commits ahead.
- `claude/findit-hardening-listing-012cf0`: contained by the canonical lineage; no current-stage commits ahead.
- `claude/peekalisting-handoff-vklm8s`: contained by the canonical lineage; no current-stage commits ahead.
- `integration/final-release-certification`: contained by the canonical lineage; no current-stage commits ahead.
- `integration/verified-business-journey-certification`: contained and independently re-certified by the verified-business journey gate.
- `integration/listing-publication-journey-certification`: contained and independently re-certified by the listing-publication gate.
- `integration/peek-fulfilment-journey-certification`: historical commit ancestry differs, but canonical `main` contains the fulfilment migrations and contracts; representative migration content was byte-identical and the current Peek fulfilment journey gate re-certified the capability.
- `continuation/contract-gate-repair`: historical commits are not required as ancestors; the relevant hygiene and Peek Request migration files were byte-identical to the repaired branch content.
- `feature/contextual-permissions`: the old dialog component was not merged wholesale because canonical `main` contains the newer contextual-permission implementation used by `TourUploader`, including first-use camera education, remembered explanation state, blocked-state handling, and upload fallback. The shared permission library also covers location and notifications.
- `feature/peek-threads-phase-3`: not merged wholesale. Its older Supabase Realtime conversation path conflicts with the current bounded polling/refetch messaging architecture and was explicitly superseded.
- `develop`: not merged wholesale. Reviewed safe database/auth/security packages were ported through the controlled integration sequence; the branch also contains stale Peek deletions and superseded deployment/recommendation assumptions.
- historical brand, preview, review, and production-readiness branches remain provenance where their accepted runtime changes are already present or superseded.

## Certification evidence

The promotion head passed:

- release environment validation
- source graph verification
- repository hygiene and secret-marker checks
- SQL migration-boundary verification
- routed product-surface audit
- complete source contract suite
- complete Peeks/Tours contract suite
- lint
- application, migration, active-surface, and Edge Function typechecks
- production build
- production dependency audit
- reproducible internal certification
- clean-database reset, RLS, pgTAP, and recommendation certification
- buyer journey certification
- verified-business journey certification
- Peek fulfilment journey certification
- listing-publication journey certification
- safety-operations journey certification
- security-behaviour gates
- critical-infrastructure gates
- Cloudflare provisioning gates
- final release certification

Hosted staging/browser evidence remains a separate environment-level gate and must not be implied by repository-only success.

## Preview authority

GitHub Pages preview must deploy only from canonical `main`.

`.github/workflows/peekalisting-preview.yml` is the single Pages deployment workflow. It checks out the exact triggering SHA, requires the `main` ref, binds only to the PeekaListing staging Supabase project, verifies the current business and Peek source boundaries, builds the application with the Pages base path, clears legacy preview caches, and exposes `preview-build.json` containing the exact deployed branch and commit SHA.

Preview fixtures are enabled only on the disposable staging preview so current marketplace surfaces can be demonstrated without weakening production media or authorization rules.

## Working rule

All new PeekaListing work starts from `main`. Do not use historical feature, release, preview, or integration branches as a new source of truth without first proving that a specific change is absent from `main` and is still compatible with the current architecture.
