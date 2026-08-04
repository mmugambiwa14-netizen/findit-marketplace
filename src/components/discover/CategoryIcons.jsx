import { CarFront, House, Construction, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import './category-icons.css';

function CategoryIcon({ icon: Icon, color, className = 'h-6 w-6', ...props }) {
  return (
    <span
      className={cn('findit-3d-category-icon', className)}
      style={{ '--category-icon-color': color }}
      aria-hidden="true"
      {...props}
    >
      <span className="findit-3d-category-icon-face">
        <Icon className="h-[58%] w-[58%]" strokeWidth={2.35} />
      </span>
    </span>
  );
}

export function PropertyCategoryIcon(props) {
  return <CategoryIcon icon={House} color="#14b8a6" {...props} />;
}

export function CarCategoryIcon(props) {
  return <CategoryIcon icon={CarFront} color="#2563eb" {...props} />;
}

export function MachineryCategoryIcon(props) {
  return <CategoryIcon icon={Construction} color="#f59e0b" {...props} />;
}

export function ServicesCategoryIcon(props) {
  return <CategoryIcon icon={Wrench} color="#8b5cf6" {...props} />;
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
