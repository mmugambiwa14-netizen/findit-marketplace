import { toast } from "sonner";
import { getListingCode } from "@/lib/constants";

// Shares a listing, including its reference code in both the URL (?ref=) and
// share text. Abort is a normal user cancellation; all other failures are
// reported instead of claiming the link was copied.
export async function shareListing(type, listing) {
  const code = getListingCode(type, listing.id);
  const url = new URL(window.location.href);
  url.searchParams.set("ref", code);
  const shareUrl = url.toString();
  const title = `${listing.title} (Ref: ${code})`;
  const text = `${listing.title}\nListing No: ${code}\n${shareUrl}`;

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
