import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Gauge, Weight, Wrench, Zap } from "lucide-react";
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
import PeekRequestIntentHandler from "@/components/peekThreads/PeekRequestIntentHandler";
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
import { getMachineryLabel } from "@/lib/constants";
import { useCurrency } from "@/lib/CurrencyContext";
import { getListingPlaceholder } from "@/lib/listingPlaceholders";
import { shareListing } from "@/lib/share";
import { getPublicListing } from "@/services/publicListingsService";
import { ContactBar, DetailError, DetailLoading, DetailMissing, SafetyPanel } from "@/components/listings/ListingDetailLayout";

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
    <div className="findit-screen pb-24">
      <PeekRequestIntentHandler />
      <ListingDetailActions onBack={() => navigate(-1)} />
      <main className="mx-auto max-w-4xl">
        <div className="relative">
          <ListingMediaViewer photos={item.photos} title={item.title} fallbackImage={placeholderMachinery} tour={item.tour || null} tourActionLabel="Take a Peek" tourOwnerId={item.seller_id} parentType="listing" parentId={item.id} className="md:mt-4 md:rounded-3xl md:border" />
          <ListingMediaActions onShare={() => shareListing("machinery", item)} onSave={toggleSave} isSaved={isSaved} isSaving={isSaving} />
        </div>

        <ListingSummary
          badges={(
            <>
              <Badge variant="secondary" className="rounded-full bg-primary/12 text-primary">{getMachineryLabel(item.category)}</Badge>
              {item.tour?.status === "ready" && <Badge className="bg-success/15 text-success">Video proof available</Badge>}
              {item.status !== "available" && <Badge variant="destructive" className="capitalize">{String(item.status).replaceAll("_", " ")}</Badge>}
              {item.negotiable && <Badge variant="outline">Negotiable</Badge>}
            </>
          )}
          price={format(activePrice)}
          pricePrefix={variants.length > 1 ? "From" : null}
          title={item.title}
          location={location}
          metadata={[
            `Listed ${listedAgo}`,
            `${Number(item.views || 0).toLocaleString()} views`,
            <ListingCode key="machinery-code" type="machinery" id={item.id} />,
          ]}
        />

        <ListingDetailTabs>
          <ListingTabSection id="listing-info" title="Details">
            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              {item.year && <ListingFeatureItem icon={Zap} label="Year" value={item.year} />}
              {item.equipment_hours > 0 && <ListingFeatureItem icon={Gauge} label="Hours" value={`${item.equipment_hours.toLocaleString()} h`} />}
              {item.mileage_km > 0 && <ListingFeatureItem icon={Gauge} label="Mileage" value={`${item.mileage_km.toLocaleString()} km`} />}
              {item.engine_power_hp > 0 && <ListingFeatureItem icon={Zap} label="Power" value={`${item.engine_power_hp} hp`} />}
              {item.operating_weight_tonnes > 0 && <ListingFeatureItem icon={Weight} label="Weight" value={`${item.operating_weight_tonnes} t`} />}
              {item.lifting_capacity_tonnes > 0 && <ListingFeatureItem icon={Weight} label="Lift capacity" value={`${item.lifting_capacity_tonnes} t`} />}
              {item.gvm_tonnes > 0 && <ListingFeatureItem icon={Weight} label="GVM" value={`${item.gvm_tonnes} t`} />}
              {item.payload_tonnes > 0 && <ListingFeatureItem icon={Weight} label="Payload" value={`${item.payload_tonnes} t`} />}
              {item.condition && <ListingFeatureItem icon={Wrench} label="Condition" value={item.condition} />}
            </div>

            {item.operators_licence_required && <div className="mt-5 rounded-2xl border border-warning/25 bg-warning/10 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-5 w-5 text-warning" />An operator licence is required for this equipment.</p></div>}
            {item.attachments?.length > 0 && <div className="mt-6"><h3 className="text-sm font-bold">Attachments and implements</h3><div className="mt-3 flex flex-wrap gap-2">{item.attachments.map((attachment) => <Badge key={attachment} variant="secondary">{attachment}</Badge>)}</div></div>}
            <div className="mt-6 space-y-5">
              <PeekThreadsSection parentType="listing" parentId={item.id} listingKind="machinery" ownerId={item.seller_id} guard={guard} />
              <VariantSelector variants={item.variants} selectedIndex={selectedVariant} onSelect={setSelectedVariant} />
              <PriceBreakdown listing={item} />
              {item.accepts_offers && <MakeOfferButton listing={item} />}
              <SafetyPanel>Inspect machinery in person and request maintenance records, serial-number verification and applicable certification before purchasing.</SafetyPanel>
            </div>
          </ListingTabSection>

          <ListingTabSection id="description" title="Description">
            <ListingDescription value={item.description} />
          </ListingTabSection>

          <ListingTabSection id="location" title="Location">
            <ListingLocation label={location} latitude={item.latitude} longitude={item.longitude} />
          </ListingTabSection>

          <ListingTabSection id="seller" title="Seller">
            <ListingSeller name={item.seller_name} sellerId={item.seller_id} joinedAt={item.seller_joined_at} activeListingCount={item.seller_active_listing_count} actions={<ContactButtons listing={item} type="machinery" placement="browse" />} />
          </ListingTabSection>

          <ListingRecommendations subjectListingId={item.id} />
          <ReportListingDialog listing={item} listingType="machinery" />
        </ListingDetailTabs>
      </main>
      <ContactBar><ContactButtons listing={item} type="machinery" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}
