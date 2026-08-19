import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Briefcase, Clock3, Globe2, MapPin, Route } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { GuestPromptSheet } from "@/components/auth/GuestPromptSheet";
import ContactButtons from "@/components/listings/ContactButtons";
import ListingDetailActions from "@/components/listings/ListingDetailActions";
import ListingFeatureItem from "@/components/listings/ListingFeatureItem";
import ListingMediaActions from "@/components/listings/ListingMediaActions";
import ListingMediaViewer from "@/components/listings/ListingMediaViewer";
import ListingSummary from "@/components/listings/ListingSummary";
import PeekThreadsSection from "@/components/peekThreads/PeekThreadsSection";
import PeekRequestIntentHandler from "@/components/peekThreads/PeekRequestIntentHandler";
import {
  ListingDescription,
  ListingDetailTabs,
  ListingLocation,
  ListingSeller,
  ListingTabSection,
} from "@/components/listings/ListingDetailTabs";
import { ContactBar, DetailError, DetailLoading, DetailMissing, SafetyPanel } from "@/components/listings/ListingDetailLayout";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useServiceFavourite } from "@/hooks/useServiceFavourite";
import { useMarketplaceView } from "@/hooks/useMarketplaceView";
import { useAuth } from "@/lib/AuthContext";
import { useCurrency } from "@/lib/CurrencyContext";
import { goBackOrHome } from "@/lib/navigation";
import { createListingSharePayload } from "@/lib/share";
import { applyListingDocumentMetadata } from "@/lib/documentMetadata";
import { getPublicService } from "@/services/servicesService";

export default function ServiceDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { guestOpen, guestAction, guard, closeGuest } = useGuestGuard();
  const serviceFavourite = useServiceFavourite({ userId: user?.id, serviceId: id, queryClient, guard });

  const { data: service, isLoading, error, refetch } = useQuery({
    queryKey: ["service", id],
    queryFn: () => getPublicService(id),
    enabled: Boolean(id),
  });
  useMarketplaceView("service", id, "service", Boolean(service));

  useEffect(() => {
    if (!service) return;
    applyListingDocumentMetadata({ title: service.title, description: service.description, imageUrl: service.photos?.[0], path: `/service/${service.id}` });
  }, [service]);

  if (isLoading) return <DetailLoading fallback="/services" />;
  if (error) return <DetailError label="Service" fallback="/services" onRetry={refetch} />;
  if (!service) return <DetailMissing label="Service" />;

  const categoryLabel = service.category_label || "Service";
  const subcategoryLabels = service.subcategory_labels?.length
    ? service.subcategory_labels
    : (service.subcategory_label ? [service.subcategory_label] : []);
  const quoteOnly = service.pricing_type === "quote" || service.price == null;
  const priceDisplay = quoteOnly
    ? "Contact for quote"
    : `${format(service.price)}${service.pricing_type === "hourly" ? "/hr" : ""}`;
  const pricePrefix = !quoteOnly && service.pricing_type === "starting_from" ? "From" : null;
  const attributeValues = service.attributes?.values || {};
  const deliveryLabel = {
    fixed_and_mobile: "Fixed base and mobile service",
    travels_to_customer: "Travels to customers",
    fixed_location: "Fixed location",
    remote: "Remote service",
  }[service.delivery_mode] || (service.can_travel ? "Travels to customers" : "Local service");
  const coverageLabel = service.remote_available
    ? "Remote and local coverage"
    : service.service_radius_km
      ? `${service.service_radius_km} km service radius`
      : "Ask provider about coverage";

  const shareService = async () => {
    const { title, text, shareUrl } = createListingSharePayload('service', service);
    try {
      if (navigator.share) await navigator.share({ title, text, url: shareUrl });
      else { await navigator.clipboard.writeText(shareUrl); toast.success("Service link copied"); }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") toast.error("Could not share this service");
    }
  };

  return (
    <div className="findit-screen pb-24">
      <PeekRequestIntentHandler />
      <ListingDetailActions onBack={() => goBackOrHome(navigate, '/')} />
      <div className="mx-auto max-w-4xl">
        <div className="relative">
          <ListingMediaViewer photos={service.photos} title={service.title} fallbackImage={null} tour={service.tour || null} tourActionLabel="Take a Peek" tourOwnerId={service.provider_id} parentType="service" parentId={service.id} className="md:mt-4 md:rounded-3xl md:border" />
          <ListingMediaActions onShare={shareService} onSave={serviceFavourite.toggle} isSaved={serviceFavourite.isSaved} isSaving={serviceFavourite.isSaving} />
        </div>

        <ListingDetailTabs>
          <ListingTabSection id="listing-info" title="Details">
            <ListingSummary
              embedded
              badges={(
                <>
                  <Badge variant="secondary" className="rounded-full bg-primary/12 text-primary">{categoryLabel}</Badge>
                  {service.tour?.status === "ready" && <Badge className="bg-success/15 text-success">Video proof available</Badge>}
                  {subcategoryLabels.map((label, index) => <Badge key={`${label}-${index}`} variant="outline">{label}</Badge>)}
                </>
              )}
              price={priceDisplay}
              pricePrefix={pricePrefix}
              title={service.title}
              location={service.location_name}
              metadata={[
                service.can_travel ? "Travels to customers" : null,
              ]}
            />
            <div className="mt-5 overflow-hidden rounded-3xl border border-border/80 bg-card/90 shadow-sm">
              <ListingFeatureItem icon={Briefcase} label="Category" value={categoryLabel} />
              <ListingFeatureItem icon={BadgeCheck} label="Specialisation" value={subcategoryLabels.join(", ")} />
              <ListingFeatureItem icon={BadgeCheck} label="Pricing" value={priceDisplay} />
              <ListingFeatureItem icon={MapPin} label="Area" value={service.location_name || "Location arranged"} />
              <ListingFeatureItem icon={Globe2} label="Service mode" value={deliveryLabel} />
              <ListingFeatureItem icon={Route} label="Coverage" value={coverageLabel} />
              <ListingFeatureItem icon={Clock3} label="Typical response" value={attributeValues.response_time_hours ? `${attributeValues.response_time_hours} hours` : "Ask provider"} />
              <ListingFeatureItem icon={BadgeCheck} label="Proof" value={service.tour?.status === "ready" ? "Video Peek available" : "Ask for examples"} />
            </div>
            <div className="mt-6 space-y-5">
              <PeekThreadsSection parentType="service" parentId={service.id} listingKind="service" ownerId={service.provider_id} guard={guard} />
              <SafetyPanel>Agree on the scope, timeline and pricing in writing before work begins. PeekaListing does not handle service payments.</SafetyPanel>
            </div>
          </ListingTabSection>

          <ListingTabSection id="description" title="Description">
            <ListingDescription value={service.description} />
          </ListingTabSection>

          <ListingTabSection id="location" title="Location">
            <ListingLocation label={service.location_name} latitude={service.latitude} longitude={service.longitude} listingType="service" approximate={!Number.isFinite(Number(service.latitude)) || !Number.isFinite(Number(service.longitude))} />
          </ListingTabSection>

          <ListingTabSection id="seller" title="Provider">
            <ListingSeller name={service.provider_name || "PeekaListing service provider"} sellerId={service.provider_id} joinedAt={service.provider_joined_at} activeListingCount={service.provider_active_listing_count} roleLabel="Provider" profileLabel="View provider profile" actions={<ContactButtons listing={service} type="service" placement="browse" />} />
          </ListingTabSection>
        </ListingDetailTabs>
      </div>
      <ContactBar><ContactButtons listing={service} type="service" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}
