import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function StepNav({
  onBack,
  onContinue,
  continueLabel = 'Continue',
  backLabel = 'Back',
  loading = false,
  disabled = false,
  showBack = true,
}) {
  return (
    <div className="flex items-center gap-3 pb-8 pt-4">
      {showBack && (
        <Button variant="outline" onClick={onBack} className="clay-control h-12 flex-1 rounded-xl">
          <ArrowLeft className="mr-1 h-4 w-4" />{backLabel}
        </Button>
      )}
      <Button onClick={onContinue} disabled={disabled || loading} className={cn('clay-button h-12 rounded-xl text-base font-bold', showBack ? 'flex-[2]' : 'w-full')}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {continueLabel}
        {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  );
}
