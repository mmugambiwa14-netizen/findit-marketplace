import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, CheckCircle, Fuel, Gauge, Palette, Settings, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GuestPromptSheet } from "@/components/auth/GuestPromptSheet";
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
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useListingFavourite } from "@/hooks/useListingFavourite";
import { useMarketplaceView } from "@/hooks/useMarketplaceView";
import { useTimeAgo } from "@/hooks/useTimeAgo";
import { useAuth } from "@/lib/AuthContext";
import { useCurrency } from "@/lib/CurrencyContext";
import { getListingPlaceholder } from "@/lib/listingPlaceholders";
import { shareListing } from "@/lib/share";
import { getPublicListing } from "@/services/publicListingsService";
import { ContactBar, DetailError, DetailLoading, DetailMissing, SafetyPanel } from "@/components/listings/ListingDetailLayout";

const placeholderCar = getListingPlaceholder("car");

export default function CarDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const { guestOpen, guestAction, guard, closeGuest } = useGuestGuard();
  const [selectedVariant, setSelectedVariant] = useState(0);

  const { data: car, isLoading, error, refetch } = useQuery({ queryKey: ["car", id], queryFn: () => getPublicListing("car", id), enabled: Boolean(id), staleTime: 300000 });
  useMarketplaceView('listing', id, 'car', Boolean(car));
  const listedAgo = useTimeAgo(car?.created_date);
  const { isSaved, isSaving, toggle: toggleSave } = useListingFavourite({ userId: user?.id, listingId: id, queryClient, guard });

  if (isLoading) return <DetailLoading />;
  if (error) return <DetailError label="Vehicle" onRetry={refetch} />;
  if (!car) return <DetailMissing label="Vehicle" />;

  const variants = (car.variants || []).filter((variant) => variant && Number(variant.price) > 0);
  const activePrice = variants[selectedVariant]?.price ?? car.price;
  const location = car.public_location_label || [car.suburb, car.city, car.province].filter(Boolean).join(", ");

  return (
    <div className="findit-screen pb-24">
      <ListingDetailActions onBack={() => navigate(-1)} />
      <main className="mx-auto max-w-4xl">
        <div className="relative">
          <ListingMediaViewer photos={car.photos} title={car.title} fallbackImage={placeholderCar} tour={car.tour || null} tourActionLabel="Take a Peek" tourOwnerId={car.seller_id} parentType="listing" parentId={car.id} className="md:mt-4 md:rounded-3xl md:border" />
          <ListingMediaActions onShare={() => shareListing("car", car)} onSave={toggleSave} isSaved={isSaved} isSaving={isSaving} />
        </div>

        <ListingSummary
          badges={(
            <>
              {car.condition && <Badge variant="secondary" className="rounded-full bg-primary/12 text-primary capitalize">{car.condition}</Badge>}
              {car.negotiable && <Badge variant="outline">Negotiable</Badge>}
              {car.status !== "available" && <Badge variant="destructive" className="capitalize">{String(car.status).replaceAll("_", " ")}</Badge>}
            </>
          )}
          price={format(activePrice)}
          pricePrefix={variants.length > 1 ? "From" : null}
          title={car.title}
          location={location}
          metadata={[
            `Listed ${listedAgo}`,
            `${Number(car.views || 0).toLocaleString()} views`,
            <ListingCode key="car-code" type="car" id={car.id} />,
          ]}
        />

        <ListingDetailTabs>
          <ListingTabSection id="listing-info" title="Listing info">
            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              <ListingFeatureItem icon={Calendar} label="Year" value={car.year} />
              <ListingFeatureItem icon={Gauge} label="Mileage" value={`${(car.mileage || 0).toLocaleString()} km`} />
              <ListingFeatureItem icon={Fuel} label="Fuel" value={car.fuel_type} />
              <ListingFeatureItem icon={Settings} label="Gearbox" value={car.transmission} />
              <ListingFeatureItem icon={Palette} label="Colour" value={car.color} />
              <ListingFeatureItem icon={car.full_service_history ? CheckCircle : XCircle} label="Service history" value={car.full_service_history ? "Full" : "Not supplied"} />
            </div>
            {car.accident_history && <div className="mt-5 rounded-2xl border border-destructive/25 bg-destructive/10 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-5 w-5" />Accident history has been declared</p></div>}
            <div className="mt-6 space-y-5">
              <VariantSelector variants={car.variants} selectedIndex={selectedVariant} onSelect={setSelectedVariant} />
              <PriceBreakdown listing={car} />
              {car.accepts_offers && <MakeOfferButton listing={car} />}
              <PeekThreadsSection parentType="listing" parentId={car.id} listingKind="car" ownerId={car.seller_id} guard={guard} />
              <SafetyPanel>Request a test drive, verify ownership documents and consider an independent mechanical inspection. Never send money before seeing the vehicle.</SafetyPanel>
            </div>
          </ListingTabSection>

          <ListingTabSection id="description" title="Description">
            <ListingDescription value={car.description} />
          </ListingTabSection>

          <ListingTabSection id="location" title="Location">
            <ListingLocation label={location} latitude={car.latitude} longitude={car.longitude} />
          </ListingTabSection>

          <ListingTabSection id="seller" title="Seller">
            <ListingSeller name={car.seller_name} sellerId={car.seller_id} joinedAt={car.seller_joined_at} activeListingCount={car.seller_active_listing_count} actions={<ContactButtons listing={car} type="car" placement="browse" />} />
          </ListingTabSection>

          <ListingRecommendations subjectListingId={car.id} />
          <ReportListingDialog listing={car} listingType="car" />
        </ListingDetailTabs>
      </main>
      <ContactBar><ContactButtons listing={car} type="car" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}
