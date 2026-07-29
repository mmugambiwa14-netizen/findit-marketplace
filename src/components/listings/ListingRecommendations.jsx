import { useEffect, useId, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ListingCard from '@/components/listings/ListingCard';
import { fetchContextualEcosystemPlan } from '@/services/contextualEcosystemService';
import { queueRecommendationEvent } from '@/services/recommendationEventsService';
import {
  getNearbyListings,
  getPersonalizedRecommendations,
  getRecentlyListed,
  getRelatedProducts,
  getRelatedServices,
  getSellerRecommendations,
  getSimilarListings,
} from '@/services/recommendationServices';
import { getPublicListingsByIds } from '@/services/publicListingsService';

const MAX_SECTIONS = 6;
const MAX_ITEMS_PER_SECTION = 6;
const MAX_TOTAL_ITEMS = 24;

const SERVICE_DEFINITIONS = Object.freeze({
  similar_listings_service: { title: 'Similar listings', load: getSimilarListings },
  seller_recommendations_service: { title: 'More from this seller', load: getSellerRecommendations },
  related_services_service: { title: 'Related services', load: getRelatedServices },
  related_products_service: { title: 'Related products', load: getRelatedProducts },
  nearby_service: { title: 'Nearby', load: getNearbyListings },
  recently_listed_service: { title: 'Recently listed', load: getRecentlyListed },
  personalized_recommendation_service: { title: 'Picked for you', load: getPersonalizedRecommendations },
});

async function loadListingRecommendations(subjectListingId, signal) {
  const plan = await fetchContextualEcosystemPlan({
    subjectListingId,
    maxSections: MAX_SECTIONS,
    signal,
  });
  if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
  if (plan.degraded && plan.sections.length === 0) {
    throw new Error('Recommendation plan unavailable');
  }

  const plannedSections = plan.sections
    .filter((section) => SERVICE_DEFINITIONS[section.service])
    .slice(0, MAX_SECTIONS);
  if (plannedSections.length === 0) return { sections: [] };

  const responses = await Promise.all(plannedSections.map(async (section) => {
    const definition = SERVICE_DEFINITIONS[section.service];
    const limit = Math.min(section.maximumItems, MAX_ITEMS_PER_SECTION);
    const result = await definition.load({
      subjectListingId,
      limit,
      signal,
    });
    return { definition, result, section };
  }));
  if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');

  const listingIds = [];
  const seen = new Set([subjectListingId]);
  for (const { result } of responses) {
    for (const item of result.items) {
      if (seen.has(item.listingId)) continue;
      seen.add(item.listingId);
      listingIds.push(item.listingId);
      if (listingIds.length === MAX_TOTAL_ITEMS) break;
    }
    if (listingIds.length === MAX_TOTAL_ITEMS) break;
  }

  const listings = await getPublicListingsByIds(listingIds, { signal });
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));

  return {
    sections: responses.map(({ definition, result, section }) => ({
      contextKey: section.contextKey,
      reasonCode: section.reasonCode,
      requestId: result.requestId,
      service: section.service,
      title: definition.title,
      unavailable: result.degraded && result.items.length === 0,
      items: result.items
        .map((item) => {
          const listing = listingById.get(item.listingId);
          return listing ? { listing, reasonCode: item.reasonCode } : null;
        })
        .filter(Boolean),
    })),
  };
}

function queueImpressions(section) {
  section.items.forEach(({ listing, reasonCode }, position) => {
    queueRecommendationEvent({
      eventType: 'recommendation_impression',
      listingId: listing.id,
      sellerId: listing.seller_id,
      recommendationRequestId: section.requestId,
      recommendationService: section.service,
      reasonCode,
      context: {
        source: section.contextKey,
        surface: 'listing_detail',
        position,
        page_size: section.items.length,
        result_count: section.items.length,
      },
    });
  });
}

function RecommendationSection({ section, onRetry }) {
  const headingId = useId();
  const sectionRef = useRef(null);
  const impressionKeyRef = useRef(null);

  useEffect(() => {
    if (section.items.length === 0) return undefined;
    const key = `${section.requestId ?? 'none'}:${section.service}`;
    const record = () => {
      if (impressionKeyRef.current === key) return;
      impressionKeyRef.current = key;
      queueImpressions(section);
    };
    if (typeof IntersectionObserver !== 'function') {
      record();
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        record();
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [section]);

  const trackClick = ({ listing, reasonCode }, position) => {
    queueRecommendationEvent({
      eventType: 'recommendation_click',
      listingId: listing.id,
      sellerId: listing.seller_id,
      recommendationRequestId: section.requestId,
      recommendationService: section.service,
      reasonCode,
      context: {
        source: section.contextKey,
        surface: 'listing_detail',
        position,
        page_size: section.items.length,
        result_count: section.items.length,
      },
    });
  };

  return (
    <section ref={sectionRef} aria-labelledby={headingId}>
      <h3 id={headingId} className="mb-3 text-base font-semibold">
        {section.title}
      </h3>
      {section.unavailable ? (
        <div className="flex min-h-24 items-center justify-between gap-4 border-y border-border py-4" role="status">
          <p className="text-sm text-muted-foreground">Suggestions are temporarily unavailable.</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : section.items.length === 0 ? (
        <p className="border-y border-border py-5 text-sm text-muted-foreground">No suggestions are available right now.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {section.items.map((item, position) => (
            <ListingCard
              key={item.listing.id}
              listing={item.listing}
              type={item.listing._type}
              onOpen={() => trackClick(item, position)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RecommendationLoading() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3" role="status" aria-label="Loading suggestions">
      {[1, 2, 3].map((item) => (
        <div key={item} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="aspect-[4/3] animate-pulse bg-surface-raised" />
          <div className="space-y-2 p-3">
            <div className="h-4 w-4/5 animate-pulse rounded bg-surface-raised" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-surface-raised" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ListingRecommendations({ subjectListingId }) {
  const query = useQuery({
    queryKey: ['listing-recommendations', subjectListingId],
    queryFn: ({ signal }) => loadListingRecommendations(subjectListingId, signal),
    enabled: Boolean(subjectListingId),
    staleTime: 30_000,
    retry: false,
  });

  return (
    <section className="border-y border-border py-6" aria-labelledby="listing-recommendations-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="listing-recommendations-heading" className="text-lg font-semibold">More to explore</h2>
        {query.isFetching && !query.isLoading && (
          <span className="text-xs text-muted-foreground" role="status">Refreshing</span>
        )}
      </div>

      {query.isLoading ? (
        <RecommendationLoading />
      ) : query.isError ? (
        <div className="flex min-h-24 items-center justify-between gap-4" role="alert">
          <p className="text-sm text-muted-foreground">Suggestions could not be loaded.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : query.data.sections.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No suggestions are available right now.</p>
      ) : (
        <div className="space-y-7">
          {query.data.sections.map((section) => (
            <RecommendationSection
              key={`${section.contextKey}:${section.service}`}
              section={section}
              onRetry={() => query.refetch()}
            />
          ))}
        </div>
      )}
    </section>
  );
}
