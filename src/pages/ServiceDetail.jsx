import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Car, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ContactButtons from "@/components/listings/ContactButtons";
import ListingDetailActions from "@/components/listings/ListingDetailActions";
import ListingMediaViewer from "@/components/listings/ListingMediaViewer";
import { ContactBar, DetailLoading, DetailSection, SafetyPanel, SellerPanel } from "@/components/listings/ListingDetailLayout";
import { useMarketplaceView } from "@/hooks/useMarketplaceView";
import { getServiceCategory, getSubcategoryLabel } from "@/lib/serviceConstants";
import { useCurrency } from "@/lib/CurrencyContext";
import { getPublicService } from "@/services/servicesService";

export default function ServiceDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { format } = useCurrency();

  const { data: service, isLoading, error, refetch } = useQuery({
    queryKey: ["service", id],
    queryFn: () => getPublicService(id),
    enabled: Boolean(id),
  });
  useMarketplaceView('service', id, 'service', Boolean(service));

  if (isLoading) return <DetailLoading />;
  if (error) return <ServiceError onRetry={refetch} />;
  if (!service) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background"><p className="text-muted-foreground">Service not found.</p><Link to="/services" className="font-medium text-primary">Back to Services</Link></div>;

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
    <div className="min-h-screen bg-background pb-32">
      <ListingDetailActions onBack={() => navigate(-1)} onShare={shareService} showSave={false} />
      <main className="mx-auto max-w-4xl">
        <ListingMediaViewer photos={service.photos} title={service.title} fallbackImage={null} tour={service.tour || null} tourActionLabel="Take a Peek" tourOwnerId={service.provider_id} parentType="service" parentId={service.id} />
        <div className="space-y-5 px-4 py-5 sm:px-6">
          <section className="surface-panel p-5">
            <div className="flex flex-wrap items-center gap-2">{category && <Badge variant="secondary">{category.label}</Badge>}{subcategories.map((subcategory) => <Badge key={subcategory} variant="outline">{getSubcategoryLabel(service.category, subcategory)}</Badge>)}</div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{service.title}</h1>
            <p className="mt-4 text-3xl font-bold text-primary">{priceDisplay}</p>
            {service.location_name && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{service.location_name}</p>}
            {service.can_travel && <p className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary/10 px-4 text-sm font-medium text-primary"><Car className="h-4 w-4" />Can travel to other areas</p>}
            <p className="mt-3 text-sm text-muted-foreground">{Number(service.views || 0).toLocaleString()} views</p>
          </section>
          {service.description && <DetailSection title="About this service"><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{service.description}</p></DetailSection>}
          <SellerPanel name={service.provider_name || "FindIt service provider"} sellerId={service.provider_id} />
          <SafetyPanel>Agree on the scope, timeline and pricing in writing before work begins. FindIt does not handle service payments.</SafetyPanel>
        </div>
      </main>
      <ContactBar><ContactButtons listing={service} type="service" /></ContactBar>
    </div>
  );
}

function ServiceError({ onRetry }) {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center"><p className="font-semibold">We could not load this service.</p><p className="text-sm text-muted-foreground">Check your connection and try again.</p><Button type="button" variant="outline" onClick={onRetry}>Try again</Button></div>;
}
