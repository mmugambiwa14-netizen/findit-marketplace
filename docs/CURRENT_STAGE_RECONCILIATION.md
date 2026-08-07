# PeekaListing Current Stage Reconciliation

Status: active integration source

Branch: `integration/complete-current-stage`

Purpose: provide one branch containing the latest accepted and validated current-stage frontend, backend, database, security, infrastructure, release, and preview work.

## Included lineage

This branch is based on the advanced audit/remediation line and therefore contains the accepted work from the canonical release sequence, including:

- listing intelligence and category-aware listing foundation
- Sub-Saharan location registry and privacy-safe location handling
- seller contact privacy and reveal boundaries
- listing and service media/PWA hardening
- curated business publishing
- business applications and category-specific approvals
- verified business approval synchronization
- public business profiles
- managed listing requests and Advertise through PeekaListing flow
- immediate validated listing publication for approved categories
- Public Peeks
- buyer Peek Requests
- seller Peek fulfilment state and response binding
- messaging and inbox protections
- essential notifications
- saved listings and account flows
- admin operations, reports, support, business applications and managed listings
- MFA and admin assurance boundaries
- RLS, RPC, grant and private-schema hardening
- recommendation foundation and security corrections
- Cloudflare queue, worker, media, Turnstile and staging provisioning foundations
- release, migration, security, journey and scale certification gates
- PeekaListing brand, PWA identity and browser metadata
- post-audit remediation and hosted RPC security convergence
- GitHub Pages stale-cache recovery for both FindIt and PeekaListing cache identities

## Deliberately not merged wholesale

The following historical branches are not imported wholesale because repository review explicitly superseded or deferred them:

- `feature/peek-threads-phase-3`: older realtime conversation implementation conflicts with the current polling/refetch messaging architecture.
- `feature/contextual-permissions`: contextual camera education remains a deferred follow-up package rather than a certified current-stage dependency.
- `develop`: only reviewed safe packages were ported; the branch also contains stale Peek deletions, deployment assumptions and other superseded changes.
- historical branding, review, preview and release branches whose accepted changes were already reconciled into the current lineage.

## Preview authority

GitHub Pages preview must deploy only from `integration/complete-current-stage`.

The preview artifact must expose `preview-build.json` containing the exact branch and commit SHA.

Preview fixtures are enabled for staging so current UI and marketplace surfaces can be demonstrated without weakening production media rules.
