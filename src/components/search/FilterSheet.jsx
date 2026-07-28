import { useEffect, useState } from 'react';
import { HierarchicalLocationSelector } from '@/components/location/LocationSelector';
import EquipmentFilters from '@/components/search/EquipmentFilters';
import PropertyFilters from '@/components/search/PropertyFilters';
import VehicleFilters from '@/components/search/VehicleFilters';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';

export default function FilterSheet({
  open,
  onOpenChange,
  type,
  filters,
  selectedLocation,
  onLocationChange,
  onUpdate,
  onApplyPrice,
  onClear,
  maxAllowedPrice,
  priceStep,
}) {
  const [draftPrice, setDraftPrice] = useState([filters.minPrice, filters.maxPrice]);

  useEffect(() => {
    if (open) setDraftPrice([filters.minPrice, filters.maxPrice]);
  }, [open, filters.minPrice, filters.maxPrice]);

  const applyAndClose = () => {
    onApplyPrice(draftPrice[0], draftPrice[1]);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="overflow-y-auto">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Use only the filters that matter for this category.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-5">
          {open && <HierarchicalLocationSelector value={selectedLocation} onSelectLocation={onLocationChange} />}

          {type === 'property' && <PropertyFilters category={filters.category} bedrooms={filters.bedrooms} onUpdate={onUpdate} />}
          {type === 'car' && <VehicleFilters category={filters.category} make={filters.make} condition={filters.condition} fuelType={filters.fuelType} transmission={filters.transmission} onUpdate={onUpdate} />}
          {type === 'machinery' && <EquipmentFilters category={filters.category} make={filters.make} condition={filters.condition} onUpdate={onUpdate} />}

          <div className="rounded-2xl border border-border bg-surface-secondary p-4">
            <Label className="text-sm font-medium">Price range</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              ${draftPrice[0].toLocaleString()} – ${draftPrice[1].toLocaleString()}
            </p>
            <Slider value={draftPrice} onValueChange={setDraftPrice} min={0} max={maxAllowedPrice} step={priceStep} className="mt-5" />
          </div>

          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-border bg-card px-5 pb-[max(0px,env(safe-area-inset-bottom))] pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClear}>Clear all</Button>
            <Button type="button" className="flex-1" onClick={applyAndClose}>Show results</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
