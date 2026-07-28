import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bath, Bed, Calendar, Gauge, Maximize, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import MarketplaceCard from '@/components/marketplace/MarketplaceCard';
import ListingCode from '@/components/listings/ListingCode';
import { useAuth } from '@/lib/AuthContext';
import { getCategoryLabel, getMachineryLabel } from '@/lib/constants';
import { getListingPlaceholder } from '@/lib/listingPlaceholders';
import { useCurrency } from '@/lib/CurrencyContext';
import { addFavourite, removeFavourite } from '@/services/favouritesService';


const DETAIL_PATHS = {
  property: 'property',
  car: 'car',
  machinery: 'machinery',
};

function statusLabel(status) {
  if (!status || status === 'available') return null;
  return {
    under_offer: 'Under offer',
    sold: 'Sold',
    rented: 'Rented',
    hired: 'Hired',
    expired: 'Expired',
  }[status] || status.replaceAll('_', ' ');
}

function listingAttributes(listing, type) {
  if (type === 'property') {
    return [
      listing.bedrooms > 0 && { icon: Bed, label: `${listing.bedrooms} bed` },
      listing.bathrooms > 0 && { icon: Bath, label: `${listing.bathrooms} bath` },
      listing.property_size > 0 && { icon: Maximize, label: `${Number(listing.property_size).toLocaleString()} m²` },
    ].filter(Boolean);
  }

  if (type === 'car') {
    return [
      listing.year && { icon: Calendar, label: String(listing.year) },
      Number.isFinite(Number(listing.mileage)) && { icon: Gauge, label: `${Number(listing.mileage).toLocaleString()} km` },
      listing.transmission && { icon: Settings, label: listing.transmission },
    ].filter(Boolean);
  }

  return [
    listing.year && { icon: Calendar, label: String(listing.year) },
    Number(listing.equipment_hours) > 0 && { icon: Gauge, label: `${Number(listing.equipment_hours).toLocaleString()} h` },
    listing.condition && { icon: Settings, label: listing.condition },
  ].filter(Boolean);
}

function tourSummary(listing) {
  if (listing.tour) return listing.tour;
  if (!listing.hasTour && !listing.has_tour && !listing.tour_status) return null;
  return {
    status: listing.tour_status || 'ready',
    durationSeconds: listing.tour_duration_seconds,
    thumbnailUrl: listing.tour_thumbnail_url,
  };
}

export default function ListingCard({ listing, type = 'property', onSave = null, isSaved = false }) {
  const [liked, setLiked] = useState(isSaved);
  const [guestOpen, setGuestOpen] = useState(false);
  const { user } = useAuth();
  const { format } = useCurrency();
  const queryClient = useQueryClient();

  useEffect(() => setLiked(isSaved), [isSaved]);

  const toggleLike = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!user) {
      setGuestOpen(true);
      return;
    }

    try {
      if (liked) await removeFavourite(user.id, listing.id);
      else await addFavourite(user.id, listing.id);
      const nextLiked = !liked;
      setLiked(nextLiked);
      queryClient.invalidateQueries({ queryKey: ['favourites', user.id] });
      queryClient.invalidateQueries({ queryKey: ['favourite', user.id, listing.id] });
      queryClient.invalidateQueries({ queryKey: ['favourite-listings', user.id] });
      onSave?.(listing.id, nextLiked);
      toast.success(nextLiked ? 'Added to saved' : 'Removed from saved');
    } catch {
      toast.error('Error saving listing');
    }
  };

  const variants = (listing.variants || []).filter((variant) => variant && Number(variant.price) > 0);
  const prefix = variants.length > 1 ? 'From ' : '';
  const location = [listing.suburb, listing.city].filter(Boolean).join(', ');
  const categoryMeta = type === 'property'
    ? getCategoryLabel(listing.category)
    : type === 'machinery'
      ? getMachineryLabel(listing.category)
      : [listing.make, listing.model].filter(Boolean).join(' ');
  const availability = statusLabel(listing.status);
  const badges = [
    listing.is_featured && { label: 'Featured' },
    availability && { label: availability, variant: 'destructive' },
  ].filter(Boolean);

  return (
    <>
      <MarketplaceCard
        to={`/${DETAIL_PATHS[type]}/${listing.id}`}
        imageUrl={listing.photos?.[0]}
        fallbackImageUrl={getListingPlaceholder(type)}
        imageAlt={listing.title}
        title={listing.title}
        priceLabel={`${prefix}${format(listing.price)}`}
        locationLabel={location}
        attributes={listingAttributes(listing, type)}
        meta={categoryMeta}
        codeNode={<ListingCode type={type} id={listing.id} className="mt-1" />}
        badges={badges}
        save={{ active: liked, onToggle: toggleLike }}
        tour={tourSummary(listing)}
      />
      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action="save listings and contact sellers" returnTo={`/${DETAIL_PATHS[type]}/${listing.id}`} />
    </>
  );
}
