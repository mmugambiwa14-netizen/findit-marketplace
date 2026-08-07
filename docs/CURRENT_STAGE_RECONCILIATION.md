# PeekaListing Current Stage Reconciliation

Status: active integration and certification source

Branch: `integration/complete-current-stage`

Certification PR: `#34`

Purpose: maintain one branch containing the latest accepted current-stage frontend, backend, database, security, infrastructure, release, and preview work. Completeness is established by current file content and certification gates, not by branch names or raw commit-count comparisons.

## Included current-stage capability

The branch contains the accepted work from the listing-intelligence, curated-marketplace, security-hardening, verified-business, Peek, release-certification, and post-audit remediation lines, including:

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

Historical branch ancestry is not merged merely to make every old commit an ancestor. A branch can report unique commits while its relevant files are already byte-identical or superseded on this branch.

- `feature/listing-intelligence-foundation`: contained by the current lineage; no current-stage commits ahead.
- `feature/curated-business-marketplace`: contained by the current lineage; no current-stage commits ahead.
- `claude/findit-hardening-listing-012cf0`: contained by the current lineage; no current-stage commits ahead.
- `claude/peekalisting-handoff-vklm8s`: contained by the current lineage; no current-stage commits ahead.
- `integration/final-release-certification`: contained by the current lineage; no current-stage commits ahead.
- `integration/verified-business-journey-certification`: contained by the current lineage and independently re-certified by the current verified-business journey gate.
- `integration/listing-publication-journey-certification`: contained by the current lineage and independently re-certified by the current listing-publication gate.
- `integration/peek-fulfilment-journey-certification`: historical commit ancestry differs, but the current branch contains the fulfilment migrations and contracts; representative migration content is byte-identical and the current Peek fulfilment journey gate re-certifies the capability.
- `continuation/contract-gate-repair`: historical commits are not required as ancestors; the relevant hygiene and Peek Request migration files on the current branch are byte-identical to the repaired branch content.
- `feature/contextual-permissions`: the old dialog component is not merged wholesale because the current branch contains the newer contextual-permission implementation used by `TourUploader`, including first-use camera education, remembered explanation state, blocked-state handling, and upload fallback. The shared permission library also covers location and notifications.
- `feature/peek-threads-phase-3`: not merged wholesale. Its older Supabase Realtime conversation path conflicts with the current bounded polling/refetch messaging architecture and was explicitly superseded.
- `develop`: not merged wholesale. Reviewed safe database/auth/security packages were ported through the controlled integration sequence; the branch also contains stale Peek deletions and superseded deployment/recommendation assumptions.
- historical brand, preview, review, and production-readiness branches are retained as history where their accepted runtime changes are already present or superseded.

## Certification boundary

Draft PR `#34` is the certification harness for this branch and must remain unmerged until the exact current head passes the required gates.

Required repository evidence includes:

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

Hosted staging/browser evidence remains a separate environment-level gate and must not be implied by repository-only success.

## Preview authority

GitHub Pages preview must deploy only from `integration/complete-current-stage` while this branch is the active certification source.

The workflow must check out the exact triggering SHA, bind only to the PeekaListing staging Supabase project, verify the current business/Peek source boundaries, build the application, clear legacy preview caches, and expose `preview-build.json` containing the exact branch and commit SHA.

Preview fixtures are enabled only on the disposable staging preview so current marketplace surfaces can be demonstrated without weakening production media or authorization rules.
