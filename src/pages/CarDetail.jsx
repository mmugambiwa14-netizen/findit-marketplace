import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, CheckCircle, Fuel, Gauge, MapPin, Palette, Settings, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GuestPromptSheet } from "@/components/auth/GuestPromptSheet";
import ContactButtons from "@/components/listings/ContactButtons";
import ListingCode from "@/components/listings/ListingCode";
import ListingDetailActions from "@/components/listings/ListingDetailActions";
import ListingFeatureItem from "@/components/listings/ListingFeatureItem";
import ListingMediaViewer from "@/components/listings/ListingMediaViewer";
import ListingRecommendations from "@/components/listings/ListingRecommendations";
import MakeOfferButton from "@/components/listings/MakeOfferButton";
import PriceBreakdown from "@/components/listings/PriceBreakdown";
import ReportListingDialog from "@/components/listings/ReportListingDialog";
import VariantSelector from "@/components/listings/VariantSelector";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useListingFavourite } from "@/hooks/useListingFavourite";
import { useMarketplaceView } from "@/hooks/useMarketplaceView";
import { useTimeAgo } from "@/hooks/useTimeAgo";
import { useAuth } from "@/lib/AuthContext";
import { useCurrency } from "@/lib/CurrencyContext";
import { getListingPlaceholder } from "@/lib/listingPlaceholders";
import { shareListing } from "@/lib/share";
import { getPublicListing } from "@/services/publicListingsService";
import { ContactBar, DetailError, DetailLoading, DetailMissing, DetailSection, SafetyPanel, SellerPanel } from "@/components/listings/ListingDetailLayout";

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
    <div className="findit-screen pb-36">
      <ListingDetailActions onBack={() => navigate(-1)} onShare={() => shareListing("car", car)} onSave={toggleSave} isSaved={isSaved} isSaving={isSaving} />
      <main className="mx-auto max-w-4xl">
        <ListingMediaViewer photos={car.photos} title={car.title} fallbackImage={placeholderCar} tour={car.tour || null} tourActionLabel="Take a Peek" tourOwnerId={car.seller_id} parentType="listing" parentId={car.id} className="md:mt-4 md:rounded-3xl md:border" />
        <div className="space-y-5 px-4 py-5 sm:px-6">
          <section className="surface-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {car.condition && <Badge variant="secondary" className="rounded-full bg-primary/12 text-primary capitalize">{car.condition}</Badge>}
              {car.negotiable && <Badge variant="outline">Negotiable</Badge>}
              {car.status !== "available" && <Badge variant="destructive" className="capitalize">{String(car.status).replaceAll("_", " ")}</Badge>}
              <ListingCode type="car" id={car.id} />
            </div>
            <p className="mt-4 text-2xl font-black tracking-tight text-primary sm:text-3xl">{variants.length > 1 && <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">From</span>}{format(activePrice)}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{car.title}</h1>
            {location && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0 text-primary" />{location}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground"><span>Listed {listedAgo}</span><span aria-hidden="true">·</span><span>{Number(car.views || 0).toLocaleString()} views</span><span aria-hidden="true">·</span><span>Indicative currency conversion</span></div>
            {car.accepts_offers && <div className="mt-4"><MakeOfferButton listing={car} /></div>}
          </section>
          <section aria-labelledby="vehicle-details-heading"><h2 id="vehicle-details-heading" className="mb-3 findit-section-title">Key details</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <ListingFeatureItem icon={Calendar} label="Year" value={car.year} />
            <ListingFeatureItem icon={Gauge} label="Mileage" value={`${(car.mileage || 0).toLocaleString()} km`} />
            <ListingFeatureItem icon={Fuel} label="Fuel" value={car.fuel_type} />
            <ListingFeatureItem icon={Settings} label="Gearbox" value={car.transmission} />
            <ListingFeatureItem icon={Palette} label="Colour" value={car.color} />
            <ListingFeatureItem icon={car.full_service_history ? CheckCircle : XCircle} label="Service history" value={car.full_service_history ? "Full" : "Not supplied"} />
          </div></section>
          {car.accident_history && <section className="clay-soft rounded-2xl border-destructive/25 bg-destructive/10 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-5 w-5" />Accident history has been declared</p></section>}
          {car.description && <DetailSection title="About this vehicle"><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{car.description}</p></DetailSection>}
          <VariantSelector variants={car.variants} selectedIndex={selectedVariant} onSelect={setSelectedVariant} />
          <PriceBreakdown listing={car} />
          <SellerPanel name={car.seller_name} sellerId={car.seller_id} />
          <SafetyPanel>Request a test drive, verify ownership documents and consider an independent mechanical inspection. Never send money before seeing the vehicle.</SafetyPanel>
          <ListingRecommendations subjectListingId={car.id} />
          <ReportListingDialog listing={car} listingType="car" />
        </div>
      </main>
      <ContactBar><ContactButtons listing={car} type="car" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}
