import { Building2, Car, Tractor, Wrench } from 'lucide-react';
import DiscoverCategoryCard from './DiscoverCategoryCard';

const CATEGORIES = [
  {
    title: 'Property',
    description: 'Homes, flats, land and commercial spaces',
    icon: Building2,
    target: '/search?type=property',
    className: 'from-blue-500/22 to-blue-700/10',
    iconClassName: 'bg-blue-500/16 text-blue-400',
  },
  {
    title: 'Cars',
    description: 'Cars, vans, bikes and everyday transport',
    icon: Car,
    target: '/search?type=car',
    className: 'from-indigo-500/20 to-blue-800/10',
    iconClassName: 'bg-indigo-500/16 text-indigo-300',
  },
  {
    title: 'Machinery',
    description: 'Trucks, tractors and working equipment',
    icon: Tractor,
    target: '/search?type=machinery',
    className: 'from-violet-500/22 to-purple-800/10',
    iconClassName: 'bg-violet-500/16 text-violet-300',
  },
  {
    title: 'Services',
    description: 'Repairs, maintenance and specialist help',
    icon: Wrench,
    target: '/services',
    className: 'from-teal-500/22 to-cyan-800/10',
    iconClassName: 'bg-teal-500/16 text-teal-300',
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
