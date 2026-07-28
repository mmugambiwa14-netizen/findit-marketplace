import { Button } from '@/components/ui/button';

export default function CursorPager({
  pageNumber,
  itemCount,
  itemLabel,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {itemCount.toLocaleString()} {itemLabel} on page {pageNumber}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" disabled={!canGoBack} onClick={onBack}>Previous</Button>
        <span className="min-w-16 text-center text-sm">Page {pageNumber}</span>
        <Button type="button" variant="outline" disabled={!canGoForward} onClick={onForward}>Next</Button>
      </div>
    </div>
  );
}
