import { toast } from "sonner";
import { getListingCode } from "@/lib/constants";

const DETAIL_SEGMENTS = {
  property: 'property',
  car: 'car',
  machinery: 'machinery',
  service: 'service',
};

function firstShareImage(listing) {
  const candidate = Array.isArray(listing?.photos) ? listing.photos[0] : null;
  return typeof candidate === 'string' && /^https?:\/\//i.test(candidate) ? candidate : null;
}

export function createListingSharePayload(type, listing) {
  const code = getListingCode(type, listing.id);
  const segment = DETAIL_SEGMENTS[type] || type;
  const shareUrl = new URL(`/${segment}/${encodeURIComponent(listing.id)}`, window.location.origin);
  shareUrl.searchParams.set('ref', code);
  const imageUrl = firstShareImage(listing);
  const listingTitle = String(listing.title || 'PeekaListing listing').trim();
  const title = `${listingTitle} (Ref: ${code})`;
  // The URL is intentionally short. Cloudflare resolves the public listing by
  // ID and renders its Open Graph metadata for chat crawlers. Putting title,
  // description or image URLs in the query string leaks implementation detail
  // into the WhatsApp message and allows metadata spoofing.
  const text = `${listingTitle}\nListing No: ${code}`;
  return { code, title, text, shareUrl: shareUrl.toString(), imageUrl };
}

// Shares a listing, including its reference code in both the URL (?ref=) and
// share text. Abort is a normal user cancellation; all other failures are
// reported instead of claiming the link was copied.
export async function shareListing(type, listing) {
  const { code, title, text, shareUrl } = createListingSharePayload(type, listing);

  try {
    if (navigator.share) {
      await navigator.share({ title, text, url: shareUrl });
      return true;
    }
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable.');
    await navigator.clipboard.writeText(shareUrl);
    toast.success(`Link copied. Ref: ${code}`, { duration: 2000 });
    return true;
  } catch (error) {
    if (error?.name !== 'AbortError') toast.error('Could not share this listing');
    return false;
  }
}
