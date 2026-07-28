import { useId, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveLocations } from "@/services/locationsService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function LocationSelector({ value, onChange, level = "country", parentId = null, disabled = false }) {
  const generatedId = useId();
  const triggerId = `location-${level}-${generatedId}`;
  const { data: locations = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["locations", level, parentId],
    queryFn: () => getActiveLocations(level, parentId),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={triggerId} className="text-sm font-medium">
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Label>
      <Select value={value || ""} onValueChange={onChange} disabled={disabled || isLoading || isError}>
        <SelectTrigger id={triggerId} className="rounded-lg" aria-invalid={isError || undefined}>
          <SelectValue placeholder={isLoading ? `Loading ${level}...` : `Select ${level}...`} />
        </SelectTrigger>
        <SelectContent>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && (
        <p className="text-xs text-destructive" role="alert">
          Locations could not be loaded.{' '}
          <button type="button" className="font-semibold underline" onClick={() => refetch()}>Retry</button>
        </p>
      )}
    </div>
  );
}

// Multi-level location selector (Country → State → City)
export function HierarchicalLocationSelector({ value, onSelectLocation }) {
  const generatedId = useId();
  const countryId = `country-${generatedId}`;
  const stateId = `state-${generatedId}`;
  const cityId = `city-${generatedId}`;
  const [country, setCountry] = useState(value?.country || "");
  const [state, setState] = useState(value?.state || "");
  const [city, setCity] = useState(value?.city || "");

  useEffect(() => {
    setCountry(value?.country || "");
    setState(value?.state || "");
    setCity(value?.city || "");
  }, [value?.country, value?.state, value?.city]);

  const countriesQuery = useQuery({
    queryKey: ["locations-countries"],
    queryFn: () => getActiveLocations("country"),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const statesQuery = useQuery({
    queryKey: ["locations-states", country],
    queryFn: () => getActiveLocations("province", country),
    enabled: Boolean(country),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const citiesQuery = useQuery({
    queryKey: ["locations-cities", state],
    queryFn: () => getActiveLocations("city", state),
    enabled: Boolean(state),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const countries = countriesQuery.data || [];
  const states = statesQuery.data || [];
  const cities = citiesQuery.data || [];

  const handleCountrySelect = (countryIdValue) => {
    setCountry(countryIdValue);
    setState("");
    setCity("");
    onSelectLocation(null);
  };

  const handleStateSelect = (stateIdValue) => {
    setState(stateIdValue);
    setCity("");
    onSelectLocation(null);
  };

  const handleCitySelect = (cityIdValue) => {
    setCity(cityIdValue);
    const cityName = cities.find((candidate) => candidate.id === cityIdValue)?.name || "";
    onSelectLocation({ country, state, city: cityIdValue, cityName });
  };

  const locationError = countriesQuery.isError || statesQuery.isError || citiesQuery.isError;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={countryId}>Country</Label>
          <Select value={country} onValueChange={handleCountrySelect} disabled={countriesQuery.isLoading || countriesQuery.isError}>
            <SelectTrigger id={countryId} className="rounded-lg">
              <SelectValue placeholder={countriesQuery.isLoading ? "Loading countries..." : "Select country..."} />
            </SelectTrigger>
            <SelectContent>
              {countries.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={stateId}>State/Province</Label>
          <Select value={state} onValueChange={handleStateSelect} disabled={!country || statesQuery.isLoading || statesQuery.isError}>
            <SelectTrigger id={stateId} className="rounded-lg">
              <SelectValue placeholder={!country ? "Select a country first" : statesQuery.isLoading ? "Loading states..." : "Select state..."} />
            </SelectTrigger>
            <SelectContent>
              {states.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={cityId}>City</Label>
          <Select value={city} onValueChange={handleCitySelect} disabled={!state || citiesQuery.isLoading || citiesQuery.isError}>
            <SelectTrigger id={cityId} className="rounded-lg">
              <SelectValue placeholder={!state ? "Select a state first" : citiesQuery.isLoading ? "Loading cities..." : "Select city..."} />
            </SelectTrigger>
            <SelectContent>
              {cities.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {locationError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
          <p className="text-xs text-destructive">One or more location lists could not be loaded.</p>
          <button
            type="button"
            className="text-xs font-semibold text-destructive underline"
            onClick={() => Promise.all([countriesQuery.refetch(), country ? statesQuery.refetch() : null, state ? citiesQuery.refetch() : null])}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
