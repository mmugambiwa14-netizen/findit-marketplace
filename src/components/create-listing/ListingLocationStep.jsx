import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { LAUNCH_COUNTRY_CODE } from '@/lib/marketConfig';
import { getActiveLocations } from '@/services/locationsService';
import InfoHint from '@/components/ui/info-hint';
import StepNav from './StepNav';
import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function ListingLocationStep({ formData, update, onBack, onContinue }) {
  const [error, setError] = useState('');
  const marketCountry = String(formData.country_code || LAUNCH_COUNTRY_CODE).toUpperCase();
  const locations = useQuery({
    queryKey: ['locations', 'city', marketCountry],
    queryFn: () => getActiveLocations('city', null, marketCountry),
  });
  const continueIfValid = () => {
    if (!formData.location_id) return setError('Choose the closest city or town.');
    const selected = (locations.data || []).find((location) => location.id === formData.location_id);
    if (!selected || String(selected.country_code || marketCountry).toUpperCase() !== marketCountry) {
      return setError('Choose a location in the active marketplace.');
    }
    setError('');
    onContinue();
  };
  const chooseLocation = (locationId) => {
    const selected = (locations.data || []).find((location) => location.id === locationId);
    update('location_id', locationId);
    if (selected?.country_code) update('country_code', String(selected.country_code).toUpperCase());
    setError('');
  };

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">Where is it?</h2><p className="mt-1 text-sm text-muted-foreground">Choose an approximate area so buyers can search confidently.</p></div>
    <div className="flex items-center gap-2">
      <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-sm font-semibold">Your exact address stays private</p>
      <InfoHint label="How your location is shown">
        <p>FindIt shows only the selected city or town. Share a precise meeting point privately when it is safe.</p>
      </InfoHint>
    </div>
    {locations.isLoading ? <SkeletonRegion label="Loading locations" className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-12 w-full" /><Skeleton className="h-3 w-48" /></SkeletonRegion> : locations.error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm text-destructive">Locations are unavailable.</p><button type="button" className="mt-2 text-sm font-semibold text-primary" onClick={() => locations.refetch()}>Try again</button></div> : <div><div className="flex items-center gap-1"><label htmlFor="listing-location" className="text-sm font-semibold">City or town *</label><InfoHint label="Available locations"><p>Showing locations available for {marketCountry}.</p></InfoHint></div><select id="listing-location" value={formData.location_id || ''} onChange={(event) => chooseLocation(event.target.value)} className="mt-1 h-12 w-full rounded-xl border bg-background px-3 text-sm"><option value="">Choose a location</option>{(locations.data || []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>}
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <StepNav onBack={onBack} onContinue={continueIfValid} disabled={locations.isLoading || Boolean(locations.error)} />
  </div>;
}
