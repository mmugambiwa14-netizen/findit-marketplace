import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminQueryError({ error, onRetry, message = 'This admin data could not be loaded.' }) {
  if (!error) return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/8 p-4 sm:flex-row sm:items-center" role="alert">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{message}</p>
        <p className="mt-1 text-xs text-muted-foreground">Try again. Reference: {error.correlationId || 'unavailable'}</p>
      </div>
      {onRetry && <Button type="button" size="sm" variant="outline" onClick={onRetry}><RotateCw className="mr-1 h-4 w-4" />Retry</Button>}
    </div>
  );
}
