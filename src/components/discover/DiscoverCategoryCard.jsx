import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

export default function DiscoverCategoryCard({
  label,
  description,
  icon: Icon,
  image,
  imageAlt,
  to,
  countLabel,
}) {
  return (
    <Link
      to={to}
      aria-label={`Browse ${label}`}
      className="locked-category-card group min-h-[168px] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary/30 focus-visible:ring-offset-4 sm:min-h-[190px] lg:min-h-[215px]"
    >
      <img
        src={image}
        alt={imageAlt || ''}
        loading="eager"
        decoding="async"
        className="absolute inset-y-0 right-0 h-full w-[66%] object-cover transition-[transform,filter] duration-500 group-hover:scale-[1.045] group-hover:saturate-[1.08]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--card))_0%,hsl(var(--card))_34%,hsl(var(--card)/.91)_52%,hsl(var(--card)/.16)_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(115deg,hsl(var(--primary)/.08),transparent_45%,transparent_72%,hsl(222_70%_4%/.22))]" />

      <span className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/45 text-white opacity-90 shadow-lg backdrop-blur-md transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true">
        <ArrowUpRight className="h-4 w-4" />
      </span>

      <div className="relative z-10 flex min-h-[168px] w-[68%] items-center gap-3.5 p-4 sm:min-h-[190px] sm:w-[65%] sm:gap-4 sm:p-5 lg:min-h-[215px] lg:p-6">
        <span className="locked-icon-tile h-12 w-12 rounded-[0.95rem] sm:h-14 sm:w-14">
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth="1.75" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.35rem] font-black tracking-[-0.03em] text-foreground sm:text-2xl">{label}</h2>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
          {countLabel && (
            <p className="mt-2.5 inline-flex rounded-full border border-primary/15 bg-primary/[0.07] px-2.5 py-1 text-[10px] font-bold text-primary sm:text-[11px]">
              {countLabel}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
