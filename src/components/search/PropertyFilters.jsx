import { PROPERTY_CATEGORIES } from '@/lib/constants';
import SearchFilterSelect from './SearchFilterSelect';

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value}+` }));

export default function PropertyFilters({ category, bedrooms, onUpdate }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SearchFilterSelect label="Property type" value={category} onChange={(value) => onUpdate('category', value)} options={PROPERTY_CATEGORIES} />
      <SearchFilterSelect label="Minimum bedrooms" value={bedrooms} onChange={(value) => onUpdate('bedrooms', value)} options={BEDROOM_OPTIONS} />
    </div>
  );
}
