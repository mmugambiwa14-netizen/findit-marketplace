# F-068 — Make marketplace-view fixtures cross curated publication

Status: **PARTIAL until clean-database CI passes**

## Failure

Migration Gates run `31149721102` passed the seller-profile suite and then stopped in `v1_private_marketplace_view_implementation.sql`. The first seven catalog assertions passed, but the fixture inserted listings and services without an authenticated publisher, so the authoritative curated listing trigger correctly raised `Authentication required`.

## Repair

- Create an approved business application for the marketplace fixture owner.
- Grant that owner approved `property` and `service` category access.
- Set the matching authenticated JWT subject and claims while inserting listing and service fixtures.
- Clear the JWT before anonymous view-count assertions.

## Deliberately not done

- Curated listing or service publisher triggers are not disabled or bypassed.
- No admin shortcut is used.
- View-count authorization or visibility behavior is not weakened.
