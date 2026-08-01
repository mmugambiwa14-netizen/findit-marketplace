import { Link } from 'react-router-dom';

export default function DiscoverCategoryCard({
  title,
  description,
  icon: Icon,
  image,
  imageAlt,
  to,
}) {
  return (
    <Link
      to={to}
      aria-label={`Browse ${title}`}
      className="locked-category-card group min-h-[134px] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 focus-visible:ring-offset-4 sm:min-h-[154px]"
    >
      <img
        src={image}
        alt={imageAlt || title}
        loading="eager"
        decoding="async"
        className="absolute inset-y-0 right-0 h-full w-[61%] object-cover transition-transform duration-300 group-hover:scale-[1.025]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--card))_0%,hsl(var(--card))_40%,hsl(var(--card)/.92)_56%,hsl(var(--card)/.08)_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-primary/[0.025] via-transparent to-black/10" />

      <div className="relative z-10 flex min-h-[134px] w-[61%] items-center gap-4 p-4 sm:min-h-[154px] sm:p-5">
        <span className="locked-icon-tile h-12 w-12 sm:h-14 sm:w-14">
          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{title}</h2>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:text-sm">{description}</p>
          <p className="mt-2 text-[11px] font-semibold text-primary/90 sm:text-xs">Browse listings</p>
        </div>
      </div>
    </Link>
  );
}
