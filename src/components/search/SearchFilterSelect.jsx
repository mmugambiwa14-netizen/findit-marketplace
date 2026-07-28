import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SearchFilterSelect({ label, value, onChange, options, placeholder = 'Any' }) {
  const selectId = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={selectId} className="text-sm font-medium">{label}</Label>
      <Select value={value || 'all'} onValueChange={(next) => onChange(next === 'all' ? null : next)}>
        <SelectTrigger id={selectId}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
