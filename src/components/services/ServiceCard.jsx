import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Briefcase, Car, ImageOff, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import ContactButtons from '@/components/listings/ContactButtons';
import MarketplaceCard from '@/components/marketplace/MarketplaceCard';
import { useGuestGuard } from '@/hooks/useGuestGuard';
import { useAuth } from '@/lib/AuthContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';
import { addServiceFavourite, removeServiceFavourite } from '@/services/serviceFavouritesService';

function serviceTour(service) {
  if (service.tour) return service.tour;
  if (!service.hasTour && !service.has_tour && !service.tour_status) return null;
  return {
    status: service.tour_status || 'ready',
    durationSeconds: service.tour_duration_seconds,
    thumbnailUrl: service.tour_thumbnail_url,
  };
}

export default function ServiceCard({ service, onOpen = null, layout = 'browse', className = null, isSaved = false, onSave = null }) {
  const { format } = useCurrency();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { guestOpen, guestAction, guard, closeGuest } = useGuestGuard();
  const [saved, setSaved] = useState(Boolean(isSaved));
  const [saving, setSaving] = useState(false);
  useEffect(() => setSaved(Boolean(isSaved)), [isSaved]);
  const priceLabel = service.pricing_type === 'quote' || !service.price
    ? 'Contact for quote'
    : `${service.pricing_type === 'starting_from' ? 'From ' : ''}${format(service.price)}${service.pricing_type === 'hourly' ? '/hr' : ''}`;
  const subcategory = service.subcategory_label || service.subcategory_labels?.[0] || null;
  const attributes = [
    subcategory && { icon: Briefcase, label: subcategory },
    service.can_travel && { icon: Car, label: 'Travels to customers' },
  ].filter(Boolean);
  // Public rows carry only the has_contact_* flags; owner rows also carry the
  // values. Either is enough to know the affordance should render.
  const hasDirectContact = Boolean(
    service.contact_phone || service.contact_whatsapp || service.contact_email
    || service.has_contact_phone || service.has_contact_whatsapp || service.has_contact_email
  );

  const toggleSave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;
    guard('save services', async () => {
      if (!user?.id) return;
      const nextSaved = !saved;
      setSaving(true);
      setSaved(nextSaved);
      try {
        if (nextSaved) await addServiceFavourite(user.id, service.id);
        else await removeServiceFavourite(user.id, service.id);
        onSave?.(nextSaved);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['service-favourite', user.id, service.id] }),
          queryClient.invalidateQueries({ queryKey: ['service-favourites', user.id] }),
          queryClient.invalidateQueries({ queryKey: ['favourite-services', user.id] }),
        ]);
        toast.success(nextSaved ? 'Saved' : 'Removed from saved');
      } catch (error) {
        setSaved(!nextSaved);
        toast.error(error.message || 'Could not update saved services.');
      } finally {
        setSaving(false);
      }
    });
  };

  if (layout === 'recommendation') {
    return (
      <article className={cn('w-[16.5rem] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card shadow-none transition-colors hover:border-border-strong sm:w-[18rem]', className)}>
        <Link to={`/service/${service.id}`} onClick={onOpen} className="grid min-h-[8.75rem] grid-cols-[6.25rem_minmax(0,1fr)] focus-visible:ring-inset sm:grid-cols-[7rem_minmax(0,1fr)]">
          <div className="relative overflow-hidden bg-surface-secondary">
            {service.photos?.[0] ? (
              <img src={service.photos[0]} alt={service.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.035]" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-muted-foreground"><ImageOff className="h-6 w-6" /></span>
            )}
          </div>
          <div className="flex min-w-0 flex-col p-3">
            <p className="line-clamp-2 text-sm font-bold leading-5 text-foreground">{service.title}</p>
            {service.provider_name && <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{service.provider_name}</p>}
            {service.location_name && (
              <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{service.location_name}</span>
              </p>
            )}
            <div className="mt-auto flex items-end justify-between gap-2 pt-2">
              <p className="min-w-0 truncate text-sm font-extrabold text-foreground">{priceLabel}</p>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">View <ArrowUpRight className="h-3.5 w-3.5" /></span>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <>
      <MarketplaceCard
        to={`/service/${service.id}`}
        imageUrl={service.photos?.[0]}
        imageAlt={service.title}
        title={service.title}
        priceLabel={priceLabel}
        locationLabel={service.location_name}
        attributes={attributes}
        meta={service.category_label || 'Service'}
        save={layout === 'recommendation' ? null : { active: saved, onToggle: toggleSave, disabled: saving }}
        tour={serviceTour(service)}
        tourLabel="Peek"
        sellerName={service.provider_name}
        sellerLabel="Provider"
        actions={hasDirectContact ? <ContactButtons listing={service} type="service" placement="browse" /> : null}
        layout={layout}
        className={className}
        onOpen={onOpen}
      />
      <GuestPromptSheet open={guestOpen} onClose={closeGuest} action={guestAction} />
    </>
  );
}
