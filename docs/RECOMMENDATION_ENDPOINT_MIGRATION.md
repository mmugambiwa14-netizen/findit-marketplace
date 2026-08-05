# Recommendation endpoint consolidation

Six Edge Functions were retired and replaced by one. This note records what
changed, why the seventh service was left alone, and the order the rollout has
to happen in.

## What changed

`similar-listings`, `seller-recommendations`, `related-services`,
`related-products`, `nearby-listings` and `recently-listed` were six Edge
Functions whose entry points were three lines each and differed only in the
constant they passed to `_shared/recommendation-service.ts`:

```ts
import { serveRecommendationService } from "../_shared/recommendation-service.ts";
serveRecommendationService("similar_listings_service");
```

Six deployment units, six `[functions.*]` config entries and six independent
cold starts served one code path. They are now one function,
`supabase/functions/recommendations`, and the service arrives in the request
body:

```jsonc
POST /functions/v1/recommendations
{ "service": "similar_listings_service", "subjectListingId": "...", "limit": 12, "cursor": null }
```

## What deliberately did not change

`personalized-recommendations` keeps its own Edge Function.

It is the only recommendation service that requires a signed-in viewer, and it
is the only one with `verify_jwt = true`. Folding it into the multiplexed
endpoint would have forced that endpoint to `verify_jwt = false` — public
services are called with an opaque `sb_publishable_*` key, which is not a JWT —
and an unauthenticated caller would then reach function code and a database
policy lookup before being rejected. The in-function
`authenticationRequired` check would still deny it, but a layer that costs
nothing to keep would have been traded away for one fewer deployment unit.

The shared runtime enforces this structurally: `PUBLIC_SERVICES` omits
`personalized_recommendation_service`, and `servePublicRecommendationServices`
rejects anything outside that allowlist with `unknown_service`. A contract test
asserts the omission, so restoring it would fail CI rather than quietly widen
the endpoint.

## Rollout order

The browser selects the endpoint, so functions must exist before the frontend
that calls them.

1. **Deploy `recommendations`.** `supabase functions deploy recommendations`.
   Nothing calls it yet.
2. **Deploy the frontend.** From this point browsers post to
   `/functions/v1/recommendations` with a `service` field.
3. **Confirm traffic has moved.** The old function logs should go quiet.
4. **Delete the six retired functions** from the Supabase project:
   `supabase functions delete similar-listings` (and the other five).

Steps 1 and 2 must not be reversed: a frontend deployed before the function
exists would get a 404 from every recommendation surface. The failure is
contained — `recommendationServices.js` returns a degraded empty result rather
than throwing, so the strips render empty instead of breaking the page — but it
is still a visible regression.

Rolling back is the same sequence in reverse: redeploy the previous frontend
first, then remove `recommendations`. The six retired functions must still exist
in the project for a rollback to work, which is why deleting them is step 4 and
not step 1.

## Unchanged

- Database RPCs, runtime policy rows, cache tables and the request-budget
  function are all untouched. The collapse is entirely at the HTTP boundary.
- `recommendation-maintenance`, `recommendation-service-health`,
  `contextual-ecosystem` and `contextual-ecosystem-health` keep their own
  functions. They have different auth models (worker secrets, not browser
  credentials) and different blast radii; merging them would be consolidation
  for its own sake.

## Verification

- `npm run test:recommendation-contracts` — endpoint, config and allowlist contracts.
- `npm run test:behaviour` — `tests/behaviour/recommendationDispatch.test.js`
  drives the real client module and asserts every public service reaches
  `recommendations` with the right dispatch field, that personalized does not,
  and that an unknown service never reaches the network.
- `npm run test:recommendation-services-hosted` — hosted smoke against staging.
