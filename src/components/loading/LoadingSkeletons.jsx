import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const DEFAULT_ROW_WIDTHS = ['w-4/5', 'w-2/3', 'w-3/4', 'w-1/2', 'w-5/6', 'w-3/5'];
const MAP_SKELETON_MARKERS = [['18%', '27%'], ['66%', '22%'], ['43%', '52%'], ['73%', '68%'], ['25%', '76%']];

export function PageHeaderSkeleton({ className = '' }) {
  return (
    <div className={cn('flex min-h-[72px] items-center gap-3 border-b border-border px-4 py-3', className)} aria-hidden="true">
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-2/3" />
      </div>
      <Skeleton className="h-10 w-20 shrink-0 rounded-xl" />
    </div>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card" aria-hidden="true">
      <div className="grid min-h-[12rem] grid-cols-[10.25rem_minmax(0,1fr)] sm:block sm:min-h-0">
        <Skeleton className="h-full min-h-[12rem] rounded-none sm:aspect-[4/3] sm:min-h-0" />
        <div className="space-y-2.5 p-3">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-5 w-3/5 sm:w-5/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <Skeleton className="h-11 rounded-none border-t border-border bg-muted/50" />
      <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
        <Skeleton className="h-14 rounded-none bg-muted/50" />
        <Skeleton className="h-14 rounded-none bg-muted/50" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 8, className = '', label = 'Loading listings' }) {
  return (
    <SkeletonRegion
      label={label}
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4', className)}
    >
      {Array.from({ length: count }, (_, index) => <ListingCardSkeleton key={index} />)}
    </SkeletonRegion>
  );
}

export function ListRowsSkeleton({ rows = 6, className = '', label = 'Loading items', showThumbnail = true, announce = true }) {
  const content = Array.from({ length: rows }, (_, index) => (
    <div key={index} className="locked-list-row flex min-h-20 items-center gap-3 p-3.5">
      {showThumbnail && <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className={cn('h-4', DEFAULT_ROW_WIDTHS[index % DEFAULT_ROW_WIDTHS.length])} />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
    </div>
  ));

  if (!announce) {
    return (
      <div className={cn('space-y-2.5', className)} aria-hidden="true">
        {content}
      </div>
    );
  }

  return (
    <SkeletonRegion label={label} className={cn('space-y-2.5', className)}>
      {content}
    </SkeletonRegion>
  );
}

export function ProfilePageSkeleton({ label = 'Loading profile', className = '' }) {
  return (
    <SkeletonRegion label={label} className={cn('mx-auto w-full max-w-3xl px-4 py-5', className)}>
      <div className="surface-panel p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 shrink-0 rounded-3xl" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      </div>
      <ListRowsSkeleton rows={5} className="mt-5" label={`${label} options`} announce={false} />
    </SkeletonRegion>
  );
}

export function DetailPageSkeleton({ label = 'Loading listing' }) {
  return (
    <SkeletonRegion label={label} className="min-h-[100dvh] bg-background pb-28">
      <div className="mx-auto max-w-4xl">
        <div className="relative">
          <Skeleton className="aspect-[4/3] w-full rounded-none sm:aspect-[16/9] sm:rounded-b-3xl" />
          <Skeleton className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] h-11 w-11 rounded-full bg-card/80" />
        </div>
        <div className="space-y-4 px-4 py-4">
          <section className="surface-panel space-y-3 p-5">
            <div className="flex gap-2"><Skeleton className="h-6 w-24 rounded-full" /><Skeleton className="h-6 w-32 rounded-full" /></div>
            <Skeleton className="h-8 w-2/5" />
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="h-5 w-2/5" />
          </section>
          <div className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card p-1.5">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-11" />)}
          </div>
          <section className="surface-panel space-y-3 p-5">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center justify-between gap-5 py-1">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className={cn('h-4', index % 2 === 0 ? 'w-1/3' : 'w-1/4')} />
              </div>
            ))}
          </section>
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function FormSkeleton({ fields = 5, label = 'Loading form', className = '' }) {
  return (
    <SkeletonRegion label={label} className={cn('space-y-5', className)}>
      <div className="space-y-2"><Skeleton className="h-7 w-2/5" /><Skeleton className="h-4 w-4/5" /></div>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className={cn('h-4', index % 2 === 0 ? 'w-28' : 'w-36')} />
          <Skeleton className={cn(index === fields - 1 ? 'h-28' : 'h-12', 'w-full')} />
        </div>
      ))}
      <Skeleton className="h-12 w-full" />
    </SkeletonRegion>
  );
}

export function MapPanelSkeleton({ className = '', label = 'Loading map listings' }) {
  return (
    <SkeletonRegion label={label} className={cn('locked-map-panel relative min-h-[540px] overflow-hidden', className)}>
      <Skeleton className="absolute inset-0 rounded-none bg-muted/50" />
      <div className="absolute left-4 top-4 rounded-2xl border border-border bg-card/85 p-3 shadow-card">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-3 w-40" />
      </div>
      {MAP_SKELETON_MARKERS.map(([left, top], index) => (
        <Skeleton key={index} className="absolute h-10 w-10 rounded-full border-4 border-background bg-primary/30" style={{ left, top }} />
      ))}
      <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-border bg-card/90 p-3 shadow-floating">
        <div className="flex gap-3"><Skeleton className="h-20 w-24 shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-5 w-2/5" /><Skeleton className="h-4 w-3/5" /></div></div>
      </div>
    </SkeletonRegion>
  );
}

export function MapCanvasSkeleton({ label = 'Loading map' }) {
  return (
    <SkeletonRegion label={label} className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-background">
      <Skeleton className="absolute inset-0 rounded-none bg-muted/50" />
      <div className="absolute left-3 top-3 rounded-xl border border-border bg-card/90 p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-3 w-36" />
      </div>
      {MAP_SKELETON_MARKERS.map(([left, top], index) => (
        <Skeleton key={index} className="absolute h-9 w-9 rounded-full border-4 border-background bg-primary/30" style={{ left, top }} />
      ))}
    </SkeletonRegion>
  );
}

export function ConversationListSkeleton({ rows = 7 }) {
  return <ListRowsSkeleton rows={rows} label="Loading chats" className="mt-5" />;
}

export function ConversationThreadSkeleton() {
  return (
    <SkeletonRegion label="Loading conversation" className="fixed inset-0 z-30 flex h-[100dvh] flex-col overflow-hidden bg-background">
      <div className="flex min-h-[76px] items-center gap-3 border-b border-border px-4 py-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <div className="flex-1 space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-52 max-w-full" /></div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
      <div className="flex-1 space-y-4 overflow-hidden px-4 py-5">
        <Skeleton className="ml-auto h-16 w-3/4 max-w-md rounded-3xl rounded-br-md" />
        <Skeleton className="h-20 w-4/5 max-w-md rounded-3xl rounded-bl-md" />
        <Skeleton className="ml-auto h-12 w-1/2 max-w-sm rounded-3xl rounded-br-md" />
        <Skeleton className="h-24 w-3/4 max-w-md rounded-3xl rounded-bl-md" />
      </div>
      <div className="flex gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Skeleton className="h-12 flex-1 rounded-2xl" />
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    </SkeletonRegion>
  );
}

export function NotificationListSkeleton({ rows = 7, announce = true }) {
  const content = Array.from({ length: rows }, (_, index) => (
    <div key={index} className="flex min-h-24 items-start gap-3 px-4 py-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className={cn('h-4', DEFAULT_ROW_WIDTHS[index % DEFAULT_ROW_WIDTHS.length])} /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-20" /></div>
    </div>
  ));

  if (!announce) return <div className="divide-y divide-border" aria-hidden="true">{content}</div>;

  return <SkeletonRegion label="Loading notifications" className="divide-y divide-border">{content}</SkeletonRegion>;
}

export function PeekFeedSkeleton() {
  return (
    <SkeletonRegion label="Loading Peeks" className="relative h-full min-h-[560px] overflow-hidden bg-black">
      <Skeleton className="absolute inset-0 rounded-none bg-white/10" />
      <div className="absolute inset-x-4 bottom-24 space-y-3">
        <Skeleton className="h-4 w-24 bg-white/20" />
        <Skeleton className="h-7 w-4/5 max-w-lg bg-white/20" />
        <Skeleton className="h-4 w-3/5 max-w-md bg-white/20" />
        <Skeleton className="h-12 w-44 rounded-full bg-white/20" />
      </div>
      <div className="absolute bottom-24 right-4 space-y-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-12 w-12 rounded-full bg-white/20" />)}
      </div>
    </SkeletonRegion>
  );
}

export function TableRowsSkeleton({ columns = 6, rows = 6, label = 'Loading table data' }) {
  return Array.from({ length: rows }, (_, rowIndex) => (
    <tr key={rowIndex} className="border-b last:border-0">
      {Array.from({ length: columns }, (_, columnIndex) => (
        <td key={columnIndex} className="p-3">
          {rowIndex === 0 && columnIndex === 0 && <span className="sr-only" role="status" aria-live="polite">{label}</span>}
          <Skeleton className={cn('h-4', DEFAULT_ROW_WIDTHS[(rowIndex + columnIndex) % DEFAULT_ROW_WIDTHS.length])} />
          {columnIndex === 0 && <Skeleton className="mt-2 h-3 w-2/5" />}
        </td>
      ))}
    </tr>
  ));
}

export function AdminCardsSkeleton({ count = 4, label = 'Loading dashboard' }) {
  return (
    <SkeletonRegion label={label} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-8 rounded-full" /></div>
          <Skeleton className="mt-5 h-9 w-20" />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function AppShellSkeleton() {
  return (
    <SkeletonRegion label="Loading PeekaListing" className="fixed inset-0 z-[100] overflow-hidden bg-background">
      <div className="mx-auto flex h-full max-w-5xl flex-col">
        <div className="flex min-h-[76px] items-center gap-3 border-b border-border px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Skeleton className="h-10 w-40" />
          <div className="flex-1" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        <main className="min-h-0 flex-1 overflow-hidden px-4 py-5">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <div className="mt-4 grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
          </div>
          <div className="mt-6 flex items-center justify-between"><Skeleton className="h-6 w-36" /><Skeleton className="h-4 w-16" /></div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => <ListingCardSkeleton key={index} />)}
          </div>
        </main>
        <div className="grid grid-cols-5 gap-3 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="flex flex-col items-center gap-1.5"><Skeleton className={cn('h-8 w-8 rounded-full', index === 2 && 'h-12 w-12')} /><Skeleton className="h-2.5 w-10" /></div>)}
        </div>
      </div>
    </SkeletonRegion>
  );
}
