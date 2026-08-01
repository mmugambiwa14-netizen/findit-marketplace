import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROPERTY_CATEGORIES, CAR_CATEGORIES, MACHINERY_CATEGORIES } from '@/lib/constants';
import {
  PropertyCategoryIcon,
  CarCategoryIcon,
  MachineryCategoryIcon,
  ServicesCategoryIcon,
} from '@/components/discover/CategoryIcons';
import StepNav from './StepNav';

const CATEGORIES = [
  { key: 'property', icon: PropertyCategoryIcon, label: 'Property', desc: 'Homes, land and rentals', options: PROPERTY_CATEGORIES },
  { key: 'car', icon: CarCategoryIcon, label: 'Cars', desc: 'Cars, vans and road vehicles', options: CAR_CATEGORIES },
  { key: 'machinery', icon: MachineryCategoryIcon, label: 'Machinery', desc: 'Heavy equipment and tools', options: MACHINERY_CATEGORIES },
  { key: 'service', icon: ServicesCategoryIcon, label: 'Services', desc: 'Repairs, trades and professional help', options: null },
];

function groupOptions(options) {
  return options.reduce((groups, option) => {
    const group = option.group || 'All';
    return { ...groups, [group]: [...(groups[group] || []), option] };
  }, {});
}

export default function Step1Category({ formData, update, onContinue }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const selected = CATEGORIES.find((category) => category.key === formData.listing_category);
  const grouped = useMemo(() => selected?.options ? groupOptions(selected.options) : {}, [selected]);

  const choose = (category) => {
    setError('');
    if (category.key === 'service') {
      navigate('/create-service');
      return;
    }
    update('listing_category', category.key);
    update('category', '');
    update('type', category.key);
    update('detail', {});
  };

  const continueToDetails = () => {
    if (!formData.listing_category) return setError('Select what you are posting.');
    if (!formData.category) return setError('Select a subcategory to continue.');
    setError('');
    onContinue();
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Create a listing</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">What are you posting?</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Choose the category that best matches your item.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((category) => {
          const active = formData.listing_category === category.key;
          const Icon = category.icon;
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => choose(category)}
              aria-pressed={active}
              className={cn(
                'clay-card relative min-h-[154px] rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30',
                active && 'border-primary/65 bg-primary/5 ring-1 ring-primary/20',
              )}
            >
              {active && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 fill-primary text-background" />}
              <span className="locked-icon-tile h-12 w-12"><Icon className="h-6 w-6" /></span>
              <h2 className="mt-4 text-base font-extrabold">{category.label}</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{category.desc}</p>
            </button>
          );
        })}
      </div>

      {selected?.options && (
        <div className="locked-control rounded-2xl p-4">
          <label htmlFor="listing-subcategory" className="mb-2 block text-sm font-bold">Choose a {selected.label.toLowerCase()} type</label>
          <Select value={formData.category || ''} onValueChange={(value) => update('category', value)}>
            <SelectTrigger id="listing-subcategory" className="h-12 rounded-xl border-border bg-background/65">
              <SelectValue placeholder="Select subcategory" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Object.entries(grouped).map(([groupName, options]) => (
                <SelectGroup key={groupName}>
                  {selected.key !== 'machinery' && <SelectLabel>{groupName}</SelectLabel>}
                  {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.icon ? `${option.icon} ${option.label}` : option.label}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
      <StepNav showBack={false} onContinue={continueToDetails} />
    </div>
  );
}
