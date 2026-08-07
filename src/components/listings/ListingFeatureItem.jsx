export default function ListingFeatureItem({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-3.5 shadow-sm transition hover:border-primary/25">
      <span className="locked-icon-tile h-10 w-10">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-extrabold capitalize text-foreground" title={String(value || 'Not specified')}>{value || '—'}</p>
      </div>
    </div>
  );
}
