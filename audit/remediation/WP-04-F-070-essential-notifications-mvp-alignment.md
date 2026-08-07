# F-070 — Align essential notifications with no-review MVP publication

Status: **PARTIAL until clean-database CI passes**

## Failure

Migration Gates run `31151033759` passed the contact-support suite 12/12 and continued through the recommendation-event, public-listing-search and notification-read suites. It then stopped before the TAP plan in `v1_essential_notifications.sql` because the old fixture inserted a listing without an authenticated approved-category publisher and correctly hit `enforce_curated_listing_publisher()` with `Authentication required`.

The same test still certified human `listing_approved` and `listing_rejected` notification flows through `admin_moderate_marketplace_item(...)`. Those assertions are obsolete for the current MVP: migration `20260807030000_remove_listing_content_review_from_mvp.sql` explicitly removed the human listing-review step and auto-publishes validated listings while retaining business-category authorization, reporting, suspension and other post-publication safety controls.

The legacy notification event names can remain for compatibility; this repair does not certify them as part of the current listing journey.

## Repair

- Create an approved business application and approved `car` category for the notification owner.
- Publish the fixture as that authenticated seller with input status `pending_review`; assert the MVP auto-publication trigger produces `available`.
- Assert the current publication path emits zero `listing_approved` / `listing_rejected` alerts.
- Use the current owner lifecycle RPC to move the listing to `unavailable` and certify the `listing_status_changed` notification.
- Restore the fixture under trusted SQL setup and place expiry two days ahead.
- Call the expiry worker at current time, not 28 days in the future, so the due-soon branch is actually exercised and its idempotency is proven.
- Retain report-resolution, account-status, safe-link, unsupported-marketing, read-state, forgery-denial and cross-user isolation assertions.
- Update the expected owner notification count from five obsolete-review-era events to four current events: one listing status change, one expiry notice, and two account-status events.

## Deliberately not done

- Human listing approval/rejection is not restored.
- `admin_moderate_marketplace_item(... publish/reject ...)` is not used to certify the current listing publication journey.
- The curated publisher trigger is not disabled or bypassed.
- Legacy event names are not removed from compatibility schemas in this proof-chain repair.
