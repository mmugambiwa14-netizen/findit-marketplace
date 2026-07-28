import { Building2, Car, Tractor, Wrench } from 'lucide-react';
import DiscoverCategoryCard from './DiscoverCategoryCard';

const CATEGORIES = [
  {
    title: 'Property',
    description: 'Homes, land and commercial spaces',
    icon: Building2,
    target: '/search?type=property',
  },
  {
    title: 'Vehicles',
    description: 'Cars, vans and everyday transport',
    icon: Car,
    target: '/search?type=car',
  },
  {
    title: 'Heavy Equipment',
    description: 'Machinery, trucks and working assets',
    icon: Tractor,
    target: '/search?type=machinery',
  },
  {
    title: 'Services',
    description: 'Trusted help for assets and property',
    icon: Wrench,
    target: '/services',
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
