# Milestone 3 / C — Seller Tours

## Completed boundary

Milestone 3 integrates the dormant Tours backend into the existing seller workflow without creating a separate video-post identity.

Implemented:

- Optional Record, Upload and Skip controls in listing creation.
- Optional Tour upload in eligible non-legal service creation.
- Parent-first publication: the canonical listing or service is created before Tour upload begins.
- Direct private-storage upload with 2-minute and 250 MB source limits.
- Upload progress, interruption recovery, retry and explicit discard controls. Edit-screen recovery keeps the selected local file mounted after status refresh.
- Same-intent renewal after authorization expiry, preserving the original Tour identity, idempotency key and object path.
- Late idempotent completion when the exact private object was accepted before authorization expiry.
- Owner Tour management in listing and service editing: add, replace, remove, retry, processing state and rejection/failure reason. Rejected versions remain visible until explicitly removed.
- Atomic replacement behavior: the current approved public Tour remains active until its replacement is approved.
- Migration `0036_v1_seller_tour_workflow.sql` and targeted rollback.
- Seller workflow contract and Supabase smoke coverage.

## Safety boundary

Tours remain controlled by both:

- `VITE_FEATURE_TOURS`
- the backend `tours` feature state

Public Tour eligibility remains unchanged. A Tour is not public unless it is ready, approved, attached to an eligible public parent and not removed.

Legal services remain excluded. Sold or unavailable parents cannot receive renewed upload authorization.

## Verification

Run the dependency-light gates:

```bash
npm run test:tours-contracts
npm run test:contracts
npm run verify:base44-elimination
```

Run dependency-backed gates after a successful locked install:

```bash
npm ci
npm run lint
npm run typecheck
npm run typecheck:migration
npm run typecheck:active
npm run build
npm run audit:production
```

Run the seller workflow against an explicitly authorized Supabase target:

```bash
npm run test:tours-seller-local
# or
npm run test:tours-seller-hosted
```

The smoke harness uses the same target guard and cleanup discipline as the Milestone 2 Tours harnesses.

## Rollback

1. Disable `VITE_FEATURE_TOURS`.
2. Disable backend Tour writes.
3. Apply `supabase/rollback/0036_v1_seller_tour_workflow.rollback.sql` only after confirming the target.
4. Preserve existing Tour rows and media for investigation and controlled cleanup.

The rollback restores the Milestone 2 listing eligibility and upload-completion expiry boundaries. It does not delete Tour data.


## Packaging verification limit

The implementation and dependency-light gates are complete: 45/45 Tour contracts, 140/140 repository contracts, Base44 elimination, environment validation, JSON/YAML parsing, secret hygiene, and static transpilation/import resolution across 276 modules pass. In the packaging environment, the configured internal npm registry returned HTTP 503 and a direct public-registry retry failed with DNS `EAI_AGAIN`, so a fresh locked install, lint, project typechecks, production build and dependency audit could not be rerun. Supabase pgTAP/API smoke also requires an explicitly authorized local or staging target. These are release-acceptance gates, not omitted implementation work.
