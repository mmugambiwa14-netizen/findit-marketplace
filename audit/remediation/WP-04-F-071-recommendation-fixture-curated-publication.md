# F-071 — Make recommendation-foundation fixtures cross curated publication

Status: **PARTIAL until clean-database CI passes**

## Failure

Migration Gates run `31152533443` passed `v1_essential_notifications.sql` 24/24 and then reached `v1_recommendation_foundation.sql`. The test failed before its TAP plan at the first `public.listings` fixture with `42501: Authentication required` from `public.enforce_curated_listing_publisher()`.

The recommendation test intentionally creates three controlled listing states for projection eligibility:

- one public, unsuspended Cars listing;
- one draft Cars listing that must not project; and
- one content-suspended Cars listing that must not project.

The curated publisher trigger now runs on every listing insert, including draft fixture rows, so unauthenticated historical test setup is no longer valid.

## Repair

- Create an approved business application for the recommendation owner.
- Give that owner approved `car` category access.
- Set the matching owner JWT while trusted SQL inserts all three controlled listing states.
- Clear the JWT immediately after listing fixture creation so later recommendation authorization assertions are not contaminated by fixture identity.
- Keep the existing recommendation projection, event privacy, configuration audit, worker and RLS assertions unchanged.

## Deliberately not done

- The curated publisher trigger is not disabled or bypassed.
- Direct authenticated listing-write privileges are not granted.
- No listing moderation flow is restored.
- No recommendation production function, ranking behavior, event boundary or RLS policy is changed.
