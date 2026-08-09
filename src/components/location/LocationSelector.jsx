import { useEffect, useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, LocateFixed, MapPinned } from 'lucide-react';
import { getActiveLocations } from '@/services/locationsService';
import { currentLocationErrorMessage, resolveCurrentMarketplaceLocation } from '@/services/currentLocationService';
import { featureFlags } from '@/lib/featureFlags';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LocationPermissionDialog } from '@/components/location/LocationPermissionDialog';
import { PlaceSearchCombobox } from '@/components/location/PlaceSearchCombobox';
import { buildLocationSelection } from '@/services/locationSelectionContracts';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

const LOCATION_CACHE_MS = 1000 * 60 * 60;

export function LocationSelector({ value, onChange, level = 'country', parentId = null, disabled = false }) {
  const generatedId = useId();
  const triggerId = `location-${level}-${generatedId}`;
  const { data: locations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['locations', level, parentId],
    queryFn: () => getActiveLocations(level, parentId),
    staleTime: LOCATION_CACHE_MS,
    gcTime: LOCATION_CACHE_MS * 24,
  });

  if (isLoading) {
    return <SkeletonRegion label={`Loading ${level} locations`} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></SkeletonRegion>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={triggerId} className="text-sm font-medium">
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Label>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled || isError}>
        <SelectTrigger id={triggerId} className="rounded-lg" aria-invalid={isError || undefined}>
          <SelectValue placeholder={`Select ${level}...`} />
        </SelectTrigger>
        <SelectContent>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError ? (
        <p className="text-xs text-destructive" role="alert">
          Locations could not be loaded.{' '}
          <button type="button" className="font-semibold underline" onClick={() => refetch()}>Retry</button>
        </p>
      ) : null}
    </div>
  );
}

export function HierarchicalLocationSelector({ value, onSelectLocation }) {
  const generatedId = useId();
  const countryId = `country-${generatedId}`;
  const stateId = `state-${generatedId}`;
  const [country, setCountry] = useState(value?.country || '');
  const [state, setState] = useState(value?.state || '');
  const [city, setCity] = useState(value?.city || '');
  const [cityName, setCityName] = useState(value?.cityName || '');
  const [locating, setLocating] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [currentLocationError, setCurrentLocationError] = useState('');

  useEffect(() => {
    setCountry(value?.country || '');
    setState(value?.state || '');
    setCity(value?.city || '');
    setCityName(value?.cityName || '');
  }, [value?.country, value?.state, value?.city, value?.cityName]);

  const countriesQuery = useQuery({
    queryKey: ['locations-countries', 'sub-saharan'],
    queryFn: () => getActiveLocations('country'),
    staleTime: LOCATION_CACHE_MS,
    gcTime: LOCATION_CACHE_MS * 24,
  });
  const countries = countriesQuery.data || [];
  const selectedCountry = useMemo(
    () => countries.find((candidate) => candidate.id === country) || null,
    [countries, country],
  );
  const selectedCountryCode = selectedCountry?.country_code || value?.countryCode || null;

  const statesQuery = useQuery({
    queryKey: ['locations-states', country, selectedCountryCode],
    queryFn: () => getActiveLocations('province', country, selectedCountryCode),
    enabled: Boolean(country && selectedCountryCode),
    staleTime: LOCATION_CACHE_MS,
    gcTime: LOCATION_CACHE_MS * 24,
  });
  const states = statesQuery.data || [];

  const handleCountrySelect = (countryIdValue) => {
    setCountry(countryIdValue);
    setState('');
    setCity('');
    setCityName('');
    setCurrentLocationError('');
  };

  const handleStateSelect = (stateIdValue) => {
    setState(stateIdValue);
    setCity('');
    setCityName('');
    setCurrentLocationError('');
  };

  const handlePlaceSelect = (place) => {
    setCity(place.id);
    setCityName(place.name);
    setCurrentLocationError('');
    const stateName = states.find((candidate) => candidate.id === state)?.name || '';
    // Coordinates travel with the confirmed selection. searchMarketplacePlaces
    // already maps them through withCoordinates, and dropping them here meant
    // the canonical place survived a draft restore while its coordinates did
    // not, leaving the map nothing to centre on. Part III §8 requires both to
    // be preserved together.
    onSelectLocation(buildLocationSelection(place, {
      country,
      countryName: selectedCountry?.name || '',
      countryCode: selectedCountryCode,
      state,
      stateName,
    }));
  };

  const handleCurrentLocation = async () => {
    if (locating) return;
    setLocating(true);
    setCurrentLocationError('');
    try {
      const resolved = await resolveCurrentMarketplaceLocation({ consentGranted: true });
      setCountry(resolved.country);
      setState(resolved.state);
      setCity(resolved.city);
      setCityName(resolved.cityName);
      onSelectLocation(resolved);
    } catch (error) {
      setCurrentLocationError(currentLocationErrorMessage(error));
    } finally {
      setLocating(false);
    }
  };

  const locationListError = countriesQuery.isError || statesQuery.isError;

  return (
    <div className="space-y-4">
      {featureFlags.currentLocation ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3.5">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MapPinned className="h-4 w-4" aria-hidden="true" /></span>
            <div>
              <p className="text-sm font-semibold text-foreground">Start near you—or browse anywhere</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Location only suggests a starting point. Country selection always stays unlocked.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPermissionOpen(true)}
            disabled={locating}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {locating ? 'Matching your nearest place…' : 'Use my current location'}
          </button>
          {currentLocationError ? <p className="mt-2 text-xs text-destructive" role="alert">{currentLocationError}</p> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {countriesQuery.isLoading ? <SkeletonRegion label="Loading countries" className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></SkeletonRegion> : <div className="space-y-2">
          <Label htmlFor={countryId}>Country</Label>
          <Select value={country} onValueChange={handleCountrySelect} disabled={countriesQuery.isLoading || countriesQuery.isError || locating}>
            <SelectTrigger id={countryId} className="rounded-lg">
              <SelectValue placeholder="Select country..." />
            </SelectTrigger>
            <SelectContent>
              {countries.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>}

        {statesQuery.isLoading ? <SkeletonRegion label="Loading regions" className="space-y-2 md:col-span-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-10 w-full" /></SkeletonRegion> : <div className="space-y-2 md:col-span-2">
          <Label htmlFor={stateId}>Province, state or region</Label>
          <Select value={state} onValueChange={handleStateSelect} disabled={!country || statesQuery.isLoading || statesQuery.isError || locating}>
            <SelectTrigger id={stateId} className="rounded-lg">
              <SelectValue placeholder={!country ? 'Select a country first' : 'Select a province, state or region...'} />
            </SelectTrigger>
            <SelectContent>
              {states.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>}

        <PlaceSearchCombobox
          parentId={state}
          value={city}
          selectedName={cityName}
          onSelect={handlePlaceSelect}
          disabled={locating}
        />
      </div>

      {locationListError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
          <p className="text-xs text-destructive">One or more location lists could not be loaded.</p>
          <button
            type="button"
            className="text-xs font-semibold text-destructive underline"
            onClick={() => Promise.all([countriesQuery.refetch(), country ? statesQuery.refetch() : null])}
          >
            Retry
          </button>
        </div>
      ) : null}

      <p className="text-[11px] leading-5 text-muted-foreground">
        Place data © <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">GeoNames</a> and administrative boundaries © <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">geoBoundaries</a>, both CC BY 4.0.
      </p>

      <LocationPermissionDialog
        open={permissionOpen}
        onOpenChange={setPermissionOpen}
        onAllow={() => { setPermissionOpen(false); void handleCurrentLocation(); }}
      />
    </div>
  );
}
