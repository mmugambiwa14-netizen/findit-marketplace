export default function ListingFeatureItem({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-border/70 py-3 last:border-b-0 sm:rounded-xl sm:border sm:bg-card sm:px-4 sm:last:border-b">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold capitalize text-foreground" title={String(value || 'Not specified')}>{value || '—'}</p>
      </div>
    </div>
  );
}
