import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bath, Bed, Car, Maximize, Trees, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ContactButtons from "@/components/listings/ContactButtons";
import ListingCode from "@/components/listings/ListingCode";
import ListingDetailActions from "@/components/listings/ListingDetailActions";
import ListingFeatureItem from "@/components/listings/ListingFeatureItem";
import ListingMediaActions from "@/components/listings/ListingMediaActions";
import ListingMediaViewer from "@/components/listings/ListingMediaViewer";
import ListingRecommendations from "@/components/listings/ListingRecommendations";
import ListingSummary from "@/components/listings/ListingSummary";
import PeekThreadsSection from "@/components/peekThreads/PeekThreadsSection";
import MakeOfferButton from "@/components/listings/MakeOfferButton";
import PriceBreakdown from "@/components/listings/PriceBreakdown";
import ReportListingDialog from "@/components/listings/ReportListingDialog";
import VariantSelector from "@/components/listings/VariantSelector";
import {
  ListingDescription,
  ListingDetailTabs,
  ListingLocation,
  ListingSeller,
  ListingTabSection,
} from "@/components/listings/ListingDetailTabs";
import { GuestPromptSheet } from "@/components/auth/GuestPromptSheet";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useListingFavourite } from "@/hooks/useListingFavourite";
import { useMarketplaceView } from "@/hooks/useMarketplaceView";
import { useTimeAgo } from "@/hooks/useTimeAgo";
import { useAuth } from "@/lib/AuthContext";
import { getCategoryLabel } from "@/lib/constants";
import { useCurrency } from "@/lib/CurrencyContext";
import { getListingPlaceholder } from "@/lib/listingPlaceholders";
import { shareListing } from "@/lib/share";
import { getPublicListing } from "@/services/publicListingsService";
import { ContactBar, DetailError, DetailLoading, DetailMissing, SafetyPanel } from "@/components/listings/ListingDetailLayout";

const placeholderProperty = getListingPlaceholder("property");

export default function PropertyDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { guestOpen, guestAction, guard, closeGuest } = useGuestGuard();
  const [selectedVariant, setSelectedVariant] = useState(0);

  const { data: property, isLoading, error, refetch } = useQuery({
    queryKey: ["property", id],
    queryFn: () => getPublicListing("property", id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
  useMarketplaceView('listing', id, 'property', Boolean(property));
  const listedAgo = useTimeAgo(property?.created_date);
  const { isSaved, isSaving, toggle: toggleSave } = useListingFavourite({ userId: user?.id, listingId: id, queryClient, guard });

  if (isLoading) return <DetailLoading />;
  if (error) return <DetailError label="Property" onRetry={refetch} />;
  if (!property) return <DetailMissing label="Property" />;

  const variants = (property.variants || []).filter((variant) => variant && Number(variant.price) > 0);
  const activePrice = variants[selectedVariant]?.price ?? property.price;
  const isSaleCategory = ["house_sale", "land_sale", "commercial", "flat_apartment", "apartment_sale"].includes(property.category);
  const location = property.public_location_label || [property.suburb, property.city, property.province].filter(Boolean).join(", ");

  return (
    <div className="findit-screen pb-24">
      <ListingDetailActions onBack={() => navigate(-1)} />
      <main className="mx-auto max-w-4xl">
        <div className="relative">
          <ListingMediaViewer photos={property.photos} title={property.title} fallbackImage={placeholderProperty} tour={property.tour || null} tourActionLabel="Take a Peek" tourOwnerId={property.seller_id} parentType="listing" parentId={property.id} className="md:mt-4 md:rounded-3xl md:border" />
          <ListingMediaActions onShare={() => shareListing("property", property)} onSave={toggleSave} isSaved={isSaved} isSaving={isSaving} />
        </div>

        <ListingSummary
          badges={(
            <>
              <Badge variant="secondary" className="rounded-full bg-primary/12 text-primary">{getCategoryLabel(property.category)}</Badge>
              {property.tour?.status === "ready" && <Badge className="bg-success/15 text-success">Public Peek</Badge>}
              {property.status !== "available" && <Badge variant="destructive">{statusLabel(property.status)}</Badge>}
              {property.negotiable && <Badge variant="outline">Negotiable</Badge>}
            </>
          )}
          price={format(activePrice)}
          pricePrefix={variants.length > 1 ? "From" : null}
          title={property.title}
          location={location}
          metadata={[
            `Listed ${listedAgo}`,
            `${Number(property.views || 0).toLocaleString()} views`,
            <ListingCode key="property-code" type="property" id={property.id} />,
          ]}
        />

        <ListingDetailTabs>
          <ListingTabSection id="listing-info" title="Listing info">
            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              {property.bedrooms > 0 && <ListingFeatureItem icon={Bed} label="Bedrooms" value={property.bedrooms} />}
              {property.bathrooms > 0 && <ListingFeatureItem icon={Bath} label="Bathrooms" value={property.bathrooms} />}
              {property.property_size > 0 && <ListingFeatureItem icon={Maximize} label="Size" value={`${property.property_size}m²`} />}
              {property.has_garage && <ListingFeatureItem icon={Car} label="Garage" value="Yes" />}
              {property.has_garden && <ListingFeatureItem icon={Trees} label="Garden" value="Yes" />}
              {property.has_pool && <ListingFeatureItem icon={Waves} label="Pool" value="Yes" />}
            </div>
            <div className="mt-6 space-y-5">
              <VariantSelector variants={property.variants} selectedIndex={selectedVariant} onSelect={setSelectedVariant} />
              <PriceBreakdown listing={property} />
              {property.accepts_offers && <MakeOfferButton listing={property} />}
              <PeekThreadsSection parentType="listing" parentId={property.id} listingKind="property" ownerId={property.seller_id} guard={guard} />
              <SafetyPanel>Always view the property in person before making a payment. Never send money to someone you have not met. PeekaListing does not handle buyer–seller payments.{isSaleCategory && <span className="mt-2 block">Verify title-deed ownership through the appropriate registry before signing an agreement.</span>}</SafetyPanel>
            </div>
          </ListingTabSection>

          <ListingTabSection id="description" title="Description">
            <ListingDescription value={property.description} />
          </ListingTabSection>

          <ListingTabSection id="location" title="Location">
            <ListingLocation label={location} latitude={property.latitude} longitude={property.longitude} />
          </ListingTabSection>

          <ListingTabSection id="seller" title="Seller">
            <ListingSeller name={property.seller_name} sellerId={property.seller_id} joinedAt={property.seller_joined_at} activeListingCount={property.seller_active_listing_count} actions={<ContactButtons listing={property} type="property" placement="browse" />} />
          </ListingTabSection>

          <ListingRecommendations subjectListingId={property.id} />
          <ReportListingDialog listing={property} listingType="property" />
        </ListingDetailTabs>
      </main>
      <ContactBar><ContactButtons listing={property} type="property" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}

function statusLabel(status) {
  return status === "under_offer" ? "Under offer" : status === "sold" ? "Sold" : status === "rented" ? "Rented" : String(status || "Unavailable").replaceAll("_", " ");
}
