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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { GuestPromptSheet } from '@/components/auth/GuestPromptSheet';
import MessageDialog from '@/components/listings/MessageDialog';
import { useAuth } from '@/lib/AuthContext';
import { featureFlags } from '@/lib/featureFlags';
import { cn } from '@/lib/utils';

const actionClass = 'flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-surface-secondary/45 px-4 text-left transition hover:border-primary/35 hover:bg-primary/8';

export default function ContactButtons({ listing, type = 'property', placement = 'detail' }) {
  const [contactOpen, setContactOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState('contact this seller');
  const [messageOpen, setMessageOpen] = useState(false);
  const { user } = useAuth();
  const browsePlacement = placement === 'browse';

  const typeLabel = type === 'property' ? 'Property' : type === 'car' ? 'Car' : type === 'service' ? 'Service' : 'Machinery';
  const recipientLabel = type === 'service' ? 'provider' : 'seller';
  const listingPrice = Number(listing.price);
  const priceText = Number.isFinite(listingPrice) ? ` listed at $${listingPrice.toLocaleString()}` : '';
  const enquiryText = type === 'service'
    ? `Hi, I'm interested in your service: ${listing.title}`
    : `Hi, I'm interested in your listing: ${listing.title} (${typeLabel})${priceText}`;
  const encodedMessage = encodeURIComponent(enquiryText);
  const whatsappNumber = listing.contact_whatsapp?.replace(/[^0-9]/g, '') || '';
  const phoneNumber = listing.contact_phone || '';
  const emailAddress = listing.contact_email || listing.seller_email || listing.provider_email || '';
  const emailSubject = encodeURIComponent(`Enquiry about ${type === 'service' ? 'your service' : 'your listing'}: ${listing.title}`);

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
        className="h-11 rounded-full px-4 shadow-floating"
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

  const openChat = () => {
    if (!user) {
      setContactOpen(false);
      setGuestAction('message the seller');
      setGuestOpen(true);
      return;
    }
    closeThen(() => setMessageOpen(true));
  };

  const openWhatsApp = () => closeThen(() => {
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');
  });

  const openCall = () => closeThen(() => {
    window.location.href = `tel:${phoneNumber}`;
  });

  const openEmail = () => closeThen(() => {
    toast.success(`Opening your email app to contact ${emailAddress}`);
    window.location.href = `mailto:${emailAddress}?subject=${emailSubject}&body=${encodedMessage}`;
  });

  const actions = [
    showMessage && {
      key: 'message',
      label: 'Chat in FindIt',
      description: 'Keep the listing and conversation together.',
      icon: MessageSquareText,
      onClick: openChat,
    },
    phoneNumber && {
      key: 'call',
      label: 'Call',
      description: phoneNumber,
      icon: PhoneCall,
      onClick: openCall,
    },
    whatsappNumber && {
      key: 'whatsapp',
      label: 'WhatsApp',
      description: 'Continue in WhatsApp.',
      icon: MessageCircle,
      onClick: openWhatsApp,
      iconClassName: 'bg-emerald-500/15 text-emerald-400',
    },
    emailAddress && {
      key: 'email',
      label: 'Email',
      description: emailAddress,
      icon: Mail,
      onClick: openEmail,
    },
  ].filter(Boolean);

  if (actions.length === 0) {
    if (browsePlacement) return null;
    return (
      <Button type="button" variant="outline" disabled className="h-11 rounded-full px-4 shadow-floating">
        Contact unavailable
      </Button>
    );
  }

  return (
    <>
      <Sheet open={contactOpen} onOpenChange={setContactOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            className={cn(
              'clay-button h-11 rounded-full px-4 shadow-floating',
              browsePlacement ? 'w-full rounded-xl shadow-none' : 'min-w-[7.25rem]',
            )}
            aria-label={`Contact ${recipientLabel} about ${listing.title}`}
          >
            <MessageSquareText className="h-4 w-4" />
            <span>Contact</span>
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
            <p>Never send payment before verifying the item, provider, and terms. FindIt does not hold buyer funds.</p>
          </div>
        </SheetContent>
      </Sheet>

      <GuestPromptSheet open={guestOpen} onClose={() => setGuestOpen(false)} action={guestAction} />
      {showMessage && <MessageDialog open={messageOpen} onClose={() => setMessageOpen(false)} listing={listing} type={type} />}
    </>
  );
}
