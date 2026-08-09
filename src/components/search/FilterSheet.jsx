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

function copyFilters(filters) {
  return {
    category: filters.category || '',
    bedrooms: filters.bedrooms || '',
    make: filters.make || '',
    condition: filters.condition || '',
    fuelType: filters.fuelType || '',
    transmission: filters.transmission || '',
    currency: filters.currency || '',
  };
}

const EMPTY_FILTERS = Object.freeze({
  category: '',
  bedrooms: '',
  make: '',
  condition: '',
  fuelType: '',
  transmission: '',
  currency: '',
});

export default function FilterSheet({
  open,
  onOpenChange,
  type,
  categoryOptions,
  filters,
  selectedLocation,
  onApply,
}) {
  const [draftFilters, setDraftFilters] = useState(() => copyFilters(filters));
  const [draftLocation, setDraftLocation] = useState(selectedLocation);
  const [draftMinPrice, setDraftMinPrice] = useState(draftValue(filters.minPrice));
  const [draftMaxPrice, setDraftMaxPrice] = useState(draftValue(filters.maxPrice));
  const currencyOptions = useMemo(() => getSupportedListingCurrencies(LAUNCH_COUNTRY_CODE).map((currency) => ({
    value: currency.code,
    label: `${currency.name} (${currency.symbol})`,
  })), []);
  const currencyConfig = draftFilters.currency ? getCurrencyConfig(draftFilters.currency) : null;

  useEffect(() => {
    if (!open) return;
    setDraftFilters(copyFilters(filters));
    setDraftLocation(selectedLocation);
    setDraftMinPrice(draftValue(filters.minPrice));
    setDraftMaxPrice(draftValue(filters.maxPrice));
  }, [open, filters, selectedLocation]);

  const updateDraft = (key, value) => {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  };

  const updateCurrency = (value) => {
    setDraftFilters((current) => ({ ...current, currency: value }));
    setDraftMinPrice('');
    setDraftMaxPrice('');
  };

  const resetDraft = () => {
    setDraftFilters({ ...EMPTY_FILTERS });
    setDraftLocation(null);
    setDraftMinPrice('');
    setDraftMaxPrice('');
  };

  const applyAndClose = () => {
    const minimum = draftFilters.currency ? parsePrice(draftMinPrice) : null;
    let maximum = draftFilters.currency ? parsePrice(draftMaxPrice) : null;
    if (minimum !== null && maximum !== null && maximum < minimum) maximum = minimum;

    onApply({
      filters: {
        ...draftFilters,
        minPrice: minimum,
        maxPrice: maximum,
      },
      location: draftLocation,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto">
        <SheetHeader className="pr-10 text-left">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Set the filters you want, then apply them together.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-5">
          {open && <HierarchicalLocationSelector value={draftLocation} onSelectLocation={setDraftLocation} />}

          {type === 'property' && <PropertyFilters category={draftFilters.category} categoryOptions={categoryOptions} bedrooms={draftFilters.bedrooms} onUpdate={updateDraft} />}
          {type === 'car' && <VehicleFilters category={draftFilters.category} categoryOptions={categoryOptions} make={draftFilters.make} condition={draftFilters.condition} fuelType={draftFilters.fuelType} transmission={draftFilters.transmission} onUpdate={updateDraft} />}
          {type === 'machinery' && <EquipmentFilters category={draftFilters.category} categoryOptions={categoryOptions} make={draftFilters.make} condition={draftFilters.condition} onUpdate={updateDraft} />}

          <div className="rounded-2xl border border-border bg-surface-secondary p-4">
            <SearchFilterSelect
              label="Listing currency"
              value={draftFilters.currency}
              onChange={updateCurrency}
              options={currencyOptions}
              placeholder="All currencies"
            />
            {!draftFilters.currency ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Choose a currency before comparing prices. PeekaListing does not automatically convert seller prices.
              </p>
            ) : (
              <div className="mt-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <Label className="text-sm font-medium">Price range</Label>
                    <p className="mt-1 text-xs text-muted-foreground">Enter amounts in {currencyConfig?.name || draftFilters.currency}.</p>
                  </div>
                  <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground">{currencyConfig?.symbol || draftFilters.currency}</span>
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

          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-border bg-card/95 px-5 pb-[max(0px,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
            <Button type="button" variant="outline" className="flex-1" onClick={resetDraft}>Reset</Button>
            <Button type="button" className="flex-1" onClick={applyAndClose}>Show results</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
