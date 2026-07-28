export default function ListingFeatureItem({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3 text-center">
      <Icon className="mx-auto mb-2 h-5 w-5 text-primary" aria-hidden="true" />
      <p className="truncate text-sm font-semibold capitalize text-foreground" title={String(value || "Not specified")}>{value || "—"}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
