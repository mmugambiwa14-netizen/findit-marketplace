import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DiscoverCategoryCard({
  title,
  description,
  icon: Icon,
  to,
  className = null,
  iconClassName = 'bg-primary/12 text-primary',
  glowClassName = 'bg-primary/10',
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex min-h-[148px] overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-raised focus-visible:ring-offset-4 sm:min-h-[168px] sm:p-5',
        className,
      )}
    >
      <div className={cn('absolute -bottom-12 -right-10 h-36 w-36 rounded-full opacity-70 blur-3xl transition-opacity group-hover:opacity-100', glowClassName)} aria-hidden="true" />
      <div className="relative flex w-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', iconClassName)}>
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background/35 text-muted-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
        <div>
          <h2 className="text-base font-extrabold tracking-tight sm:text-lg">{title}</h2>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">{description}</p>
        </div>
      </div>
    </Link>
  );
}
