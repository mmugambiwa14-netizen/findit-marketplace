# External Certification Blockers

Updated: 2026-08-07

This ledger records certification work that is implemented in the repository but cannot be truthfully marked as passed until an external account, hosted environment, secret, or provider limit is available.

Repository-only work may continue past a recorded external gate. Every affected stage must remain marked pending and may not be represented as hosted-certified or release-complete.

## Stage 1 — Buyer journey

Status: **Implemented; hosted certification pending**

Implemented journey:

`Search → Public Peek catalogue → Listing/Peek integration → Notifications → Messaging`

Repository assets:

- `scripts/certify-buyer-journey.mjs`
- `tests/buyerJourneyCertificationContracts.test.mjs`
- `.github/workflows/buyer-journey-certification.yml`
- expected report: `artifacts/certification/buyer-journey.json`

External requirements preventing hosted execution:

1. A protected GitHub Environment named `staging`.
2. Environment secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Manual dispatch of **Buyer Journey Certification**.

Separate non-blocking provider condition:

- Vercel reported `api-deployments-free-per-day` after more than 100 free-plan deployments.

Release rule:

- Stage 1 remains a launch blocker until the hosted workflow artifact reports `status: passed`.

## Stage 2 — Verified business journey

Status: **Implemented and repository-certified; hosted database/browser certification pending**

Implemented journey:

`Application → category review → approval/rejection → verified profile synchronization → public approved marker → inventory/services → owner notification`

Repository assets:

- `supabase/migrations/20260807010000_connect_business_approval_to_verified_profiles.sql`
- `supabase/migrations/20260807011000_verified_business_profile_bootstrap.sql`
- `supabase/tests/v1_verified_business_journey.sql`
- `tests/verifiedBusinessJourneyContracts.test.mjs`
- `.github/workflows/verified-business-journey-gates.yml`

External evidence still required:

1. Apply all migrations to a clean staging database and run the complete pgTAP suite.
2. Complete browser acceptance with separate applicant, admin and public sessions.
3. Confirm application/category notifications and public approved-state synchronization.

Release rule:

- Pending/rejected verification state and registration evidence must remain absent from the public projection.

## Stage 3 — Peek fulfilment journey

Status: **Implemented and repository-certified; hosted media/database/browser certification pending**

Implemented journey:

`Buyer request → seller accepts or declines → capture/upload → automated processing validation → automatic publication and binding → buyer notification → playback`

Failure and recovery coverage:

`Cancel → retry → processing failure → bounded retry → expiry → successful replacement → completion`

Repository assets:

- `supabase/migrations/20260804193300_auto_publish_successful_peeks.sql`
- `supabase/migrations/20260807020000_peek_request_fulfilment_lifecycle.sql`
- `supabase/migrations/20260807020500_peek_fulfilment_seller_queue.sql`
- `supabase/tests/v1_peek_fulfilment_journey.sql`
- `tests/peekFulfilmentJourneyContracts.test.mjs`
- `.github/workflows/peek-fulfilment-journey-gates.yml`

External evidence still required:

1. Run the complete pgTAP suite on clean staging.
2. Complete browser acceptance with separate buyer and seller sessions.
3. Exercise real storage, processing, retry, automatic publication, binding, notification and playback.

Release rule:

- No human Peek review or approval is part of this MVP.

## Stage 4 — Listing publication journey

Status: **Implemented and repository-certified; hosted database/storage/browser certification pending**

Implemented journey:

`Local resumable draft → validated private image upload → approved business-category check → atomic immediate publication → public search/cards/details → live edit → pause/resume → relist → unavailable/delete`

Repository assets:

- `supabase/migrations/20260807030000_remove_listing_content_review_from_mvp.sql`
- `supabase/rollback/20260807030000_remove_listing_content_review_from_mvp.rollback.sql`
- `supabase/tests/v1_listing_creation_and_media.sql`
- `scripts/certify-listing-publication-journey.mjs`
- `tests/listingPublicationJourneyContracts.test.mjs`
- `.github/workflows/listing-publication-journey-gates.yml`
- expected report: `artifacts/certification/listing-publication-journey.json`

External evidence still required:

1. Run the complete pgTAP suite on clean staging.
2. Exercise real image upload and signed delivery across cards and details.
3. Confirm immediate publication, live edits, pause/resume, relist, unavailable and delete in browser sessions.

Release rule:

- No human listing review or approval is part of this MVP.

## Stage 5 — Safety operations journey

Status: **Implemented and repository-certified; hosted database/browser certification pending**

Implemented journey:

`Verified-business decision → user report → reviewed/dismissed/actioned decision → target-specific takedown or restoration → owner/user notification → immutable audit record`

MVP boundary:

- Verified-business/category decisions remain the only pre-publication approval flow.
- Listings and Peeks are handled only through post-publication reports, suspension, removal, restoration or takedown.
- There is no routine listing or Peek approval queue.

Repository assets:

- `src/pages/admin/AdminReports.jsx`
- `src/services/adminService.js`
- `src/repositories/adminRepository.js`
- `supabase/migrations/0016_v1_admin_operations.sql`
- `supabase/migrations/0019_v1_essential_notifications.sql`
- `supabase/migrations/0039_v1_tour_reporting_and_admin.sql`
- `supabase/tests/v1_admin_operations.sql`
- `supabase/tests/v1_essential_notifications.sql`
- `supabase/tests/v1_verified_business_journey.sql`
- `scripts/certify-safety-operations-journey.mjs`
- `tests/safetyOperationsJourneyContracts.test.mjs`
- `.github/workflows/safety-operations-journey-gates.yml`
- expected report: `artifacts/certification/safety-operations-journey.json`

External evidence still required:

1. Apply all migrations to a clean staging database and run the complete pgTAP suite.
2. Complete browser acceptance with reporter, affected owner/user and admin sessions.
3. Confirm listing, service, Peek and conversation report decisions affect only the intended target.
4. Confirm dismissal/restoration, takedown notifications and audit rows are emitted once.
5. Confirm verified-business approval/rejection remains independent from content-report operations.

Release rule:

- Stage 5 must not be called hosted-certified until report, notification, target-state and audit evidence all pass on staging.
