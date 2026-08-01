import { Building2, CarFront, Construction, Wrench } from 'lucide-react';
import DiscoverCategoryCard from './DiscoverCategoryCard';

const CATEGORIES = [
  {
    title: 'Property',
    description: 'Homes, flats, land and commercial spaces',
    icon: Building2,
    image: '/demo/listings/modern-home.svg',
    imageAlt: 'Modern residential property',
    target: '/search?type=property',
    accentClassName: 'from-violet-600 to-indigo-700',
  },
  {
    title: 'Cars',
    description: 'Sedans, SUVs, vans and everyday transport',
    icon: CarFront,
    image: '/demo/listings/silver-sedan.svg',
    imageAlt: 'Modern passenger car',
    target: '/search?type=car',
    accentClassName: 'from-blue-600 to-blue-800',
  },
  {
    title: 'Machinery',
    description: 'Heavy equipment, trucks and working tools',
    icon: Construction,
    image: '/demo/listings/excavator.svg',
    imageAlt: 'Excavator and heavy machinery',
    target: '/search?type=machinery',
    accentClassName: 'from-amber-600 to-orange-800',
  },
  {
    title: 'Services',
    description: 'Repairs, trades and professional help',
    icon: Wrench,
    image: '/demo/listings/property-maintenance.svg',
    imageAlt: 'Professional maintenance service',
    target: '/services',
    accentClassName: 'from-teal-600 to-cyan-800',
  },
];

function withLocation(target, location) {
  if (!location?.city) return target;
  const [pathname, query = ''] = target.split('?');
  const params = new URLSearchParams(query);
  params.set('location', location.city);
  if (location.cityName) params.set('locationName', location.cityName);
  if (location.country) params.set('country', location.country);
  if (location.state) params.set('province', location.state);
  return `${pathname}?${params.toString()}`;
}

export default function DiscoverCategoryGrid({ location }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      {CATEGORIES.map((category) => (
        <DiscoverCategoryCard
          key={category.title}
          {...category}
          to={withLocation(category.target, location)}
        />
      ))}
    </div>
  );
}
