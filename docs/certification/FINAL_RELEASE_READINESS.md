# PeekaListing Final Release Readiness

Updated: 2026-08-07
Canonical branch: `main`
Stage 6 working branch: `integration/final-release-certification`

## Release decision

**Repository release candidate: conditionally ready.**

**Public production launch: not yet certified.**

The repository contains the intended MVP architecture, PeekaListing identity and five core journeys. Hosted Supabase, storage, media-processing, notification, browser, performance and provider evidence remains incomplete. Exact external gates are recorded in `docs/certification/EXTERNAL_CERTIFICATION_BLOCKERS.md`.

## Locked MVP boundary

- Listings publish immediately after business-category authorization, payload validation and validated image attachment.
- Peeks publish automatically after successful media-processing validation.
- There is no routine human listing review queue.
- There is no routine human Peek approval queue.
- Verified-business/category decisions remain administrator-controlled.
- Reports, suspension, removal, restoration and takedown are post-publication safety controls.

## Core journey status

| Stage | Journey | Repository status | Hosted status |
|---|---|---|---|
| 1 | Search → Peek → notifications → messaging | Repository-certified | Pending |
| 2 | Business application → category decision → verified profile and inventory | Repository-certified | Pending |
| 3 | Peek request → seller fulfilment → processing → publication → buyer result | Repository-certified | Pending |
| 4 | Draft → image upload → immediate listing publication → lifecycle management | Repository-certified | Pending |
| 5 | Verified-business decisions → reports → takedown/restoration → audit | Repository-certified | Pending |
| 6 | Clean migration, build/PWA, hosted checks, scale and cleanup | Orchestration implemented | Pending workflow execution |

## Final certification assets

- `.github/workflows/release-certification.yml`
- `scripts/certify-final-release.mjs`
- `scripts/certify-buyer-journey.mjs`
- `scripts/certify-verified-business-journey.mjs`
- `scripts/certify-peek-fulfilment-journey.mjs`
- `scripts/certify-listing-publication-journey.mjs`
- `scripts/certify-safety-operations-journey.mjs`
- `scripts/certify-release-scale.mjs`
- `tests/finalReleaseCertificationContracts.test.mjs`
- `tests/peekaListingBrandContracts.test.mjs`
- `docs/certification/EXTERNAL_CERTIFICATION_BLOCKERS.md`
- `docs/certification/BRANCH_CLEANUP_LEDGER.md`

The release workflow has three independent jobs:

1. Repository, security, contract, build and PWA gates.
2. Empty-database migration plus complete pgTAP execution.
3. Manually dispatched hosted journeys and bounded scale tests using the protected `staging` environment.

## Brand status

The active navigation lockup, browser metadata, PWA manifest, service-worker caches, push-notification fallbacks and help content now use PeekaListing. The divergent branding PR #7 was closed after controlled reconciliation into PR #32.

## Required evidence before public launch

1. Apply every migration from an empty database and pass the complete pgTAP suite.
2. Pass lint, active typechecking, Edge Function typechecking, all contracts, product audit, production build, service-worker stamping, bundle-secret checks and build budgets.
3. Pass hosted buyer, verified-business, Peek-fulfilment, listing-publication and safety-operations journeys against staging.
4. Confirm real listing images and Peek media upload, process, deliver and expire correctly.
5. Confirm notification delivery for business decisions, Peek requests/results, messages and report actions.
6. Pass search, messaging, Peek and notification scale programs within their repository-defined limits.
7. Configure OAuth, email, Turnstile, Cloudflare resources, domain callbacks and production environment variables.
8. Explicitly reconcile or defer PR #4 real-time messaging and PR #5 contextual camera permissions. Both are currently deferred from Stage 6 and must not be merged wholesale.
9. Delete superseded branches according to the cleanup ledger.

## Known external blockers

- Protected GitHub `staging` environment and Supabase secrets are unavailable to this execution context.
- Hosted browser sessions and real provider delivery cannot be certified here.
- Branch deletion is not exposed through the current GitHub connector.
- Production service limits, backups and provider billing must be reviewed before launch.

## Source-of-truth rule

Only `main` represents the product. Future work must start from the latest `main`, use a narrowly scoped branch and merge through a traceable pull request.
