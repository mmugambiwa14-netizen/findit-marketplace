import { useEffect, useId, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Compass, History, MapPinned, RefreshCw, Sparkles, Store, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ListingCard from '@/components/listings/ListingCard';
import ServiceCard from '@/components/services/ServiceCard';
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
import { getRecommendationPersonalizationPreference } from '@/services/recommendationPersonalizationService';
import { getPublicServicesByIds } from '@/services/servicesService';
import { useAuth } from '@/lib/AuthContext';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

const MAX_SECTIONS = 4;
const MAX_ITEMS_PER_SECTION = 6;
const MAX_TOTAL_ITEMS = 18;

const SERVICE_DEFINITIONS = Object.freeze({
  similar_listings_service: { title: 'Similar listings', description: 'Comparable options worth checking.', icon: Compass, load: getSimilarListings },
  seller_recommendations_service: { title: 'More from this seller', description: 'Other active listings from the same seller.', icon: Store, load: getSellerRecommendations },
  related_services_service: { title: 'Useful services', description: 'Providers related to this listing.', icon: Wrench, load: getRelatedServices },
  related_products_service: { title: 'You may also need', description: 'Listings that complement this item.', icon: Sparkles, load: getRelatedProducts },
  nearby_service: { title: 'Nearby options', description: 'Available listings around the same area.', icon: MapPinned, load: getNearbyListings },
  recently_listed_service: { title: 'Fresh listings', description: 'Recently published across PeekaListing.', icon: History, load: getRecentlyListed },
  personalized_recommendation_service: { title: 'Picked for you', description: 'Shaped by your optional recommendation preference.', icon: Sparkles, load: getPersonalizedRecommendations },
});

const FALLBACK_PLAN = Object.freeze([
  { contextKey: 'fallback:similar', maximumItems: 6, reasonCode: 'similar_listing', service: 'similar_listings_service' },
  { contextKey: 'fallback:nearby', maximumItems: 6, reasonCode: 'nearby_listing', service: 'nearby_service' },
  { contextKey: 'fallback:recent', maximumItems: 6, reasonCode: 'recently_listed', service: 'recently_listed_service' },
]);

async function loadListingRecommendations(subjectListingId, signal, includePersonalized) {
  const plan = await fetchContextualEcosystemPlan({
    subjectListingId,
    maxSections: MAX_SECTIONS,
    signal,
  });
  if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
  const contextualSections = plan.sections
    .filter((section) => SERVICE_DEFINITIONS[section.service])
    .filter((section) => section.service !== 'personalized_recommendation_service');
  const baseSections = contextualSections.length > 0 ? contextualSections : FALLBACK_PLAN;
  const plannedSections = includePersonalized
    ? [
      ...baseSections.slice(0, MAX_SECTIONS - 1),
      {
        contextKey: 'viewer:personalized',
        maximumItems: MAX_ITEMS_PER_SECTION,
        reasonCode: 'explicit_personalization_consent',
        service: 'personalized_recommendation_service',
      },
    ]
    : baseSections.slice(0, MAX_SECTIONS);
  if (plannedSections.length === 0) return { sections: [] };

  const settledResponses = await Promise.allSettled(plannedSections.map(async (section) => {
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

  const responses = settledResponses.map((response, index) => {
    if (response.status === 'fulfilled') return response.value;
    const section = plannedSections[index];
    return {
      definition: SERVICE_DEFINITIONS[section.service],
      result: {
        degraded: true,
        items: [],
        reason: 'transport_unavailable',
        requestId: null,
      },
      section,
    };
  });
  const visibleResponses = responses.filter(({ result, section }) => !(
    section.service === 'personalized_recommendation_service'
    && ['service_disabled', 'personalization_not_enabled'].includes(result.reason)
  ));

  const listingIds = [];
  const serviceIds = [];
  const seenListings = new Set([subjectListingId]);
  const seenServices = new Set();
  for (const { result } of visibleResponses) {
    for (const item of result.items) {
      if (item.entityType === 'service') {
        if (seenServices.has(item.serviceId)) continue;
        seenServices.add(item.serviceId);
        serviceIds.push(item.serviceId);
      } else {
        if (seenListings.has(item.listingId)) continue;
        seenListings.add(item.listingId);
        listingIds.push(item.listingId);
      }
      if (listingIds.length + serviceIds.length === MAX_TOTAL_ITEMS) break;
    }
    if (listingIds.length + serviceIds.length === MAX_TOTAL_ITEMS) break;
  }

  const [listingHydration, serviceHydration] = await Promise.allSettled([
    getPublicListingsByIds(listingIds, { signal }),
    getPublicServicesByIds(serviceIds, { signal }),
  ]);
  if (signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
  const listings = listingHydration.status === 'fulfilled' ? listingHydration.value : [];
  const services = serviceHydration.status === 'fulfilled' ? serviceHydration.value : [];
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const serviceById = new Map(services.map((service) => [service.id, service]));

  return {
    sections: visibleResponses.map(({ definition, result, section }) => ({
      contextKey: section.contextKey,
      reasonCode: section.reasonCode,
      requestId: result.requestId,
      service: section.service,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      unavailable: (result.degraded && result.items.length === 0)
        || (section.service === 'related_services_service'
          ? serviceHydration.status === 'rejected'
          : listingHydration.status === 'rejected'),
      items: result.items
        .map((item) => {
          if (item.entityType === 'service') {
            const serviceItem = serviceById.get(item.serviceId);
            return serviceItem ? {
              entityType: 'service',
              service: serviceItem,
              reasonCode: item.reasonCode,
            } : null;
          }
          const listing = listingById.get(item.listingId);
          return listing ? {
            entityType: 'listing',
            listing,
            reasonCode: item.reasonCode,
          } : null;
        })
        .filter(Boolean),
    })),
  };
}

function queueImpressions(section) {
  section.items.forEach((item, position) => {
    const listing = item.entityType === 'listing' ? item.listing : null;
    const service = item.entityType === 'service' ? item.service : null;
    queueRecommendationEvent({
      eventType: 'recommendation_impression',
      listingId: listing?.id,
      serviceItemId: service?.id,
      sellerId: listing?.seller_id ?? service?.provider_id,
      recommendationRequestId: section.requestId,
      recommendationService: section.service,
      reasonCode: item.reasonCode,
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

function RecommendationSection({ section }) {
  const headingId = useId();
  const sectionRef = useRef(null);
  const impressionKeyRef = useRef(null);
  const SectionIcon = section.icon || Sparkles;

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

  const trackClick = (item, position) => {
    const listing = item.entityType === 'listing' ? item.listing : null;
    const service = item.entityType === 'service' ? item.service : null;
    queueRecommendationEvent({
      eventType: 'recommendation_click',
      listingId: listing?.id,
      serviceItemId: service?.id,
      sellerId: listing?.seller_id ?? service?.provider_id,
      recommendationRequestId: section.requestId,
      recommendationService: section.service,
      reasonCode: item.reasonCode,
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
      <div className="mb-3 flex items-center gap-2.5">
        <span className="locked-icon-tile h-9 w-9"><SectionIcon className="h-4 w-4" /></span>
        <div className="min-w-0">
          <h3 id={headingId} className="text-sm font-extrabold tracking-tight">{section.title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{section.description}</p>
        </div>
      </div>
      {section.items.length > 0 ? (
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 sm:mx-0 sm:px-0" aria-label={`${section.title} suggestions`}>
          {section.items.map((item, position) => (
            item.entityType === 'service' ? (
              <ServiceCard
                key={`service:${item.service.id}`}
                service={item.service}
                layout="recommendation"
                onOpen={() => trackClick(item, position)}
              />
            ) : (
              <ListingCard
                key={`listing:${item.listing.id}`}
                listing={item.listing}
                type={item.listing._type}
                layout="recommendation"
                className="w-[12.75rem] shrink-0 sm:w-[14.5rem]"
                onOpen={() => trackClick(item, position)}
              />
            )
          ))}
        </div>
      ) : null}
    </section>
  );
}

function RecommendationLoading() {
  return (
    <SkeletonRegion className="no-scrollbar -mx-4 flex gap-3 overflow-hidden px-4 pb-2 sm:mx-0 sm:px-0" label="Loading suggestions">
      {[1, 2, 3].map((item) => (
        <div key={item} className="w-[12.75rem] shrink-0 overflow-hidden rounded-2xl border border-border bg-card sm:w-[14.5rem]">
          <Skeleton className="aspect-[4/3] rounded-none" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-7 w-full" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

export default function ListingRecommendations({ subjectListingId }) {
  const { user } = useAuth();
  const personalization = useQuery({
    queryKey: ['recommendation-personalization', user?.id],
    queryFn: getRecommendationPersonalizationPreference,
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    retry: false,
  });
  const includePersonalized = personalization.data?.enabled === true;
  const query = useQuery({
    queryKey: ['listing-recommendations', subjectListingId, includePersonalized],
    queryFn: ({ signal }) => loadListingRecommendations(subjectListingId, signal, includePersonalized),
    enabled: Boolean(subjectListingId),
    staleTime: 30_000,
    retry: false,
  });
  const resolvedSections = query.data?.sections || [];
  const availableSections = resolvedSections.filter((section) => !section.unavailable && section.items.length > 0);
  const unavailableSections = resolvedSections.filter((section) => section.unavailable);
  const allUnavailable = unavailableSections.length > 0 && availableSections.length === 0;

  return (
    <section className="border-t border-border/70 py-5" aria-labelledby="listing-recommendations-heading">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="findit-overline">Keep comparing</p>
          <h2 id="listing-recommendations-heading" className="mt-0.5 text-lg font-extrabold">More to explore</h2>
          <p className="mt-1 text-xs text-muted-foreground">Independent suggestions—this listing always loads first.</p>
        </div>
        {query.isFetching && !query.isLoading && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Refreshing</span>
        )}
      </div>

      {query.isLoading ? (
        <RecommendationLoading />
      ) : query.isError || allUnavailable ? (
        <div className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-border bg-card px-3.5 py-3" role="alert">
          <div className="flex min-w-0 items-center gap-3"><span className="locked-icon-tile h-10 w-10"><Compass className="h-4 w-4" /></span><div><p className="text-sm font-bold">Suggestions are taking a break</p><p className="mt-0.5 text-xs text-muted-foreground">The listing above is still fully available.</p></div></div>
          <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : availableSections.length === 0 ? (
        <div className="clay-soft flex min-h-20 items-center gap-3 rounded-xl p-3.5">
          <History className="h-5 w-5 shrink-0 text-primary" />
          <div><p className="text-sm font-bold">Fresh matches are still being added</p><p className="mt-0.5 text-xs text-muted-foreground">Check back as new listings are published.</p></div>
        </div>
      ) : (
        <div className="space-y-7">
          {availableSections.map((section) => (
            <RecommendationSection
              key={`${section.contextKey}:${section.service}`}
              section={section}
            />
          ))}
          {unavailableSections.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 px-3 py-2" role="status">
              <p className="text-xs text-muted-foreground">Some suggestions are temporarily unavailable.</p>
              <Button type="button" size="sm" variant="ghost" className="h-9 shrink-0 px-2.5" onClick={() => query.refetch()}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
