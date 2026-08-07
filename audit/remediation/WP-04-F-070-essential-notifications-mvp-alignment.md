# F-070 — Align essential notifications with no-review MVP publication

Status: **PARTIAL until clean-database CI passes**

## Failure sequence

Migration Gates run `31151033759` passed the contact-support suite 12/12 and continued through the recommendation-event, public-listing-search and notification-read suites. It then stopped before the TAP plan in `v1_essential_notifications.sql` because the old fixture inserted a listing without an authenticated approved-category publisher and correctly hit `enforce_curated_listing_publisher()` with `Authentication required`.

The same test still certified human `listing_approved` and `listing_rejected` notification flows through `admin_moderate_marketplace_item(...)`. Those assertions are obsolete for the current MVP: migration `20260807030000_remove_listing_content_review_from_mvp.sql` explicitly removed the human listing-review step and auto-publishes validated listings while retaining business-category authorization, reporting, suspension and other post-publication safety controls.

An intermediate repair supplied the approved business/category and matching seller JWT, but Migration Gates run `31151771259` then failed with `42501: permission denied for table listings`. That is also correct: authenticated clients intentionally have no direct `INSERT` privilege on `public.listings`.

The canonical listing certification confirms the supported runtime creation path is service-role upload authorization, validated private storage object, trusted upload completion, then authenticated `create_v1_listing_submission(...)`.

## Repair

- Create an approved business application and approved `car` category for the notification owner.
- Authorize one private listing image through `authorize_listing_image_upload(...)`, materialize the matching storage object in trusted test setup, and complete the upload through `complete_listing_image_upload(...)`.
- Publish through authenticated `create_v1_listing_submission(...)`; capture the generated listing ID in a temporary fixture table.
- Assert the validated approved-category listing auto-publishes to `available` without human listing review.
- Assert the current publication path emits zero `listing_approved` / `listing_rejected` alerts.
- Use the current owner lifecycle RPC to move the listing to `unavailable` and certify the `listing_status_changed` notification.
- Restore the fixture under trusted SQL setup and place expiry two days ahead.
- Call the expiry worker at current time so the due-soon branch and idempotency are genuinely exercised.
- Retain report-resolution, account-status, safe-link, unsupported-marketing, read-state, forgery-denial and cross-user isolation assertions.
- Expect four current owner notifications: one listing status change, one expiry notice and two account-status events.

## Deliberately not done

- Direct authenticated `INSERT` on `public.listings` is not granted.
- Human listing approval/rejection is not restored.
- `admin_moderate_marketplace_item(... publish/reject ...)` is not used to certify the current listing publication journey.
- The curated publisher trigger is not disabled or bypassed.
- Legacy event names are not removed from compatibility schemas in this proof-chain repair.
