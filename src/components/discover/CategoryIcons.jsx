import { BriefcaseBusiness, Building2, CarFront, Tractor } from 'lucide-react';

function CategoryIcon({ icon: Icon, className = 'h-6 w-6', ...props }) {
  return (
    <Icon
      className={className}
      strokeWidth={2}
      aria-hidden="true"
      {...props}
    />
  );
}

export function PropertyCategoryIcon(props) {
  return <CategoryIcon icon={Building2} {...props} />;
}

export function CarCategoryIcon(props) {
  return <CategoryIcon icon={CarFront} {...props} />;
}

export function MachineryCategoryIcon(props) {
  return <CategoryIcon icon={Tractor} {...props} />;
}

export function ServicesCategoryIcon(props) {
  return <CategoryIcon icon={BriefcaseBusiness} {...props} />;
}

export const CATEGORY_VISUALS = {
  property: {
    label: 'Property',
    icon: PropertyCategoryIcon,
    color: '#14b8a6',
    image: '/demo/listings/modern-home.svg',
    description: 'Homes, land, rentals',
  },
  car: {
    label: 'Cars',
    icon: CarCategoryIcon,
    color: '#2563eb',
    image: '/demo/listings/silver-sedan.svg',
    description: 'Sedans, SUVs, trucks',
  },
  machinery: {
    label: 'Machinery',
    icon: MachineryCategoryIcon,
    color: '#f59e0b',
    image: '/demo/listings/excavator.svg',
    description: 'Heavy equipment, tools',
  },
  service: {
    label: 'Services',
    icon: ServicesCategoryIcon,
    color: '#8b5cf6',
    image: '/demo/listings/mechanic-service.svg',
    description: 'Repairs, trades, professional help',
  },
};
