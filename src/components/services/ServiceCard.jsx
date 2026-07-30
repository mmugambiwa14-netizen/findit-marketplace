import { Briefcase, Car } from 'lucide-react';
import ContactButtons from '@/components/listings/ContactButtons';
import MarketplaceCard from '@/components/marketplace/MarketplaceCard';
import { getServiceCategory, getSubcategoryLabel } from '@/lib/serviceConstants';
import { useCurrency } from '@/lib/CurrencyContext';

function serviceTour(service) {
  if (service.tour) return service.tour;
  if (!service.hasTour && !service.has_tour && !service.tour_status) return null;
  return {
    status: service.tour_status || 'ready',
    durationSeconds: service.tour_duration_seconds,
    thumbnailUrl: service.tour_thumbnail_url,
  };
}

export default function ServiceCard({ service, onOpen = null }) {
  const category = getServiceCategory(service.category);
  const { format } = useCurrency();
  const priceLabel = service.pricing_type === 'quote' || !service.price
    ? 'Contact for quote'
    : `${service.pricing_type === 'starting_from' ? 'From ' : ''}${format(service.price)}${service.pricing_type === 'hourly' ? '/hr' : ''}`;
  const subcategory = getSubcategoryLabel(service.category, service.subcategory);
  const attributes = [
    subcategory && { icon: Briefcase, label: subcategory },
    service.can_travel && { icon: Car, label: 'Can travel' },
  ].filter(Boolean);
  const hasDirectContact = Boolean(service.contact_phone || service.contact_whatsapp || service.contact_email);

  return (
    <MarketplaceCard
      to={`/service/${service.id}`}
      imageUrl={service.photos?.[0]}
      imageAlt={service.title}
      title={service.title}
      priceLabel={priceLabel}
      locationLabel={service.location_name}
      attributes={attributes}
      meta={category?.label || 'Service'}
      tour={serviceTour(service)}
      tourLabel="See their work"
      sellerName={service.provider_name}
      views={service.views}
      actions={hasDirectContact ? <ContactButtons listing={service} type="service" placement="browse" /> : null}
      layout="browse"
      onOpen={onOpen}
    />
  );
}
