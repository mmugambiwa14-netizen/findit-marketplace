# F-072 — Make recommendation projection-queue fixture cross curated publication

Status: **PARTIAL until clean-database CI passes**

## Failure

Migration Gates run `31153272606` passed `v1_recommendation_foundation.sql` 62/62 and then reached `v1_recommendation_projection_queue.sql`. The queue test failed before its TAP plan at the first listing fixture with `42501: Authentication required` from `public.enforce_curated_listing_publisher()`.

The queue test intentionally creates one controlled public Cars listing and then simulates recommendation queue/projection failures. It is not a listing-creation journey, so trusted SQL fixture setup remains appropriate, but it must still satisfy the authoritative curated publisher trigger.

## Repair

- Create an approved business application for the queue fixture owner.
- Give that owner approved `car` category access.
- Set the matching owner JWT while trusted SQL inserts the public Cars listing and its car details.
- Clear fixture JWT context before queue/catalog assertions, then restore the owner context only for the existing browser-owner update test.
- Keep the queue failure, fail-open authoritative listing write, internal-table isolation, dead-letter, stable error-code, retry, recovery, suspension-removal, index and RLS assertions unchanged.
- Correct obsolete commentary that claimed an owner title edit re-queued the listing for human moderation. In the current no-review MVP, `protect_listing_managed_fields()` only protects trusted/system fields. The later trusted update is retained solely to deterministically enqueue the still-public listing after the simulated queue dependency recovers.

## Deliberately not done

- The curated publisher trigger is not disabled or bypassed.
- Direct authenticated listing-write privileges are not broadened.
- Human listing moderation is not restored.
- Recommendation queue, worker, dead-letter, retry, projection or RLS production logic is not changed.
