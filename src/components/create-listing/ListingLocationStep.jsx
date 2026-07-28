import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { getActiveLocations } from '@/services/locationsService';
import StepNav from './StepNav';

export default function ListingLocationStep({ formData, update, onBack, onContinue }) {
  const [error, setError] = useState('');
  const locations = useQuery({ queryKey: ['locations', 'city'], queryFn: () => getActiveLocations('city') });
  const continueIfValid = () => {
    if (!formData.location_id) return setError('Choose the closest city or town.');
    setError('');
    onContinue();
  };
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">Where is it?</h2><p className="mt-1 text-sm text-muted-foreground">Choose an approximate area so buyers can search confidently.</p></div>
    <div className="rounded-xl border bg-muted/30 p-4"><div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Your exact address stays private</p><p className="mt-1 text-xs text-muted-foreground">FindIt shows only the selected city or town. Share a precise meeting point privately when it is safe.</p></div></div></div>
    {locations.isLoading ? <p className="text-sm text-muted-foreground">Loading locations…</p> : locations.error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm text-destructive">Locations are unavailable.</p><button type="button" className="mt-2 text-sm font-semibold text-primary" onClick={() => locations.refetch()}>Try again</button></div> : <div><label htmlFor="listing-location" className="text-sm font-semibold">City or town *</label><select id="listing-location" value={formData.location_id || ''} onChange={(event) => update('location_id', event.target.value)} className="mt-1 h-12 w-full rounded-xl border bg-background px-3 text-sm"><option value="">Choose a location</option>{(locations.data || []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>}
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <StepNav onBack={onBack} onContinue={continueIfValid} disabled={locations.isLoading || Boolean(locations.error)} />
  </div>;
}
