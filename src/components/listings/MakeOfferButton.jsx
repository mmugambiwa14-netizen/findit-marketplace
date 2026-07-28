import { useState } from "react";
import { Tag, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Lightweight "Accept Offers" indicator + disclaimer modal.
// Does not submit an offer — it informs the buyer and points them to the contact buttons.
export default function MakeOfferButton({ listing }) {
  const [open, setOpen] = useState(false);
  if (!listing?.accepts_offers) return null;

  return (
    <>
      <button type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-accent/15 text-accent-foreground border border-accent/30 hover:bg-accent/25 transition-colors"
      >
        <Tag className="w-3.5 h-3.5" /> Open to offers
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" /> Making an Offer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              This seller is open to offers below the listed price. Use the contact options to
              send the seller your proposed price.
            </p>
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
              <p className="text-xs">
                Any offer is <strong>non-binding</strong> and subject to seller acceptance. Always
                inspect the item in person before paying. FINDit does not handle payments between
                buyers and sellers.
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(false)} className="w-full mt-2">Got it</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}