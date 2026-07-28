import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DiscoverCategoryCard({ title, description, icon: Icon, to, className = null }) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex min-h-[168px] overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-raised focus-visible:ring-offset-4 sm:min-h-[190px] sm:p-5',
        className,
      )}
    >
      <div className="absolute -bottom-12 -right-10 h-36 w-36 rounded-full bg-primary/8 blur-2xl transition-colors group-hover:bg-primary/14" aria-hidden="true" />
      <div className="relative flex w-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
        </div>
      </div>
    </Link>
  );
}
