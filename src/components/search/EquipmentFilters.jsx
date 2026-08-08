import { CONDITIONS, MACHINERY_CATEGORIES, MACHINERY_MAKES } from '@/lib/constants';
import SearchFilterSelect from './SearchFilterSelect';

const makes = MACHINERY_MAKES.map((value) => ({ value, label: value }));

export default function EquipmentFilters({ category, categoryOptions = MACHINERY_CATEGORIES, make, condition, onUpdate }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SearchFilterSelect label="Equipment type" value={category} onChange={(value) => onUpdate('category', value)} options={categoryOptions} />
      <SearchFilterSelect label="Make" value={make} onChange={(value) => onUpdate('make', value)} options={makes} />
      <SearchFilterSelect label="Condition" value={condition} onChange={(value) => onUpdate('condition', value)} options={CONDITIONS} />
    </div>
  );
}
