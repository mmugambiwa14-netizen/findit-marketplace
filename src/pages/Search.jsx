import { readStoredJson, removeStoredValue, writeStoredJson } from '@/lib/browserStorage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import ActiveFilterChips from '@/components/search/ActiveFilterChips';
import CategoryResultsHeader from '@/components/search/CategoryResultsHeader';
import FilterSheet from '@/components/search/FilterSheet';
import ListingResults from '@/components/search/ListingResults';
import SearchToolbar from '@/components/search/SearchToolbar';
import SortSheet, { getSortLabel } from '@/components/search/SortSheet';
import { featureFlags } from '@/lib/featureFlags';
import {
  CAR_CATEGORIES,
  CONDITIONS,
  FUEL_TYPES,
  MACHINERY_CATEGORIES,
  PROPERTY_CATEGORIES,
  TRANSMISSIONS,
} from '@/lib/constants';
import { useCurrency } from '@/lib/CurrencyContext';
import { getCurrencyConfig, getSupportedListingCurrencies, LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import { getPublicSearchSuggestions, searchPublicListingsPage } from '@/services/publicListingsService';
import { getCategoryTaxonomy } from '@/services/taxonomyService';
import useDebouncedValue from '@/hooks/useDebouncedValue';

const VALID_TYPES = new Set(['property', 'car', 'machinery']);
const VALID_SORTS = new Set(['newest', 'price_asc', 'price_desc']);
const PRICE_SORTS = new Set(['price_asc', 'price_desc']);
const VALID_VIEWS = new Set(['list', 'map']);
const VALID_PRICE_CURRENCIES = new Set(getSupportedListingCurrencies(LAUNCH_COUNTRY_CODE).map((currency) => currency.code));
const RECENT_SEARCHES_KEY = 'findit.recent-searches';
const CATEGORIES_BY_TYPE = {
  property: PROPERTY_CATEGORIES,
  car: CAR_CATEGORIES,
  machinery: MACHINERY_CATEGORIES,
};

function readOptionalNumber(value) {
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function readRecentSearches() {
  try {
    const parsed = readStoredJson('local', RECENT_SEARCHES_KEY, []);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function optionLabel(options, value) {
  return options.find((option) => String(option.value) === String(value))?.label || value;
}

function priceFilterLabel(minimum, maximum, currency, formatNative) {
  if (!currency) return '';
  if (minimum !== null && maximum !== null) return `${formatNative(minimum, currency)} – ${formatNative(maximum, currency)}`;
  if (minimum !== null) return `From ${formatNative(minimum, currency)}`;
  if (maximum !== null) return `Up to ${formatNative(maximum, currency)}`;
  return '';
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);
  const { formatNative } = useCurrency();

  const requestedType = searchParams.get('type');
  const type = VALID_TYPES.has(requestedType) ? requestedType : 'property';
  const query = searchParams.get('q') || '';
  const [queryInput, setQueryInput] = useState(query);
  const requestedCurrency = String(searchParams.get('currency') || '').toUpperCase();
  const currency = VALID_PRICE_CURRENCIES.has(requestedCurrency) ? requestedCurrency : '';
  const minPrice = currency ? readOptionalNumber(searchParams.get('minPrice')) : null;
  const rawMaxPrice = currency ? readOptionalNumber(searchParams.get('maxPrice')) : null;
  const maxPrice = minPrice !== null && rawMaxPrice !== null && rawMaxPrice < minPrice ? minPrice : rawMaxPrice;
  const requestedSort = searchParams.get('sort');
  const normalizedSort = VALID_SORTS.has(requestedSort) ? requestedSort : 'newest';
  const sort = !currency && PRICE_SORTS.has(normalizedSort) ? 'newest' : normalizedSort;
  const requestedView = searchParams.get('view');
  const viewMode = featureFlags.maps && VALID_VIEWS.has(requestedView) ? requestedView : 'list';
  const category = searchParams.get('category') || '';
  const bedrooms = searchParams.get('bedrooms') || '';
  const make = searchParams.get('make') || '';
  const condition = searchParams.get('condition') || '';
  const fuelType = searchParams.get('fuel') || '';
  const transmission = searchParams.get('transmission') || '';
  const locationId = searchParams.get('location') || '';
  const locationName = searchParams.get('locationName') || '';
  const locationCountry = searchParams.get('country') || '';
  const locationProvince = searchParams.get('province') || '';

  const { data: categoryTaxonomy } = useQuery({
    queryKey: ['public-category-taxonomy', 'filters', type, LAUNCH_COUNTRY_CODE],
    queryFn: () => getCategoryTaxonomy(type, LAUNCH_COUNTRY_CODE),
    enabled: VALID_TYPES.has(type),
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = useMemo(() => {
    const canonical = (categoryTaxonomy || [])
      .filter((node) => node.nodeType === 'category' && node.isPostable && !node.supersededBy)
      .sort((left, right) => left.pathLabels.join(' / ').localeCompare(right.pathLabels.join(' / ')) || left.sortOrder - right.sortOrder)
      .map((node) => ({ value: node.stableSlug, label: node.label }));
    return canonical.length ? canonical : CATEGORIES_BY_TYPE[type];
  }, [categoryTaxonomy, type]);

  const selectedLocation = useMemo(() => locationId ? {
    country: locationCountry,
    state: locationProvince,
    city: locationId,
    cityName: locationName,
  } : null, [locationId, locationCountry, locationProvince, locationName]);

  const filterValues = useMemo(() => ({
    category,
    bedrooms,
    make,
    condition,
    fuelType,
    transmission,
    currency,
    minPrice,
    maxPrice,
  }), [category, bedrooms, make, condition, fuelType, transmission, currency, minPrice, maxPrice]);

  const updateParams = useCallback((updates, { replace = true } = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      next.delete('page');
      return next;
    }, { replace });
  }, [setSearchParams]);

  useEffect(() => setQueryInput(query), [query]);

  useEffect(() => {
    const orphanedPriceState = !currency && (
      searchParams.has('minPrice')
      || searchParams.has('maxPrice')
      || PRICE_SORTS.has(normalizedSort)
    );
    const invalidCurrency = Boolean(requestedCurrency && !currency);
    const legacyPage = searchParams.has('page');
    if (!orphanedPriceState && !invalidCurrency && !legacyPage) return;

    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('page');
      if (orphanedPriceState || invalidCurrency) {
        next.delete('minPrice');
        next.delete('maxPrice');
      }
      if (invalidCurrency) next.delete('currency');
      if ((orphanedPriceState || invalidCurrency) && PRICE_SORTS.has(next.get('sort'))) next.delete('sort');
      return next;
    }, { replace: true });
  }, [currency, normalizedSort, requestedCurrency, searchParams, setSearchParams]);

  const suggestionQuery = useDebouncedValue(queryInput.trim().slice(0, 100), 250);

  const request = useMemo(() => ({
    kind: type,
    countryCode: LAUNCH_COUNTRY_CODE,
    currency,
    query,
    category,
    locationId,
    minPrice,
    maxPrice,
    minBedrooms: bedrooms,
    brand: make,
    condition,
    fuelType,
    transmission,
    sort,
  }), [type, currency, query, category, locationId, minPrice, maxPrice, bedrooms, make, condition, fuelType, transmission, sort]);

  const { data: suggestions } = useQuery({
    queryKey: ['public-search-suggestions', type, suggestionQuery],
    queryFn: ({ signal }) => getPublicSearchSuggestions(type, suggestionQuery, { signal }),
    enabled: suggestionQuery.length >= 2,
    staleTime: 1000 * 60,
  });

  const categorySuggestions = useMemo(() => {
    if (suggestionQuery.length < 2) return [];
    const normalized = suggestionQuery.toLowerCase();
    return categoryOptions.filter((item) => item.label.toLowerCase().includes(normalized)).slice(0, 3);
  }, [categoryOptions, suggestionQuery]);

  const hasSuggestions = Boolean(categorySuggestions.length || suggestions?.listings?.length || suggestions?.locations?.length);

  const resultsQuery = useInfiniteQuery({
    queryKey: ['public-listing-search-page', request],
    queryFn: ({ pageParam, signal }) => searchPublicListingsPage({ ...request, cursor: pageParam || null }, { signal }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    staleTime: 1000 * 30,
  });

  const listings = useMemo(() => {
    const byId = new Map();
    for (const pageResult of resultsQuery.data?.pages || []) {
      for (const item of pageResult.items) byId.set(item.id, item);
    }
    return [...byId.values()];
  }, [resultsQuery.data]);

  const hasFilters = Boolean(
    category || locationId || bedrooms || make || condition || fuelType || transmission || currency || minPrice !== null || maxPrice !== null,
  );

  const rememberSearch = (value) => {
    const normalized = value.trim();
    if (!normalized) return;
    const next = [normalized, ...recentSearches.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 5);
    setRecentSearches(next);
    try {
      writeStoredJson('local', RECENT_SEARCHES_KEY, next);
    } catch {
      // Search remains functional when storage is unavailable.
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const normalized = queryInput.trim().slice(0, 100);
    rememberSearch(normalized);
    updateParams({ q: normalized || null }, { replace: false });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      removeStoredValue('local', RECENT_SEARCHES_KEY);
    } catch {
      // No further action is needed.
    }
  };

  const clearFilters = () => {
    const updates = {
      category: null,
      location: null,
      locationName: null,
      country: null,
      province: null,
      bedrooms: null,
      make: null,
      condition: null,
      fuel: null,
      transmission: null,
      currency: null,
      minPrice: null,
      maxPrice: null,
    };
    if (PRICE_SORTS.has(sort)) updates.sort = null;
    updateParams(updates);
  };

  const changeType = (nextType) => {
    setSearchParams((current) => {
      const next = new URLSearchParams();
      next.set('type', nextType);
      for (const key of ['q', 'location', 'locationName', 'country', 'province']) {
        const value = current.get(key);
        if (value) next.set(key, value);
      }
      return next;
    });
  };

  const updateViewMode = (value) => updateParams({ view: value === 'map' ? 'map' : null }, { replace: false });
  const updateCurrency = (value) => {
    const nextCurrency = value || null;
    const updates = { currency: nextCurrency, minPrice: null, maxPrice: null };
    if (!nextCurrency && PRICE_SORTS.has(sort)) updates.sort = null;
    updateParams(updates);
  };

  const applyFilterSheet = ({ filters: nextFilters, location }) => {
    const nextCurrency = nextFilters.currency || null;
    const updates = {
      category: nextFilters.category || null,
      bedrooms: nextFilters.bedrooms || null,
      make: nextFilters.make || null,
      condition: nextFilters.condition || null,
      fuel: nextFilters.fuelType || null,
      transmission: nextFilters.transmission || null,
      currency: nextCurrency,
      minPrice: nextCurrency ? nextFilters.minPrice : null,
      maxPrice: nextCurrency ? nextFilters.maxPrice : null,
      country: location?.country || null,
      province: location?.state || null,
      location: location?.city || null,
      locationName: location?.cityName || null,
    };
    if (!nextCurrency && PRICE_SORTS.has(sort)) updates.sort = null;
    updateParams(updates);
  };

  const activeFilters = useMemo(() => {
    const filters = [];
    if (category) filters.push({ key: 'category', label: optionLabel(categoryOptions, category) });
    if (locationId) filters.push({ key: 'location', label: selectedLocation?.cityName || 'Location' });
    if (bedrooms) filters.push({ key: 'bedrooms', label: `${bedrooms}+ bedrooms` });
    if (make) filters.push({ key: 'make', label: make });
    if (condition) filters.push({ key: 'condition', label: optionLabel(CONDITIONS, condition) });
    if (fuelType) filters.push({ key: 'fuel', label: optionLabel(FUEL_TYPES, fuelType) });
    if (transmission) filters.push({ key: 'transmission', label: optionLabel(TRANSMISSIONS, transmission) });
    if (currency) {
      const config = getCurrencyConfig(currency);
      filters.push({ key: 'currency', label: `${config.name} (${config.symbol})` });
      const priceLabel = priceFilterLabel(minPrice, maxPrice, currency, formatNative);
      if (priceLabel) filters.push({ key: 'price', label: priceLabel });
    }
    return filters;
  }, [category, categoryOptions, locationId, selectedLocation?.cityName, bedrooms, make, condition, fuelType, transmission, currency, minPrice, maxPrice, formatNative]);

  const removeFilter = (key) => {
    if (key === 'location') {
      updateParams({ location: null, locationName: null, country: null, province: null });
    } else if (key === 'price') {
      updateParams({ minPrice: null, maxPrice: null });
    } else if (key === 'currency') {
      updateCurrency(null);
    } else {
      updateParams({ [key]: null });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background md:pb-8">
      <header className="glass-bar sticky top-0 z-40 border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <CategoryResultsHeader type={type} category={category} onTypeChange={changeType} onCategorySelect={(value) => updateParams({ category: value })} />
          <SearchToolbar
            queryInput={queryInput}
            onQueryInputChange={setQueryInput}
            onSubmit={submitSearch}
            focused={searchFocused}
            onFocusChange={setSearchFocused}
            categorySuggestions={categorySuggestions}
            suggestions={suggestions}
            hasSuggestions={hasSuggestions}
            onSelectCategory={(item) => {
              setQueryInput('');
              updateParams({ q: null, category: item.value }, { replace: false });
            }}
            onSelectLocation={(item) => updateParams({ location: item.id, locationName: item.name }, { replace: false })}
            onSelectListing={(item) => {
              setQueryInput(item.title);
              rememberSearch(item.title);
              updateParams({ q: item.title }, { replace: false });
            }}
            onOpenFilters={() => setFiltersOpen(true)}
            onOpenSort={() => setSortOpen(true)}
            hasFilters={hasFilters}
            filterCount={activeFilters.length}
            sortLabel={getSortLabel(sort, currency)}
          />
          <div className="mt-3">
            <ActiveFilterChips filters={activeFilters} onRemove={removeFilter} onClear={clearFilters} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {!query && recentSearches.length > 0 && (
          <section className="mb-5 rounded-2xl border border-border bg-card p-4" aria-labelledby="recent-searches-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="recent-searches-title" className="text-xs font-semibold">Recent searches</h2>
              <button type="button" onClick={clearRecentSearches} className="min-h-11 px-2 text-xs font-semibold text-primary hover:text-primary-hover">Clear</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {recentSearches.map((item) => (
                <button key={item} type="button" onClick={() => { setQueryInput(item); updateParams({ q: item }, { replace: false }); }} className="min-h-11 rounded-full border border-border bg-surface-secondary px-3 text-xs text-foreground hover:border-border-strong">
                  {item}
                </button>
              ))}
            </div>
          </section>
        )}

        <ListingResults
          listings={listings}
          type={type}
          isLoading={resultsQuery.isLoading}
          isFetching={resultsQuery.isFetching}
          isFetchingNextPage={resultsQuery.isFetchingNextPage}
          isError={resultsQuery.isError}
          hasNextPage={Boolean(resultsQuery.hasNextPage)}
          onRetry={() => resultsQuery.refetch()}
          onLoadMore={() => resultsQuery.fetchNextPage()}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          mapsEnabled={featureFlags.maps}
          viewMode={viewMode}
          onViewModeChange={updateViewMode}
        />
      </div>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        type={type}
        categoryOptions={categoryOptions}
        filters={filterValues}
        selectedLocation={selectedLocation}
        onApply={applyFilterSheet}
      />

      <SortSheet
        open={sortOpen}
        onOpenChange={setSortOpen}
        value={sort}
        currency={currency}
        onChange={(value) => updateParams({ sort: value === 'newest' ? null : value })}
      />
    </div>
  );
}
