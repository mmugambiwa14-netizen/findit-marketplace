import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { getListingCode } from "@/lib/constants";

/**
 * Shows the stable listing reference code (e.g. PR-A1B2, CAR-9K3J, MAC-7X2P).
 * type: "property" | "car" | "machinery"
 */
/**
 * @param {{ type: string, id: string, className?: string }} props
 */
export default function ListingCode({ type, id, className }) {
  const code = getListingCode(type, id);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold tracking-wide",
        "text-muted-foreground bg-muted rounded px-1.5 py-0.5",
        className
      )}
    >
      <Hash className="w-2.5 h-2.5" />
      {code}
    </span>
  );
}
