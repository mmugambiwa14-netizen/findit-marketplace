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
      className="locked-category-card group min-h-[132px] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-primary/30 focus-visible:ring-offset-4 sm:min-h-[156px]"
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

      <span className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-slate-950/45 text-white opacity-90 shadow-lg backdrop-blur-md transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true">
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>

      <div className="relative z-10 flex min-h-[132px] w-[73%] items-center gap-2.5 p-3 sm:min-h-[156px] sm:w-[68%] sm:gap-3 sm:p-4">
        <span className="locked-icon-tile h-10 w-10 shrink-0 rounded-[0.8rem] sm:h-12 sm:w-12">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth="1.75" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-black tracking-[-0.03em] text-foreground sm:text-xl">{label}</h2>
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">{description}</p>
          {countLabel && (
            <p className="mt-1.5 inline-flex rounded-full border border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[9px] font-bold text-primary sm:text-[10px]">
              {countLabel}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
