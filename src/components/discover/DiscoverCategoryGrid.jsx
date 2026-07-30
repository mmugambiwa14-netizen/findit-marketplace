import { Building2, Car, Tractor, Wrench } from 'lucide-react';
import DiscoverCategoryCard from './DiscoverCategoryCard';

const CATEGORIES = [
  {
    title: 'Property',
    description: 'Homes, flats, land and commercial spaces',
    icon: Building2,
    target: '/search?type=property',
    iconClassName: 'bg-blue-500/14 text-blue-600 dark:text-blue-400',
    glowClassName: 'bg-blue-500/16',
  },
  {
    title: 'Vehicles',
    description: 'Cars, vans, bikes and everyday transport',
    icon: Car,
    target: '/search?type=car',
    iconClassName: 'bg-emerald-500/14 text-emerald-600 dark:text-emerald-400',
    glowClassName: 'bg-emerald-500/16',
  },
  {
    title: 'Machinery',
    description: 'Trucks, tractors and working equipment',
    icon: Tractor,
    target: '/search?type=machinery',
    iconClassName: 'bg-amber-500/14 text-amber-600 dark:text-amber-400',
    glowClassName: 'bg-amber-500/16',
  },
  {
    title: 'Services',
    description: 'Repairs, maintenance and specialist help',
    icon: Wrench,
    target: '/services',
    iconClassName: 'bg-violet-500/14 text-violet-600 dark:text-violet-400',
    glowClassName: 'bg-violet-500/16',
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
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
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
