import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function DiscoverCategoryCard({
  title,
  description,
  icon: Icon,
  to,
  className = null,
  iconClassName = 'bg-primary/12 text-primary',
}) {
  return (
    <Link
      to={to}
      className={cn(
        'clay-card group relative flex min-h-[92px] overflow-hidden rounded-2xl bg-gradient-to-br p-3.5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/20 focus-visible:ring-offset-4 sm:min-h-[128px] sm:p-4',
        className,
      )}
    >
      <div className="relative flex w-full items-center gap-3 sm:flex-col sm:items-start sm:justify-between">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconClassName)}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold tracking-tight sm:text-base">{title}</h2>
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">{description}</p>
        </div>
      </div>
    </Link>
  );
}
