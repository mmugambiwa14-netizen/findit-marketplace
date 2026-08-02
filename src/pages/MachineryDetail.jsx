import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Gauge, MapPin, Weight, Wrench, Zap } from "lucide-react";
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
import { getMachineryLabel } from "@/lib/constants";
import { useCurrency } from "@/lib/CurrencyContext";
import { getListingPlaceholder } from "@/lib/listingPlaceholders";
import { shareListing } from "@/lib/share";
import { getPublicListing } from "@/services/publicListingsService";
import { ContactBar, DetailError, DetailLoading, DetailMissing, DetailSection, SafetyPanel, SellerPanel } from "@/components/listings/ListingDetailLayout";

const placeholderMachinery = getListingPlaceholder("machinery");

export default function MachineryDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const { guestOpen, guestAction, guard, closeGuest } = useGuestGuard();
  const [selectedVariant, setSelectedVariant] = useState(0);

  const { data: item, isLoading, error, refetch } = useQuery({ queryKey: ["machinery", id], queryFn: () => getPublicListing("machinery", id), enabled: Boolean(id), staleTime: 300000 });
  useMarketplaceView('listing', id, 'machinery', Boolean(item));
  const listedAgo = useTimeAgo(item?.created_date);
  const { isSaved, isSaving, toggle: toggleSave } = useListingFavourite({ userId: user?.id, listingId: id, queryClient, guard });

  if (isLoading) return <DetailLoading />;
  if (error) return <DetailError label="Equipment" onRetry={refetch} />;
  if (!item) return <DetailMissing label="Equipment" />;

  const variants = (item.variants || []).filter((variant) => variant && Number(variant.price) > 0);
  const activePrice = variants[selectedVariant]?.price ?? item.price;
  const location = item.public_location_label || [item.suburb, item.city, item.province].filter(Boolean).join(", ");

  return (
    <div className="findit-screen pb-20">
      <ListingDetailActions onBack={() => navigate(-1)} onShare={() => shareListing("machinery", item)} onSave={toggleSave} isSaved={isSaved} isSaving={isSaving} />
      <main className="mx-auto max-w-4xl">
        <ListingMediaViewer photos={item.photos} title={item.title} fallbackImage={placeholderMachinery} tour={item.tour || null} tourActionLabel="Take a Peek" tourOwnerId={item.seller_id} parentType="listing" parentId={item.id} className="md:mt-4 md:rounded-3xl md:border" />
        <div className="space-y-5 px-4 py-5 sm:px-6">
          <section className="surface-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full bg-primary/12 text-primary">{getMachineryLabel(item.category)}</Badge>
              {item.listing_number ? <Badge variant="outline" className="font-mono">{item.listing_number}</Badge> : <ListingCode type="machinery" id={item.id} />}
              {item.status !== "available" && <Badge variant="destructive" className="capitalize">{String(item.status).replaceAll("_", " ")}</Badge>}
              {item.ce_certification && <Badge variant="outline">CE certified</Badge>}
            </div>
            <p className="mt-4 text-2xl font-black tracking-tight text-primary sm:text-3xl">{variants.length > 1 && <span className="mr-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">From</span>}{format(activePrice)}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{item.title}</h1>
            {location && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0 text-primary" />{location}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
              <span>Listed {listedAgo}</span><span aria-hidden="true">·</span><span>{Number(item.views || 0).toLocaleString()} views</span>{item.negotiable && <><span aria-hidden="true">·</span><span>Negotiable</span></>}
            </div>
            {item.accepts_offers && <div className="mt-4"><MakeOfferButton listing={item} /></div>}
          </section>

          <section aria-labelledby="equipment-details-heading"><h2 id="equipment-details-heading" className="mb-3 findit-section-title">Key details</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {item.year && <ListingFeatureItem icon={Zap} label="Year" value={item.year} />}
            {item.equipment_hours > 0 && <ListingFeatureItem icon={Gauge} label="Hours" value={`${item.equipment_hours.toLocaleString()} h`} />}
            {item.mileage_km > 0 && <ListingFeatureItem icon={Gauge} label="Mileage" value={`${item.mileage_km.toLocaleString()} km`} />}
            {item.engine_power_hp > 0 && <ListingFeatureItem icon={Zap} label="Power" value={`${item.engine_power_hp} hp`} />}
            {item.operating_weight_tonnes > 0 && <ListingFeatureItem icon={Weight} label="Weight" value={`${item.operating_weight_tonnes} t`} />}
            {item.lifting_capacity_tonnes > 0 && <ListingFeatureItem icon={Weight} label="Lift capacity" value={`${item.lifting_capacity_tonnes} t`} />}
            {item.gvm_tonnes > 0 && <ListingFeatureItem icon={Weight} label="GVM" value={`${item.gvm_tonnes} t`} />}
            {item.payload_tonnes > 0 && <ListingFeatureItem icon={Weight} label="Payload" value={`${item.payload_tonnes} t`} />}
            {item.condition && <ListingFeatureItem icon={Wrench} label="Condition" value={item.condition} />}
          </div></section>

          {item.description && <DetailSection title="About this equipment"><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{item.description}</p></DetailSection>}
          {item.attachments?.length > 0 && <DetailSection title="Attachments and implements"><div className="flex flex-wrap gap-2">{item.attachments.map((attachment) => <Badge key={attachment} variant="secondary">{attachment}</Badge>)}</div></DetailSection>}
          {item.operators_licence_required && <section className="clay-soft rounded-2xl border-warning/25 bg-warning/10 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-5 w-5 text-warning" />An operator licence is required for this equipment.</p></section>}
          <VariantSelector variants={item.variants} selectedIndex={selectedVariant} onSelect={setSelectedVariant} />
          <PriceBreakdown listing={item} />
          <SellerPanel name={item.seller_name} sellerId={item.seller_id} />
          <SafetyPanel>Inspect machinery in person and request maintenance records, serial-number verification and applicable certification before purchasing.</SafetyPanel>
          <ListingRecommendations subjectListingId={item.id} />
          <ReportListingDialog listing={item} listingType="machinery" />
        </div>
      </main>
      <ContactBar><ContactButtons listing={item} type="machinery" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}
