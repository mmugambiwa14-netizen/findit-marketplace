import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Car, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GuestPromptSheet } from "@/components/auth/GuestPromptSheet";
import ContactButtons from "@/components/listings/ContactButtons";
import ListingDetailActions from "@/components/listings/ListingDetailActions";
import ListingFeatureItem from "@/components/listings/ListingFeatureItem";
import ListingMediaViewer from "@/components/listings/ListingMediaViewer";
import PeekThreadsSection from "@/components/peekThreads/PeekThreadsSection";
import { ContactBar, DetailLoading, DetailSection, SafetyPanel, SellerPanel } from "@/components/listings/ListingDetailLayout";
import { useGuestGuard } from "@/hooks/useGuestGuard";
import { useMarketplaceView } from "@/hooks/useMarketplaceView";
import { getServiceCategory, getSubcategoryLabel } from "@/lib/serviceConstants";
import { useCurrency } from "@/lib/CurrencyContext";
import { getPublicService } from "@/services/servicesService";

export default function ServiceDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { guestOpen, guestAction, guard, closeGuest } = useGuestGuard();

  const { data: service, isLoading, error, refetch } = useQuery({
    queryKey: ["service", id],
    queryFn: () => getPublicService(id),
    enabled: Boolean(id),
  });
  useMarketplaceView('service', id, 'service', Boolean(service));

  if (isLoading) return <DetailLoading />;
  if (error) return <ServiceError onRetry={refetch} />;
  if (!service) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4"><div className="clay-card rounded-2xl px-6 py-10 text-center"><p className="text-muted-foreground">Service not found.</p><Link to="/services" className="mt-3 inline-block font-medium text-primary">Back to Services</Link></div></div>;

  const category = getServiceCategory(service.category);
  const subcategories = service.subcategories?.length ? service.subcategories : (service.subcategory ? [service.subcategory] : []);
  const priceDisplay = service.pricing_type === "quote" || service.price == null
    ? "Contact for quote"
    : `${service.pricing_type === "starting_from" ? "From " : ""}${format(service.price)}${service.pricing_type === "hourly" ? "/hr" : ""}`;

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
    <div className="findit-screen pb-20">
      <ListingDetailActions onBack={() => navigate(-1)} onShare={shareService} showSave={false} />
      <main className="mx-auto max-w-4xl">
        <ListingMediaViewer photos={service.photos} title={service.title} fallbackImage={null} tour={service.tour || null} tourActionLabel="Take a Peek" tourOwnerId={service.provider_id} parentType="service" parentId={service.id} className="md:mt-4 md:rounded-3xl md:border" />
        <div className="space-y-5 px-4 py-5 sm:px-6">
          <section className="surface-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {category && <Badge variant="secondary" className="rounded-full bg-primary/12 text-primary">{category.label}</Badge>}
              {subcategories.map((subcategory) => <Badge key={subcategory} variant="outline">{getSubcategoryLabel(service.category, subcategory)}</Badge>)}
            </div>
            <p className="mt-4 text-2xl font-black tracking-tight text-primary sm:text-3xl">{priceDisplay}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{service.title}</h1>
            {service.location_name && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0 text-primary" />{service.location_name}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground"><span>{Number(service.views || 0).toLocaleString()} views</span>{service.can_travel && <><span aria-hidden="true">·</span><span>Travels to customers</span></>}</div>
          </section>

          <section aria-labelledby="service-details-heading">
            <h2 id="service-details-heading" className="mb-3 findit-section-title">Service details</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {category && <ListingFeatureItem icon={category.icon || Car} label="Category" value={category.label} />}
              <ListingFeatureItem icon={MapPin} label="Area" value={service.location_name || "Location arranged"} />
              <ListingFeatureItem icon={Car} label="Travel" value={service.can_travel ? "Available" : "Local area"} />
            </div>
          </section>

          {service.description && <DetailSection title="About this service"><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{service.description}</p></DetailSection>}
          <PeekThreadsSection parentType="service" parentId={service.id} listingKind="service" ownerId={service.provider_id} guard={guard} />
          <SellerPanel name={service.provider_name || "FindIt service provider"} sellerId={service.provider_id} />
          <SafetyPanel>Agree on the scope, timeline and pricing in writing before work begins. FindIt does not handle service payments.</SafetyPanel>
        </div>
      </main>
      <ContactBar><ContactButtons listing={service} type="service" /></ContactBar>
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </div>
  );
}

function ServiceError({ onRetry }) {
  return <div className="flex min-h-screen items-center justify-center bg-background px-4"><div className="clay-card rounded-2xl px-6 py-10 text-center"><p className="font-semibold">We could not load this service.</p><p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p><Button type="button" variant="outline" className="clay-control mt-5" onClick={onRetry}>Try again</Button></div></div>;
}
