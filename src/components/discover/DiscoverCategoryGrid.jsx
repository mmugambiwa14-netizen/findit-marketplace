import { useQuery } from '@tanstack/react-query';
import DiscoverCategoryCard from './DiscoverCategoryCard';
import { CATEGORY_VISUALS } from './CategoryIcons';
import { getDiscoverCategoryCounts } from '@/services/discoverService';

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

function countLabel(count) {
  if (!Number.isFinite(count)) return null;
  return `${new Intl.NumberFormat().format(count)} ${count === 1 ? 'listing' : 'listings'}`;
}

export default function DiscoverCategoryGrid({ location }) {
  const countsQuery = useQuery({
    queryKey: ['discover-category-counts'],
    queryFn: getDiscoverCategoryCounts,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">
      {CATEGORIES.map(({ key, target, ...card }) => (
        <DiscoverCategoryCard
          key={key}
          {...card}
          countLabel={countLabel(countsQuery.data?.[key])}
          to={withLocation(target, location)}
        />
      ))}
    </div>
  );
}
