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
import {
  CAR_CATEGORIES,
  CONDITIONS,
  FUEL_TYPES,
  MACHINERY_CATEGORIES,
  PROPERTY_CATEGORIES,
  TRANSMISSIONS,
} from '@/lib/constants';
import { getPublicSearchSuggestions, searchPublicListingsPage } from '@/services/publicListingsService';
import useDebouncedValue from '@/hooks/useDebouncedValue';

const VALID_TYPES = new Set(['property', 'car', 'machinery']);
const VALID_SORTS = new Set(['newest', 'price_asc', 'price_desc', 'most_viewed']);
const RECENT_SEARCHES_KEY = 'findit.recent-searches';
const CATEGORIES_BY_TYPE = {
  property: PROPERTY_CATEGORIES,
  car: CAR_CATEGORIES,
  machinery: MACHINERY_CATEGORIES,
};

function readNumber(value, fallback) {
  if (value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState(readRecentSearches);

  const requestedType = searchParams.get('type');
  const type = VALID_TYPES.has(requestedType) ? requestedType : 'property';
  const query = searchParams.get('q') || '';
  const [queryInput, setQueryInput] = useState(query);
  const requestedSort = searchParams.get('sort');
  const sort = VALID_SORTS.has(requestedSort) ? requestedSort : 'newest';
  const category = searchParams.get('category') || '';
  const maxAllowedPrice = type === 'machinery' ? 2_000_000 : 500_000;
  const minPrice = Math.min(readNumber(searchParams.get('minPrice'), 0), maxAllowedPrice);
  const maxPrice = Math.max(minPrice, Math.min(readNumber(searchParams.get('maxPrice'), maxAllowedPrice), maxAllowedPrice));
  const bedrooms = searchParams.get('bedrooms') || '';
  const make = searchParams.get('make') || '';
  const condition = searchParams.get('condition') || '';
  const fuelType = searchParams.get('fuel') || '';
  const transmission = searchParams.get('transmission') || '';
  const locationId = searchParams.get('location') || '';

  const selectedLocation = locationId ? {
    country: searchParams.get('country') || '',
    state: searchParams.get('province') || '',
    city: locationId,
    cityName: searchParams.get('locationName') || '',
  } : null;

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
    if (!searchParams.has('page')) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('page');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  const suggestionQuery = useDebouncedValue(queryInput.trim().slice(0, 100), 250);

  const request = useMemo(() => ({
    kind: type,
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
  }), [type, query, category, locationId, minPrice, maxPrice, bedrooms, make, condition, fuelType, transmission, sort]);

  const { data: suggestions } = useQuery({
    queryKey: ['public-search-suggestions', type, suggestionQuery],
    queryFn: () => getPublicSearchSuggestions(type, suggestionQuery),
    enabled: suggestionQuery.length >= 2,
    staleTime: 1000 * 60,
  });

  const categorySuggestions = useMemo(() => {
    if (suggestionQuery.length < 2) return [];
    const normalized = suggestionQuery.toLowerCase();
    return CATEGORIES_BY_TYPE[type].filter((item) => item.label.toLowerCase().includes(normalized)).slice(0, 3);
  }, [suggestionQuery, type]);

  const hasSuggestions = Boolean(categorySuggestions.length || suggestions?.listings?.length || suggestions?.locations?.length);

  const resultsQuery = useInfiniteQuery({
    queryKey: ['public-listing-search-page', request],
    queryFn: ({ pageParam }) => searchPublicListingsPage({ ...request, cursor: pageParam || null }),
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
  const priceStep = type === 'machinery' ? 5000 : 1000;
  const hasFilters = Boolean(
    category || locationId || bedrooms || make || condition || fuelType || transmission || minPrice > 0 || maxPrice < maxAllowedPrice,
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
    updateParams({
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
      minPrice: null,
      maxPrice: null,
    });
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

  const updateFilter = (key, value) => updateParams({ [key]: value });

  const activeFilters = useMemo(() => {
    const filters = [];
    if (category) filters.push({ key: 'category', label: optionLabel(CATEGORIES_BY_TYPE[type], category) });
    if (locationId) filters.push({ key: 'location', label: selectedLocation?.cityName || 'Location' });
    if (bedrooms) filters.push({ key: 'bedrooms', label: `${bedrooms}+ bedrooms` });
    if (make) filters.push({ key: 'make', label: make });
    if (condition) filters.push({ key: 'condition', label: optionLabel(CONDITIONS, condition) });
    if (fuelType) filters.push({ key: 'fuel', label: optionLabel(FUEL_TYPES, fuelType) });
    if (transmission) filters.push({ key: 'transmission', label: optionLabel(TRANSMISSIONS, transmission) });
    if (minPrice > 0 || maxPrice < maxAllowedPrice) filters.push({ key: 'price', label: `$${minPrice.toLocaleString()}–$${maxPrice.toLocaleString()}` });
    return filters;
  }, [category, type, locationId, selectedLocation?.cityName, bedrooms, make, condition, fuelType, transmission, minPrice, maxPrice, maxAllowedPrice]);

  const removeFilter = (key) => {
    if (key === 'location') {
      updateParams({ location: null, locationName: null, country: null, province: null });
    } else if (key === 'price') {
      updateParams({ minPrice: null, maxPrice: null });
    } else {
      updateParams({ [key]: null });
    }
  };

  const filterValues = { category, bedrooms, make, condition, fuelType, transmission, minPrice, maxPrice };

  return (
    <div className="min-h-screen bg-background pb-8">
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
            sortLabel={getSortLabel(sort)}
          />
          <div className="mt-3">
            <ActiveFilterChips filters={activeFilters} onRemove={removeFilter} onClear={clearFilters} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
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
        />
      </main>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        type={type}
        filters={filterValues}
        selectedLocation={selectedLocation}
        onLocationChange={(location) => updateParams({ country: location.country, province: location.state, location: location.city, locationName: location.cityName })}
        onUpdate={updateFilter}
        onApplyPrice={(minimum, maximum) => updateParams({ minPrice: minimum || null, maxPrice: maximum >= maxAllowedPrice ? null : maximum })}
        onClear={clearFilters}
        maxAllowedPrice={maxAllowedPrice}
        priceStep={priceStep}
      />

      <SortSheet open={sortOpen} onOpenChange={setSortOpen} value={sort} onChange={(value) => updateParams({ sort: value === 'newest' ? null : value })} />
    </div>
  );
}
