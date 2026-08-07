# F-067 — Make the public seller-profile fixture cross the curated publishing boundary

Status: **PARTIAL until clean-database CI passes**

## Failure

Migration Gates run `31149324338` passed the country-helper suite and then failed `v1_private_public_seller_profile_implementation.sql` while inserting its listing fixture. The authoritative `enforce_curated_listing_publisher()` trigger correctly raised `Authentication required` because the test inserted listings with no JWT and no approved category state.

## Repair

- Give both listing-owning fixture users approved Property business-category records.
- Set the appropriate authenticated JWT before each listing insert.
- Preserve the suspended seller account state so the test still proves public-profile suppression.
- Clear JWT claims before switching to the anonymous caller assertions.

## Deliberately not done

- The curated publishing trigger was not disabled or bypassed.
- No admin-only insertion shortcut was introduced.
- No listing visibility predicate was weakened.
