import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/lib/CurrencyContext";

// Returns label for the deposit field based on listing type
function depositLabel(listingType) {
  if (listingType === "rent") return "Security Deposit";
  if (listingType === "auction") return "Bidding Deposit";
  return "Reservation Deposit";
}

export default function PriceBreakdown({ listing }) {
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);

  const price = Number(listing.price) || 0;
  const deposit = Number(listing.deposit) || 0;
  const agentFee = Number(listing.agent_fee) || 0;
  const additional = Number(listing.additional_fees) || 0;

  const hasExtras = deposit > 0 || agentFee > 0 || additional > 0;
  if (!hasExtras) return null;

  const total = price + deposit + agentFee + additional;

  const rows = [
    { label: "Base Price", value: price },
    deposit > 0 && { label: depositLabel(listing.listing_type), value: deposit, tip: "An upfront amount required to secure the item. Terms are set by the seller." },
    agentFee > 0 && { label: "Agent Fee", value: agentFee, tip: "Commission set by the seller or agent. May be negotiable." },
    additional > 0 && { label: "Additional Fees", value: additional, tip: "Administrative, service or other fees set by the seller." },
  ].filter(Boolean);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
      >
        <div className="text-left">
          <p className="text-sm font-semibold">Price Breakdown</p>
          <p className="text-xs text-muted-foreground">Total est. {format(total)}</p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                {r.label}
                {r.tip && <Info className="w-3 h-3 text-muted-foreground/70" aria-label={r.tip} />}
              </span>
              <span className="font-medium">{format(r.value)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between text-sm font-bold">
            <span>Total Estimated Cost</span>
            <span className="text-primary">{format(total)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            Estimates only. Confirm all amounts directly with the seller before any payment.
          </p>
        </div>
      )}
    </div>
  );
}
