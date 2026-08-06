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
