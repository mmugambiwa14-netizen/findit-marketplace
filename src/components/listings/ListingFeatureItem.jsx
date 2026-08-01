export default function ListingFeatureItem({ icon: Icon, label, value }) {
  return (
    <div className="clay-soft min-w-0 rounded-2xl p-3 text-center">
      <Icon className="mx-auto mb-2 h-5 w-5 text-primary" aria-hidden="true" />
      <p className="truncate text-sm font-extrabold capitalize text-foreground" title={String(value || "Not specified")}>{value || "—"}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
