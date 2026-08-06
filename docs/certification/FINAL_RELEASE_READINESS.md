# PeekaListing Final Release Readiness

Updated: 2026-08-07
Canonical branch: `main`
Stage 6 working branch: `integration/final-release-certification`

## Release decision

**Repository release candidate: conditionally ready.**

**Public production launch: not yet certified.**

The canonical repository now contains the intended MVP architecture and core journeys, but hosted Supabase, storage, media-processing, notification, browser, performance and provider evidence remains incomplete. The exact external gates are recorded in `docs/certification/EXTERNAL_CERTIFICATION_BLOCKERS.md`.

## Locked MVP boundary

- Listings publish immediately after business-category authorization, payload validation and validated image attachment.
- Peeks publish automatically after successful media-processing validation.
- There is no routine human listing review queue.
- There is no routine human Peek approval queue.
- Verified-business/category decisions remain an administrator-controlled verification flow.
- Reports, suspension, removal, restoration and takedown are post-publication safety controls.

## Core journey status

| Stage | Journey | Repository status | Hosted status |
|---|---|---|---|
| 1 | Search → Peek → notifications → messaging | Implemented | Pending |
| 2 | Business application → category decision → verified profile and inventory | Implemented and repository-certified | Pending |
| 3 | Peek request → seller fulfilment → processing → publication → buyer result | Implemented and repository-certified | Pending |
| 4 | Draft → image upload → immediate listing publication → lifecycle management | Implemented and repository-certified | Pending |
| 5 | Verified-business decisions → reports → takedown/restoration → audit | Implemented and repository-certified | Pending |
| 6 | Clean migration, build/PWA, hosted checks, scale and cleanup | Repository orchestration implemented | Pending workflow execution |

## Final certification assets

- `.github/workflows/release-certification.yml`
- `scripts/certify-final-release.mjs`
- `scripts/certify-release-scale.mjs`
- `artifacts/certification/final-release.json`
- `artifacts/certification/release-scale.json`
- `docs/certification/EXTERNAL_CERTIFICATION_BLOCKERS.md`
- `docs/certification/BRANCH_CLEANUP_LEDGER.md`

The release workflow has three independent jobs:

1. Repository, security, contract, build and PWA gates.
2. Empty-database migration plus complete pgTAP execution.
3. Manually dispatched hosted journeys and bounded scale tests using the protected `staging` environment.

## Required evidence before public launch

1. The clean-database job must apply every migration from an empty database and pass the complete pgTAP suite.
2. The repository job must pass lint, active typechecking, Edge Function typechecking, all contracts, product audit, production build, service-worker stamping, bundle-secret checks and build budgets.
3. Hosted buyer, verified-business, Peek-fulfilment, listing-publication and safety-operations journeys must pass against staging.
4. Real listing images and Peek media must upload, process, deliver and expire correctly.
5. Notification delivery must be confirmed for business decisions, Peek requests/results, messages and report actions.
6. Search, messaging, Peeks and notification scale programs must pass within their repository-defined limits.
7. OAuth, email, Turnstile, Cloudflare resources, domain callbacks and production environment variables must be configured.
8. Remaining unique PRs #4, #5 and #7 must be reconciled or explicitly deferred.
9. Superseded branches must be deleted according to the branch-cleanup ledger.

## Known external blockers

- Protected GitHub `staging` environment and Supabase secrets are not available to this execution context.
- Hosted browser sessions and real provider delivery cannot be certified here.
- Branch deletion is not exposed through the current GitHub connector.
- Paid infrastructure is not required to continue repository work, but production limits and backups must be reviewed before launch.

## Source-of-truth rule

Only `main` represents the product. No feature, integration, preview, release or historical branch may be treated as a second source of truth. Future work must start from the latest `main`, use a narrowly scoped branch and merge through a traceable pull request.
