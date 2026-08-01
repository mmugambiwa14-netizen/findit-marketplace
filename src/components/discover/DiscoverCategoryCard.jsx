import { Link } from 'react-router-dom';

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
      className="locked-category-card group min-h-[158px] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 focus-visible:ring-offset-4 sm:min-h-[168px]"
    >
      <img
        src={image}
        alt={imageAlt || label}
        loading="eager"
        decoding="async"
        className="absolute inset-y-0 right-0 h-full w-[64%] object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--card))_0%,hsl(var(--card))_36%,hsl(var(--card)/.88)_56%,hsl(var(--card)/.1)_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-primary/[0.025] via-transparent to-black/10" />

      <div className="relative z-10 flex min-h-[158px] w-[67%] items-center gap-3.5 p-4 sm:min-h-[168px] sm:gap-4 sm:p-5">
        <span className="locked-icon-tile h-12 w-12 rounded-[0.95rem] sm:h-14 sm:w-14">
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth="1.7" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.35rem] font-extrabold tracking-tight text-foreground sm:text-2xl">{label}</h2>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
          <p className="mt-2 text-[11px] font-medium text-foreground/75 sm:text-xs">{countLabel}</p>
        </div>
      </div>
    </Link>
  );
}
