export function PropertyCategoryIcon({ className = 'h-6 w-6', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" {...props}>
      <path d="M3.5 10.2 12 3.5l8.5 6.7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5v10h13v-10" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M9 19.5v-6h6v6M8 9.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CarCategoryIcon({ className = 'h-6 w-6', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" {...props}>
      <path d="m5 9 1.5-3h11L19 9" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M4 10.5c0-.8.7-1.5 1.5-1.5h13c.8 0 1.5.7 1.5 1.5v5.8c0 .7-.6 1.2-1.2 1.2H5.2c-.7 0-1.2-.6-1.2-1.2v-5.8Z" stroke="currentColor" strokeWidth="1.9" />
      <path d="M7 17.5v2M17 17.5v2M7.2 13h2M14.8 13h2M10 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function MachineryCategoryIcon({ className = 'h-6 w-6', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" {...props}>
      <path d="M4 18.5h10.5M6 15.5h7.8v3H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 15.5V9.3h4.4l2.7 2.8v3.4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m12.5 9.2 2.9-4 2.1 1.5-2.8 5.1M17.5 6.7l2.3 7.3-3.3 1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.7 21h9.1c1.1 0 2-.9 2-2H3.7c0 1.1.9 2 2 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="8" cy="12.2" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function ServicesCategoryIcon({ className = 'h-6 w-6', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" {...props}>
      <path d="m5 19 8.2-8.2M14.8 9.2l3.4-3.4M15.8 4.2l4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8.5 5.4a4 4 0 0 0-4.8 5.4l4.1 4.1 2.8-2.8-4.1-4.1a1.8 1.8 0 0 1 2-2.9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m12.7 14.7 3.9 3.9a1.7 1.7 0 0 0 2.4-2.4l-3.9-3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export const CATEGORY_VISUALS = {
  property: {
    label: 'Property',
    icon: PropertyCategoryIcon,
    color: '#14b8a6',
    image: '/demo/listings/modern-home.svg',
    description: 'Homes, land, rentals',
  },
  car: {
    label: 'Cars',
    icon: CarCategoryIcon,
    color: '#2563eb',
    image: '/demo/listings/silver-sedan.svg',
    description: 'Sedans, SUVs, trucks',
  },
  machinery: {
    label: 'Machinery',
    icon: MachineryCategoryIcon,
    color: '#f59e0b',
    image: '/demo/listings/excavator.svg',
    description: 'Heavy equipment, tools',
  },
  service: {
    label: 'Services',
    icon: ServicesCategoryIcon,
    color: '#8b5cf6',
    image: '/demo/listings/mechanic-service.svg',
    description: 'Repairs, trades, professional help',
  },
};
