import { useState } from "react";
import { Phone, MessageCircle, Mail, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestPromptSheet } from "@/components/auth/GuestPromptSheet";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import MessageDialog from "@/components/listings/MessageDialog";
import { featureFlags } from "@/lib/featureFlags";

export default function ContactButtons({ listing, type = "property", placement = "detail" }) {
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState("contact this seller");
  const [messageOpen, setMessageOpen] = useState(false);
  const { user } = useAuth();
  const browsePlacement = placement === "browse";

  const typeLabel = type === "property" ? "Property" : type === "car" ? "Car" : type === "service" ? "Service" : "Machinery";
  const whatsappMsg = encodeURIComponent(
    type === "service"
      ? `Hi, I'm interested in your service: ${listing.title}`
      : `Hi, I'm interested in your listing: ${listing.title} (${typeLabel}) listed at $${listing.price?.toLocaleString()}`
  );

  const whatsappNumber = listing.contact_whatsapp?.replace(/[^0-9]/g, "") || "";
  const phoneNumber = listing.contact_phone || "";
  const emailAddress = listing.contact_email || listing.seller_email || listing.provider_email || "";

  const emailSubject = encodeURIComponent(
    type === "service"
      ? `Enquiry about your service: ${listing.title}`
      : `Enquiry about your listing: ${listing.title}`
  );
  const emailBody = encodeURIComponent(
    type === "service"
      ? `Hi, I'm interested in your service: ${listing.title}`
      : `Hi, I'm interested in your listing: ${listing.title} (${typeLabel}) listed at $${listing.price?.toLocaleString()}`
  );

  const requireAuth = (action, fn) => {
    if (!user) {
      setGuestAction(action);
      setGuestOpen(true);
      return;
    }
    fn();
  };

  const showWhatsApp = Boolean(whatsappNumber);
  const showCall = Boolean(phoneNumber);
  const showEmail = Boolean(emailAddress);
  const enquiryEligible = type === "service"
    ? listing.status === "active"
    : ["available", "under_offer"].includes(listing.status);
  const showMessage = enquiryEligible && featureFlags.messaging && type !== "service" && user?.id !== listing.seller_id;

  if (!enquiryEligible) {
    if (browsePlacement) return null;
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-center">
        <p className="text-sm font-semibold text-foreground">This {type === "service" ? "service" : "listing"} is unavailable</p>
        <p className="mt-1 text-xs text-muted-foreground">Existing chats remain available, but new enquiries are closed.</p>
      </div>
    );
  }

  if (browsePlacement) {
    const actionCount = Number(showCall) + Number(showMessage);
    if (actionCount === 0) return null;

    return (
      <>
        <div className={`grid gap-2 ${actionCount === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
          {showCall && (
            <Button
              type="button"
              className="h-11 min-w-0 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              onClick={() => { window.location.href = `tel:${phoneNumber}`; }}
            >
              <Phone className="mr-2 h-4 w-4 shrink-0" />
              Call
            </Button>
          )}
          {showMessage && (
            <Button
              type="button"
              className="h-11 min-w-0 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              onClick={() => requireAuth("message the seller", () => setMessageOpen(true))}
            >
              <MessagesSquare className="mr-2 h-4 w-4 shrink-0" />
              Message
            </Button>
          )}
        </div>
        <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} />
        {showMessage && <MessageDialog open={messageOpen} onClose={() => setMessageOpen(false)} listing={listing} type={type} />}
      </>
    );
  }

  if (!showMessage && !showWhatsApp && !showCall && !showEmail) {
    return (
      <div className="py-2 text-center text-sm text-muted-foreground">
        Contact details not available. Please check back later.
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-1.5">
        {showMessage && (
          <Button
            className="h-12 min-w-0 flex-1 rounded-xl px-2 text-xs sm:text-sm"
            onClick={() => requireAuth("message the seller", () => setMessageOpen(true))}
          >
            <MessagesSquare className="hidden h-4 w-4 sm:mr-2 sm:block" />
            Message
          </Button>
        )}
        {showWhatsApp && (
          <Button
            className="h-12 min-w-0 flex-1 rounded-xl bg-green-600 px-2 text-xs text-white hover:bg-green-700 sm:text-sm"
            onClick={() => window.open(`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`, "_blank", "noopener,noreferrer")}
          >
            <MessageCircle className="hidden h-4 w-4 sm:mr-2 sm:block" />
            WhatsApp
          </Button>
        )}
        {showCall && (
          <Button
            variant="outline"
            className="h-12 min-w-0 flex-1 rounded-xl px-2 text-xs sm:text-sm"
            onClick={() => { window.location.href = `tel:${phoneNumber}`; }}
          >
            <Phone className="hidden h-4 w-4 sm:mr-2 sm:block" />
            Call
          </Button>
        )}
        {showEmail && (
          <Button
            variant="outline"
            className="h-12 min-w-0 flex-1 rounded-xl px-2 text-xs sm:text-sm"
            onClick={() => {
              toast.success(`Opening your email app to contact ${emailAddress}`);
              window.location.href = `mailto:${emailAddress}?subject=${emailSubject}&body=${emailBody}`;
            }}
          >
            <Mail className="hidden h-4 w-4 sm:mr-2 sm:block" />
            Email
          </Button>
        )}
      </div>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} />
      {showMessage && <MessageDialog open={messageOpen} onClose={() => setMessageOpen(false)} listing={listing} type={type} />}
    </>
  );
}
