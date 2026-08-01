import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function DiscoverCategoryCard({
  title,
  description,
  icon: Icon,
  image,
  imageAlt,
  to,
  accentClassName = 'from-primary to-blue-700',
}) {
  return (
    <Link
      to={to}
      aria-label={`Browse ${title}`}
      className="group relative isolate min-h-[118px] overflow-hidden rounded-2xl border border-border/75 bg-card/90 shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-floating focus-visible:ring-offset-4 sm:min-h-[148px]"
    >
      <img
        src={image}
        alt={imageAlt}
        loading="eager"
        decoding="async"
        className="absolute inset-y-0 right-0 h-full w-[62%] object-cover transition-transform duration-300 group-hover:scale-[1.025]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--card))_0%,hsl(var(--card))_43%,hsl(var(--card)/.9)_59%,hsl(var(--card)/.08)_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10" />

      <div className="relative z-10 flex min-h-[118px] w-[58%] items-center gap-3 p-4 sm:min-h-[148px] sm:p-5">
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ring-1 ring-white/15',
            'shadow-[inset_0_1px_rgba(255,255,255,.24),0_8px_18px_rgba(0,0,0,.3)]',
            accentClassName,
          )}
        >
          <Icon className="h-6 w-6" strokeWidth={2.15} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">{title}</h2>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
