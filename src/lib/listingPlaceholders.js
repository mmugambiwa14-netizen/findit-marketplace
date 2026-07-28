import propertyPlaceholder from '@/assets/placeholders/property.svg';
import vehiclePlaceholder from '@/assets/placeholders/vehicle.svg';
import equipmentPlaceholder from '@/assets/placeholders/equipment.svg';

export const listingPlaceholders = Object.freeze({
  property: propertyPlaceholder,
  car: vehiclePlaceholder,
  machinery: equipmentPlaceholder,
});

export function getListingPlaceholder(kind) {
  return listingPlaceholders[kind] || propertyPlaceholder;
}
