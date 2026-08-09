import { useState } from 'react';
import {
  ChevronUp,
  Mail,
  MessageCircle,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import MessageDialog from '@/components/listings/MessageDialog';
import { revealContactDetails } from '@/repositories/contactRevealRepository';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { userFacingError } from '@/lib/userFacingErrors';
import { cn } from '@/lib/utils';
import { createListingSharePayload } from '@/lib/share';

const actionClass = 'flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-surface-secondary/45 px-4 text-left transition hover:border-primary/35 hover:bg-primary/8';

export default function ContactButtons({ listing, type = 'property', placement = 'detail' }) {
  const [contactOpen, setContactOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState('contact this seller');
  const [messageOpen, setMessageOpen] = useState(false);
  const [externalAction, setExternalAction] = useState(null);
  const [openingExternal, setOpeningExternal] = useState(false);
  const { user } = useAuth();
  const browsePlacement = placement === 'browse';

  const typeLabel = type === 'property' ? 'Property' : type === 'car' ? 'Car' : type === 'service' ? 'Service' : 'Machinery';
  const recipientLabel = type === 'service' ? 'provider' : 'seller';
  const listingPrice = Number(listing.price);
  const priceText = Number.isFinite(listingPrice) ? ` listed at $${listingPrice.toLocaleString()}` : '';
  const enquiryText = type === 'service'
    ? `Hi, I'm interested in your service: ${listing.title}`
    : `Hi, I'm interested in your listing: ${listing.title} (${typeLabel})${priceText}`;
  const sharePayload = createListingSharePayload(type, listing);
  const whatsappText = [
    enquiryText,
    `Listing No: ${sharePayload.code}`,
    sharePayload.shareUrl,
  ].join('\n');
  const encodedMessage = encodeURIComponent(enquiryText);
  const encodedWhatsappMessage = encodeURIComponent(whatsappText);
  const emailSubject = encodeURIComponent(`Enquiry about ${type === 'service' ? 'your service' : 'your listing'}: ${listing.title}`);

  // Owners may receive raw values in their own management projection. Public
  // listing rows expose only has_contact_* flags. Buyers receive the selected
  // value from the authenticated, rate-limited reveal RPC only after confirming
  // an external contact action; it is never rendered in PeekaListing.
  const rawWhatsapp = listing.contact_whatsapp || '';
  const rawPhone = listing.contact_phone || '';
  const rawEmail = listing.contact_email || listing.seller_email || listing.provider_email || '';
  const canCall = Boolean(rawPhone || listing.has_contact_phone);
  const canWhatsApp = Boolean(rawWhatsapp || listing.has_contact_whatsapp);
  const canEmail = Boolean(rawEmail || listing.has_contact_email);

  const enquiryEligible = type === 'service'
    ? listing.status === 'active'
    : ['available', 'under_offer'].includes(listing.status);
  const showMessage = enquiryEligible
    && featureFlags.messaging
    && type !== 'service'
    && user?.id !== listing.seller_id;

  if (!enquiryEligible) {
    if (browsePlacement) return null;
    return (
      <Button
        type="button"
        variant="outline"
        disabled
        title="Existing chats remain available, but new enquiries are closed."
        className="h-12 w-full rounded-2xl px-5 shadow-floating md:h-11 md:w-auto md:rounded-full"
      >
        <MessageSquareText className="h-4 w-4" />
        Enquiries closed
        <span className="sr-only">Existing chats remain available, but new enquiries are closed.</span>
      </Button>
    );
  }

  const closeThen = (action) => {
    setContactOpen(false);
    window.setTimeout(action, 0);
  };

  const handleContactOpenChange = (next) => {
    if (next && !user) {
      setGuestAction(`contact this ${recipientLabel}`);
      setGuestOpen(true);
      return;
    }
    setContactOpen(next);
  };

  const openChat = () => {
    if (!user) {
      setContactOpen(false);
      setGuestAction('message the seller');
      setGuestOpen(true);
      return;
    }
    closeThen(() => setMessageOpen(true));
  };

  const requestExternalAction = (kind) => {
    setContactOpen(false);
    window.setTimeout(() => setExternalAction(kind), 0);
  };

  const revealForAction = async () => {
    if (!externalAction || openingExternal) return;
    setOpeningExternal(true);
    try {
      const revealed = (rawPhone || rawWhatsapp || rawEmail)
        ? { contact_phone: rawPhone, contact_whatsapp: rawWhatsapp, contact_email: rawEmail }
        : await revealContactDetails(type, listing.id);

      if (externalAction === 'call') {
        const phone = String(revealed?.contact_phone || '').trim();
        if (!phone) throw new Error('Phone contact is unavailable.');
        window.location.assign(`tel:${phone}`);
      } else if (externalAction === 'email') {
        const email = String(revealed?.contact_email || '').trim();
        if (!email) throw new Error('Email contact is unavailable.');
        window.location.assign(`mailto:${email}?subject=${emailSubject}&body=${encodedMessage}`);
      } else if (externalAction === 'whatsapp') {
        const whatsapp = String(revealed?.contact_whatsapp || '').replace(/[^0-9]/g, '');
        if (!whatsapp) throw new Error('WhatsApp contact is unavailable.');
        // WhatsApp reads the listing-specific Open Graph card rendered by the
        // Cloudflare share URL; the raw image URL must not be pasted into chat.
        window.open(`https://wa.me/${whatsapp}?text=${encodedWhatsappMessage}`, '_blank', 'noopener,noreferrer');
      }
      setExternalAction(null);
    } catch (failure) {
      toast.error(userFacingError(failure, 'We could not open this contact method. Please try again.'));
    } finally {
      setOpeningExternal(false);
    }
  };

  const actions = [
    showMessage && {
      key: 'message',
      label: 'Chat in PeekaListing',
      description: 'Keep your contact details private in PeekaListing.',
      icon: MessageSquareText,
      onClick: openChat,
    },
    canCall && {
      key: 'call',
      label: 'Call',
      description: 'Open your phone app.',
      icon: PhoneCall,
      onClick: () => requestExternalAction('call'),
    },
    canWhatsApp && {
      key: 'whatsapp',
      label: 'WhatsApp',
      description: 'Continue in WhatsApp.',
      icon: MessageCircle,
      onClick: () => requestExternalAction('whatsapp'),
      iconClassName: 'bg-emerald-500/15 text-emerald-400',
    },
    canEmail && {
      key: 'email',
      label: 'Email',
      description: 'Open your email app.',
      icon: Mail,
      onClick: () => requestExternalAction('email'),
    },
  ].filter(Boolean);

  if (actions.length === 0) {
    if (browsePlacement) return null;
    return (
      <Button type="button" variant="outline" disabled className="h-12 w-full rounded-2xl px-5 shadow-floating md:h-11 md:w-auto md:rounded-full">
        Contact unavailable
      </Button>
    );
  }

  const actionCopy = externalAction === 'call'
    ? {
        title: `Call this ${recipientLabel}?`,
        description: `PeekaListing will open your phone app. The ${recipientLabel}'s phone number will be visible there, but it will not be displayed inside PeekaListing.`,
        confirm: 'Open phone app',
      }
    : externalAction === 'email'
      ? {
          title: `Email this ${recipientLabel}?`,
          description: `PeekaListing will open your email app. The ${recipientLabel}'s email address will be visible there, but it will not be displayed inside PeekaListing.`,
          confirm: 'Open email app',
        }
      : {
          title: 'Open WhatsApp?',
          description: `PeekaListing will open WhatsApp. The ${recipientLabel}'s number may be visible there, but it will not be displayed inside PeekaListing.`,
          confirm: 'Open WhatsApp',
        };

  return (
    <>
      <Sheet open={contactOpen} onOpenChange={handleContactOpenChange}>
        <SheetTrigger asChild>
          <Button
            type="button"
            className={cn(
              'clay-button px-5 font-bold',
              browsePlacement
                ? 'h-11 w-full rounded-xl shadow-none'
                : 'h-12 w-full rounded-2xl shadow-floating md:h-11 md:w-auto md:min-w-[9rem] md:rounded-full',
            )}
            aria-label={`Contact ${recipientLabel} about ${listing.title}`}
          >
            <MessageSquareText className="h-4 w-4" />
            <span>Contact {recipientLabel}</span>
            {!browsePlacement && <ChevronUp className="h-4 w-4 opacity-75" />}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="mx-auto max-h-[88dvh] max-w-xl overflow-y-auto rounded-t-[1.75rem] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5">
          <SheetHeader className="pr-12 text-left">
            <SheetTitle>Contact the {recipientLabel}</SheetTitle>
            <SheetDescription className="line-clamp-2">Choose how to ask about {listing.title}.</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-2">
            {actions.map(({ key, label, description, icon: Icon, iconClassName, onClick }) => (
              <button key={key} type="button" onClick={onClick} className={actionClass}>
                <span className={cn('locked-icon-tile h-10 w-10', iconClassName)}><Icon className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-foreground">{label}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-primary/8 p-3 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>Phone numbers and email addresses stay hidden in PeekaListing. They become visible only in the external app you choose to open.</p>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(externalAction)} onOpenChange={(open) => { if (!open && !openingExternal) setExternalAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionCopy.title}</AlertDialogTitle>
            <AlertDialogDescription>{actionCopy.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {externalAction === 'whatsapp' && sharePayload.imageUrl && (
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-2">
              <img src={sharePayload.imageUrl} alt="Listing preview" loading="lazy" decoding="async" className="h-16 w-20 rounded-lg object-cover" />
              <p className="line-clamp-2 text-xs font-semibold text-foreground">WhatsApp will create a preview card for this listing link.</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={openingExternal}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={revealForAction} disabled={openingExternal}>
              {openingExternal ? 'Opening…' : actionCopy.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} />
      {showMessage && <MessageDialog open={messageOpen} onClose={() => setMessageOpen(false)} listing={listing} type={type} />}
    </>
  );
}
