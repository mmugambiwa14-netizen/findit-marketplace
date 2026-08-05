// Maps a recommendation service to the Edge Function that serves it.
//
// The six unauthenticated services used to be six Edge Functions whose entry
// points differed only in the constant they passed to the shared runtime. They
// now share supabase/functions/recommendations and select themselves through a
// `service` field in the request body.
//
// Certification and smoke scripts still address services by their historical
// path so their call sites stay readable; this module translates that path into
// the endpoint to POST to and the body field to send.

const PUBLIC_ENDPOINT = 'recommendations';

/** Historical per-service path -> { endpoint, service } */
const SERVICE_ROUTES = Object.freeze({
  'similar-listings': { endpoint: PUBLIC_ENDPOINT, service: 'similar_listings_service' },
  'seller-recommendations': { endpoint: PUBLIC_ENDPOINT, service: 'seller_recommendations_service' },
  'related-services': { endpoint: PUBLIC_ENDPOINT, service: 'related_services_service' },
  'related-products': { endpoint: PUBLIC_ENDPOINT, service: 'related_products_service' },
  'nearby-listings': { endpoint: PUBLIC_ENDPOINT, service: 'nearby_service' },
  'recently-listed': { endpoint: PUBLIC_ENDPOINT, service: 'recently_listed_service' },
  // Keeps its own function so the gateway's verify_jwt check still runs.
  'personalized-recommendations': {
    endpoint: 'personalized-recommendations',
    service: 'personalized_recommendation_service',
  },
});

export const RECOMMENDATION_SERVICE_PATHS = Object.freeze(Object.keys(SERVICE_ROUTES));
export const PUBLIC_RECOMMENDATIONS_ENDPOINT = PUBLIC_ENDPOINT;

/**
 * Resolve a service path to the endpoint that serves it.
 *
 * Paths that are not recommendation services (health, maintenance, contextual)
 * pass through unchanged so a caller can mix them freely.
 */
export function resolveRecommendationRoute(path) {
  return SERVICE_ROUTES[path] ?? { endpoint: path, service: null };
}

/** Add the dispatch field when the target is the multiplexed endpoint. */
export function withServiceField(path, body) {
  const { service } = resolveRecommendationRoute(path);
  return service ? { service, ...body } : body;
}
