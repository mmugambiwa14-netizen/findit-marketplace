import { CAR_CATEGORIES, CAR_MAKES, CONDITIONS, FUEL_TYPES, TRANSMISSIONS } from '@/lib/constants';
import SearchFilterSelect from './SearchFilterSelect';

const makes = CAR_MAKES.map((value) => ({ value, label: value }));

export default function VehicleFilters({ category, make, condition, fuelType, transmission, onUpdate }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SearchFilterSelect label="Vehicle type" value={category} onChange={(value) => onUpdate('category', value)} options={CAR_CATEGORIES} />
      <SearchFilterSelect label="Make" value={make} onChange={(value) => onUpdate('make', value)} options={makes} />
      <SearchFilterSelect label="Condition" value={condition} onChange={(value) => onUpdate('condition', value)} options={CONDITIONS} />
      <SearchFilterSelect label="Fuel type" value={fuelType} onChange={(value) => onUpdate('fuel', value)} options={FUEL_TYPES} />
      <SearchFilterSelect label="Transmission" value={transmission} onChange={(value) => onUpdate('transmission', value)} options={TRANSMISSIONS} />
    </div>
  );
}
