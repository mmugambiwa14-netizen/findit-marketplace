import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Car, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ContactBar, DetailLoading, SafetyPanel } from "@/components/listings/ListingDetailLayout";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useServiceFavourite } from "@/hooks/useServiceFavourite";
import { useAuth } from "@/lib/AuthContext";
import { useMarketplaceView } from "@/hooks/useMarketplaceView";
import { useCurrency } from "@/lib/CurrencyContext";
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
  useMarketplaceView('service', id, 'service', Boolean(service));

  if (isLoading) return <DetailLoading />;
  if (error) return <ServiceError onRetry={refetch} />;
  if (!service) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4"><div className="clay-card rounded-2xl px-6 py-10 text-center"><p className="text-muted-foreground">Service not found.</p><Link to="/services" className="mt-3 inline-block font-medium text-primary">Back to Services</Link></div></div>;

  const categoryLabel = service.category_label || "Service";
  const subcategoryLabels = service.subcategory_labels?.length
    ? service.subcategory_labels
    : (service.subcategory_label ? [service.subcategory_label] : []);
  const quoteOnly = service.pricing_type === "quote" || service.price == null;
  const priceDisplay = quoteOnly
    ? "Contact for quote"
    : `${format(service.price)}${service.pricing_type === "hourly" ? "/hr" : ""}`;
  const pricePrefix = !quoteOnly && service.pricing_type === "starting_from" ? "From" : null;

  const shareService = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: service.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") toast.error("Could not share this service");
    }
  };

  return (
    <div className="findit-screen pb-24">
      <PeekRequestIntentHandler />
      <ListingDetailActions onBack={() => navigate(-1)} />
      <main className="mx-auto max-w-4xl">
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
                `${Number(service.views || 0).toLocaleString()} views`,
                service.can_travel ? "Travels to customers" : null,
              ]}
            />
            <div className="mt-5 grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              <ListingFeatureItem icon={Briefcase} label="Category" value={categoryLabel} />
              <ListingFeatureItem icon={MapPin} label="Area" value={service.location_name || "Location arranged"} />
              <ListingFeatureItem icon={Car} label="Travel" value={service.can_travel ? "Available" : "Local area"} />
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
            <ListingLocation label={service.location_name} latitude={service.latitude} longitude={service.longitude} approximate={!Number.isFinite(Number(service.latitude)) || !Number.isFinite(Number(service.longitude))} />
          </ListingTabSection>

          <ListingTabSection id="seller" title="Provider">
            <ListingSeller name={service.provider_name || "PeekaListing service provider"} sellerId={service.provider_id} joinedAt={service.provider_joined_at} activeListingCount={service.provider_active_listing_count} roleLabel="Provider" profileLabel="View provider profile" actions={<ContactButtons listing={service} type="service" placement="browse" />} />
          </ListingTabSection>
        </ListingDetailTabs>
      </main>
      <ContactBar><ContactButtons listing={service} type="service" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}

function ServiceError({ onRetry }) {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="clay-card rounded-2xl px-6 py-10 text-center"><p className="font-semibold">We could not load this service.</p><p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p><Button type="button" variant="outline" className="clay-control mt-5" onClick={onRetry}>Try again</Button></div></div>;
}
