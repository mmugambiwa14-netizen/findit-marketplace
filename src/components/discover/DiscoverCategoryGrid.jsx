import DiscoverCategoryCard from './DiscoverCategoryCard';
import { CATEGORY_VISUALS } from './CategoryIcons';

const CATEGORIES = [
  { key: 'property', target: '/search?type=property' },
  { key: 'car', target: '/search?type=car' },
  { key: 'machinery', target: '/search?type=machinery' },
  { key: 'service', target: '/services' },
].map(({ key, target }) => ({ key, target, ...CATEGORY_VISUALS[key] }));

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
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
      {CATEGORIES.map(({ key, target, ...card }) => (
        <DiscoverCategoryCard
          key={key}
          {...card}
          to={withLocation(target, location)}
        />
      ))}
    </div>
  );
}
