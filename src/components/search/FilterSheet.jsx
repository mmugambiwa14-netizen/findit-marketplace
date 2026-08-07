import { useEffect, useMemo, useState } from 'react';
import { HierarchicalLocationSelector } from '@/components/location/LocationSelector';
import EquipmentFilters from '@/components/search/EquipmentFilters';
import PropertyFilters from '@/components/search/PropertyFilters';
import SearchFilterSelect from '@/components/search/SearchFilterSelect';
import VehicleFilters from '@/components/search/VehicleFilters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getCurrencyConfig, getSupportedListingCurrencies, LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';

function draftValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function parsePrice(value) {
  if (String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export default function FilterSheet({
  open,
  onOpenChange,
  type,
  filters,
  selectedLocation,
  onLocationChange,
  onUpdate,
  onCurrencyChange,
  onApplyPrice,
  onClear,
}) {
  const [draftMinPrice, setDraftMinPrice] = useState(draftValue(filters.minPrice));
  const [draftMaxPrice, setDraftMaxPrice] = useState(draftValue(filters.maxPrice));
  const currencyOptions = useMemo(() => getSupportedListingCurrencies(LAUNCH_COUNTRY_CODE).map((currency) => ({
    value: currency.code,
    label: `${currency.name} (${currency.symbol})`,
  })), []);
  const currencyConfig = filters.currency ? getCurrencyConfig(filters.currency) : null;

  useEffect(() => {
    if (!open) return;
    setDraftMinPrice(draftValue(filters.minPrice));
    setDraftMaxPrice(draftValue(filters.maxPrice));
  }, [open, filters.minPrice, filters.maxPrice]);

  const applyAndClose = () => {
    if (!filters.currency) {
      onApplyPrice(null, null);
      onOpenChange(false);
      return;
    }
    const minimum = parsePrice(draftMinPrice);
    let maximum = parsePrice(draftMaxPrice);
    if (minimum !== null && maximum !== null && maximum < minimum) maximum = minimum;
    onApplyPrice(minimum, maximum);
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
            <SearchFilterSelect
              label="Listing currency"
              value={filters.currency}
              onChange={onCurrencyChange}
              options={currencyOptions}
              placeholder="All currencies"
            />
            {!filters.currency ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Choose a currency before comparing prices. PeekaListing does not automatically convert seller prices.
              </p>
            ) : (
              <div className="mt-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">Price range</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Enter amounts in {currencyConfig?.name || filters.currency}.</p>
                  </div>
                  <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">{currencyConfig?.symbol || filters.currency}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="search-min-price" className="text-xs text-muted-foreground">Minimum</Label>
                    <Input
                      id="search-min-price"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={draftMinPrice}
                      onChange={(event) => setDraftMinPrice(event.target.value)}
                      placeholder="No minimum"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="search-max-price" className="text-xs text-muted-foreground">Maximum</Label>
                    <Input
                      id="search-max-price"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={draftMaxPrice}
                      onChange={(event) => setDraftMaxPrice(event.target.value)}
                      placeholder="No maximum"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}
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
