import { servePublicRecommendationServices } from "../_shared/recommendation-service.ts";

// Serves similar_listings, seller_recommendations, related_services,
// related_products, nearby and recently_listed. The service name arrives in the
// request body and is validated against the public allowlist in the shared
// runtime.
//
// personalized_recommendation_service is NOT served here -- it keeps its own
// function so the gateway's verify_jwt check still runs.
servePublicRecommendationServices();
