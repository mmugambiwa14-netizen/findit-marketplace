import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * @param {{
 *   onBack?: () => void,
 *   onContinue: () => void,
 *   continueLabel?: string,
 *   backLabel?: string,
 *   loading?: boolean,
 *   disabled?: boolean,
 *   showBack?: boolean
 * }} props
 */
export default function StepNav({
  onBack,
  onContinue,
  continueLabel = "Continue",
  backLabel = "Back",
  loading = false,
  disabled = false,
  showBack = true,
}) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-8">
      {showBack && (
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 h-12 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {backLabel}
        </Button>
      )}
      <Button
        onClick={onContinue}
        disabled={disabled || loading}
        className={cn("h-12 rounded-xl font-semibold text-base shadow-sm shadow-primary/20 hover:shadow-md transition-shadow", showBack ? "flex-[2]" : "w-full")}
      >
        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {continueLabel}
      </Button>
    </div>
  );
}
