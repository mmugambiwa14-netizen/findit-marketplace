import ListingMediaViewer from "@/components/listings/ListingMediaViewer";
import { getListingPlaceholder } from "@/lib/listingPlaceholders";

const placeholderProperty = getListingPlaceholder("property");

export default function ImageGallery({ photos = [], alt = "Listing", fallbackImage = placeholderProperty, tour = null, tourActionLabel }) {
  return (
    <ListingMediaViewer
      photos={photos}
      title={alt}
      fallbackImage={fallbackImage}
      tour={tour}
      tourActionLabel={tourActionLabel}
    />
  );
}
