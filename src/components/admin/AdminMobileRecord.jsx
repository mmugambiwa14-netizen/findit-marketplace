import { Card } from '@/components/ui/card';

export function AdminMobileList({ label, children }) {
  return (
    <div className="space-y-3 md:hidden" aria-label={label}>
      {children}
    </div>
  );
}

export function AdminMobileRecord({ heading, summary = null, badges = null, fields = [], actions = null }) {
  const visibleFields = fields.filter((field) => field?.value !== undefined && field?.value !== null && field?.value !== '');

  return (
    <Card className="space-y-4 p-4">
      <div className="min-w-0">
        <div className="min-w-0 text-base font-bold leading-6">{heading}</div>
        {summary && <div className="mt-1 text-xs leading-5 text-muted-foreground">{summary}</div>}
        {badges && <div className="mt-2 flex flex-wrap gap-2">{badges}</div>}
      </div>
      {visibleFields.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {visibleFields.map((field) => (
            <div key={field.label} className={field.wide ? 'col-span-2 min-w-0' : 'min-w-0'}>
              <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{field.label}</dt>
              <dd className="mt-0.5 min-w-0 break-words text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="flex flex-wrap gap-2 border-t border-border pt-3">{actions}</div>}
    </Card>
  );
}
