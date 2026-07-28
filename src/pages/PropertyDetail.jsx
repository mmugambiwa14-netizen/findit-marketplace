import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bath, Bed, Car, MapPin, Maximize, Trees, Waves } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ContactButtons from "@/components/listings/ContactButtons";
import ListingCode from "@/components/listings/ListingCode";
import ListingDetailActions from "@/components/listings/ListingDetailActions";
import ListingFeatureItem from "@/components/listings/ListingFeatureItem";
import ListingMediaViewer from "@/components/listings/ListingMediaViewer";
import { ContactBar, DetailError, DetailLoading, DetailMissing, DetailSection, SafetyPanel, SellerPanel } from "@/components/listings/ListingDetailLayout";
import MakeOfferButton from "@/components/listings/MakeOfferButton";
import PriceBreakdown from "@/components/listings/PriceBreakdown";
import ReportListingDialog from "@/components/listings/ReportListingDialog";
import VariantSelector from "@/components/listings/VariantSelector";
import { GuestPromptSheet } from "@/components/auth/GuestPromptSheet";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useListingFavourite } from "@/hooks/useListingFavourite";
import { useTimeAgo } from "@/hooks/useTimeAgo";
import { useAuth } from "@/lib/AuthContext";
import { getCategoryLabel } from "@/lib/constants";
import { useCurrency } from "@/lib/CurrencyContext";
import { getListingPlaceholder } from "@/lib/listingPlaceholders";
import { shareListing } from "@/lib/share";
import { getPublicListing } from "@/services/publicListingsService";

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
  const listedAgo = useTimeAgo(property?.created_date);
  const { isSaved, isSaving, toggle: toggleSave } = useListingFavourite({
    userId: user?.id,
    listingId: id,
    queryClient,
    guard,
  });

  if (isLoading) return <DetailLoading />;
  if (error) return <DetailError label="Property" onRetry={refetch} />;
  if (!property) return <DetailMissing label="Property" />;

  const variants = (property.variants || []).filter((variant) => variant && Number(variant.price) > 0);
  const activePrice = variants[selectedVariant]?.price ?? property.price;
  const isSaleCategory = ["house_sale", "land_sale", "commercial", "flat_apartment", "apartment_sale"].includes(property.category);
  const location = [property.suburb, property.city, property.province].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background pb-32">
      <ListingDetailActions
        onBack={() => navigate(-1)}
        onShare={() => shareListing("property", property)}
        onSave={toggleSave}
        isSaved={isSaved}
        isSaving={isSaving}
      />

      <main className="mx-auto max-w-4xl">
        <ListingMediaViewer
          photos={property.photos}
          title={property.title}
          fallbackImage={placeholderProperty}
          tour={property.tour || null}
          tourActionLabel="Watch Peek"
          tourOwnerId={property.seller_id}
          parentType="listing"
          parentId={property.id}
        />

        <div className="space-y-5 px-4 py-5 sm:px-6">
          <section className="surface-panel p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{getCategoryLabel(property.category)}</Badge>
              {property.status !== "available" && <Badge variant="destructive">{statusLabel(property.status)}</Badge>}
              <ListingCode type="property" id={property.id} />
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{property.title}</h1>
            {location && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{location}</p>}
            <p className="mt-4 text-3xl font-bold text-primary">
              {variants.length > 1 && <span className="mr-2 text-sm font-semibold text-muted-foreground">From</span>}
              {format(activePrice)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Currency conversions are indicative; final exchange rates may vary.</p>
            {property.accepts_offers && <div className="mt-4"><MakeOfferButton listing={property} /></div>}
            <p className="mt-3 text-sm text-muted-foreground">Listed {listedAgo}</p>
          </section>

          <VariantSelector variants={property.variants} selectedIndex={selectedVariant} onSelect={setSelectedVariant} />
          <PriceBreakdown listing={property} />

          <section aria-labelledby="property-details-heading">
            <h2 id="property-details-heading" className="mb-3 text-lg font-semibold">Key details</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {property.bedrooms > 0 && <ListingFeatureItem icon={Bed} label="Bedrooms" value={property.bedrooms} />}
              {property.bathrooms > 0 && <ListingFeatureItem icon={Bath} label="Bathrooms" value={property.bathrooms} />}
              {property.property_size > 0 && <ListingFeatureItem icon={Maximize} label="Size" value={`${property.property_size}m²`} />}
              {property.has_garage && <ListingFeatureItem icon={Car} label="Garage" value="Yes" />}
              {property.has_garden && <ListingFeatureItem icon={Trees} label="Garden" value="Yes" />}
              {property.has_pool && <ListingFeatureItem icon={Waves} label="Pool" value="Yes" />}
            </div>
          </section>

          {property.description && <DetailSection title="Description"><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{property.description}</p></DetailSection>}

          <SellerPanel name={property.seller_name} email={property.contact_email || property.seller_email} />

          <SafetyPanel>
            Always view the property in person before making a payment. Never send money to someone you have not met. FindIt does not handle buyer–seller payments.
            {isSaleCategory && <span className="mt-2 block">Verify title-deed ownership through the appropriate registry before signing an agreement.</span>}
          </SafetyPanel>

          <ReportListingDialog listing={property} listingType="property" />
        </div>
      </main>

      <ContactBar><ContactButtons listing={property} type="property" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}

function statusLabel(status) {
  return status === "under_offer" ? "Under offer" : status === "sold" ? "Sold" : status === "rented" ? "Rented" : String(status || "Unavailable").replaceAll("_", " ");
}
