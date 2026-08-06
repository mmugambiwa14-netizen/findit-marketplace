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
2. Environment secrets:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Manual dispatch of **Buyer Journey Certification**.

Separate non-blocking provider condition:

- Vercel reported `api-deployments-free-per-day` after more than 100 free-plan deployments. This blocks another preview deployment until the limit resets or the plan changes, but it does not invalidate the repository certification runner.

Release rule:

- Stage 1 must not be called hosted-certified until the workflow completes successfully and its JSON artifact reports `status: passed`.
- This item remains a launch blocker until that evidence exists.

## Stage 2 — Verified business journey

Status: **Implemented and repository-certified; hosted database/browser certification pending**

Implemented journey:

`Application → category review → approval/rejection → verified profile synchronization → public approved marker → inventory/services → owner notification`

Repository assets:

- existing curated application and admin-review system
- `supabase/migrations/20260807010000_connect_business_approval_to_verified_profiles.sql`
- `supabase/migrations/20260807011000_verified_business_profile_bootstrap.sql`
- `supabase/tests/v1_verified_business_journey.sql`
- `tests/verifiedBusinessJourneyContracts.test.mjs`
- `.github/workflows/verified-business-journey-gates.yml`

External evidence still required:

1. Apply all migrations to a clean staging database.
2. Run `supabase/tests/v1_verified_business_journey.sql` and the complete pgTAP suite.
3. Complete browser acceptance with separate applicant, admin and public sessions.
4. Confirm existing business application/category notifications arrive in the hosted notification center.
5. Confirm public profiles show the approved marker only after an approved category and remove it after the final approved category is suspended.

Release rule:

- Stage 2 must not be called hosted-certified until the clean migration, pgTAP and browser matrix pass on staging.
- Pending/rejected moderation state and registration evidence must remain absent from the public projection.

## Stage 3 — Peek fulfilment journey

Status: **Implemented and repository-certified; hosted media/database/browser certification pending**

Implemented journey:

`Buyer request → seller accepts or declines → capture/upload → processing/moderation → automatic binding → buyer notification → playback`

Failure and recovery coverage:

`Cancel → retry → processing failure → bounded retry → expiry → successful replacement → completion`

Repository assets:

- existing Response Peek upload, processing, moderation, binding, notification and playback pipeline
- `supabase/migrations/20260807020000_peek_request_fulfilment_lifecycle.sql`
- `supabase/migrations/20260807020500_peek_fulfilment_seller_queue.sql`
- `supabase/tests/v1_peek_fulfilment_journey.sql`
- `tests/peekFulfilmentJourneyContracts.test.mjs`
- `.github/workflows/peek-fulfilment-journey-gates.yml`

External evidence still required:

1. Apply all migrations to a clean staging database and run the complete pgTAP suite.
2. Complete browser acceptance with separate buyer and seller sessions.
3. Upload a real Response Peek through storage and confirm processing and moderation transitions persist in the seller queue.
4. Force one processing failure, retry with a replacement upload and confirm the abandoned binding intent cannot answer the request.
5. Confirm successful approval answers the request once, notifies the requester and supporters once, and opens playable evidence.
6. Run the expiry operation under the hosted service role and confirm stale fulfilments remain recoverable without closing the buyer request.

Release rule:

- Stage 3 must not be called hosted-certified until database, object-storage, processor, moderation, notification and playback evidence all pass on staging.
- A request must remain pending until an approved published Response Peek is atomically bound.

## Stage 4 — Listing publication journey

Status: **Implemented and repository-certified; hosted database/storage/browser certification pending**

Implemented journey:

`Local resumable draft → validated private image upload → category-specific validation → atomic submission → moderation publication → public search/cards/details → edit → pause/resume → relist → unavailable/delete`

Repository assets:

- existing listing creation, media-intent, moderation and owner-management implementation
- `supabase/migrations/0021_v1_listing_creation_and_media.sql`
- `supabase/tests/v1_listing_creation_and_media.sql`
- `scripts/phase4-listing-creation-smoke-local.mjs`
- `scripts/certify-listing-publication-journey.mjs`
- `tests/listingPublicationJourneyContracts.test.mjs`
- `.github/workflows/listing-publication-journey-gates.yml`
- expected report: `artifacts/certification/listing-publication-journey.json`

External evidence still required:

1. Apply all migrations to a clean staging database and run the complete pgTAP suite.
2. Run the listing publication certification workflow with staging Supabase credentials.
3. Upload real JPEG, PNG, WebP and phone-origin images and confirm private signed delivery on cards and detail pages.
4. Complete browser acceptance with seller, moderator and public sessions.
5. Confirm pending and rejected listings never appear publicly; approved listings appear in search, cards and details.
6. Confirm editing a live listing returns it to moderation and removes it from public discovery until approved again.
7. Confirm pause, resume, relist, unavailable and delete transitions update public discovery and media access consistently.

Release rule:

- Stage 4 must not be called hosted-certified until database, storage, moderation, search, cards, details and owner-management evidence all pass on staging.
- “Submit” must never be represented as publicly live before moderation changes the canonical status to `available`.
