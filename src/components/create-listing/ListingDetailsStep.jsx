import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import StepNav from './StepNav';

const fieldClass = 'h-11 rounded-xl';

export default function ListingDetailsStep({ formData, update, onBack, onContinue }) {
  const [error, setError] = useState('');
  const kind = formData.listing_category;
  const detail = formData.detail ?? {};
  const setDetail = (key, value) => update('detail', { ...detail, [key]: value });

  const continueIfValid = () => {
    if (!['sale', 'rent'].includes(formData.listing_type)) return setError('Choose whether this is for sale or rent.');
    if ((formData.title || '').trim().length < 10) return setError('Use a clear title with at least 10 characters.');
    if ((formData.description || '').trim().length < 50) return setError('Add at least 50 characters of useful description.');
    if (!(Number(formData.price) > 0)) return setError('Enter a valid price above zero.');
    if (kind === 'property' && !detail.propertyType) return setError('Choose a property type.');
    if (kind === 'car' && (!detail.brand || !detail.model || !detail.fuelType || !detail.transmission)) return setError('Add the vehicle make, model, fuel type, and transmission.');
    if (kind === 'machinery' && (!detail.machineryType || !detail.brand || !detail.model || !detail.condition)) return setError('Add the machinery type, make, model, and condition.');
    setError('');
    onContinue();
  };

  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold">Describe your advert</h2><p className="mt-1 text-sm text-muted-foreground">Give buyers the facts they need to evaluate it.</p></div>
    <fieldset className="space-y-2"><legend className="text-sm font-semibold">Offer type *</legend><div className="grid grid-cols-2 gap-2">{[['sale', 'For sale'], ['rent', 'For rent']].map(([value, label]) => <button type="button" key={value} onClick={() => update('listing_type', value)} className={`h-11 rounded-xl border-2 text-sm font-semibold ${formData.listing_type === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>{label}</button>)}</div></fieldset>
    <div><Label htmlFor="listing-title">Title *</Label><Input id="listing-title" maxLength={160} className={`${fieldClass} mt-1`} value={formData.title || ''} onChange={(event) => update('title', event.target.value)} placeholder="A clear, specific title" /><p className="mt-1 text-right text-xs text-muted-foreground">{(formData.title || '').length}/160</p></div>
    <div><Label htmlFor="listing-description">Description *</Label><Textarea id="listing-description" maxLength={5000} className="mt-1 min-h-36 rounded-xl" value={formData.description || ''} onChange={(event) => update('description', event.target.value)} placeholder="Condition, history, important features, and anything a buyer should know" /><p className="mt-1 text-right text-xs text-muted-foreground">{(formData.description || '').length}/5000</p></div>
    <div><Label htmlFor="listing-price">Price (USD) *</Label><Input id="listing-price" type="number" min="0.01" step="0.01" inputMode="decimal" className={`${fieldClass} mt-1`} value={formData.price || ''} onChange={(event) => update('price', event.target.value)} placeholder="0.00" /></div>
    <div className="flex items-center justify-between rounded-xl border bg-card p-3"><div><p className="text-sm font-semibold">Price is negotiable</p><p className="text-xs text-muted-foreground">Buyers will see a clear negotiable label.</p></div><Switch id="listing-negotiable" aria-label="Price is negotiable" checked={Boolean(formData.negotiable)} onCheckedChange={(value) => update('negotiable', value)} /></div>

    {kind === 'property' && <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="property-type">Property type *</Label><select id="property-type" className={`${fieldClass} mt-1 w-full border bg-background px-3 text-sm`} value={detail.propertyType || ''} onChange={(event) => setDetail('propertyType', event.target.value)}><option value="">Choose type</option><option value="house">House</option><option value="apartment">Apartment</option><option value="land">Land</option><option value="commercial">Commercial</option><option value="other">Other</option></select></div>
      <div><Label htmlFor="property-size">Size (m²)</Label><Input id="property-size" type="number" min="0" className={`${fieldClass} mt-1`} value={detail.sizeSqm || ''} onChange={(event) => setDetail('sizeSqm', event.target.value)} /></div>
      <div><Label htmlFor="bedrooms">Bedrooms</Label><Input id="bedrooms" type="number" min="0" className={`${fieldClass} mt-1`} value={detail.bedrooms ?? ''} onChange={(event) => setDetail('bedrooms', event.target.value)} /></div>
      <div><Label htmlFor="bathrooms">Bathrooms</Label><Input id="bathrooms" type="number" min="0" className={`${fieldClass} mt-1`} value={detail.bathrooms ?? ''} onChange={(event) => setDetail('bathrooms', event.target.value)} /></div>
    </div>}

    {kind === 'car' && <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="car-brand">Make *</Label><Input id="car-brand" className={`${fieldClass} mt-1`} value={detail.brand || ''} onChange={(event) => setDetail('brand', event.target.value)} /></div>
      <div><Label htmlFor="car-model">Model *</Label><Input id="car-model" className={`${fieldClass} mt-1`} value={detail.model || ''} onChange={(event) => setDetail('model', event.target.value)} /></div>
      <div><Label htmlFor="car-year">Year</Label><Input id="car-year" type="number" min="1900" max={new Date().getFullYear() + 1} className={`${fieldClass} mt-1`} value={detail.year || ''} onChange={(event) => setDetail('year', event.target.value)} /></div>
      <div><Label htmlFor="car-mileage">Mileage (km)</Label><Input id="car-mileage" type="number" min="0" className={`${fieldClass} mt-1`} value={detail.mileage || ''} onChange={(event) => setDetail('mileage', event.target.value)} /></div>
      <div><Label htmlFor="fuel-type">Fuel type *</Label><select id="fuel-type" className={`${fieldClass} mt-1 w-full border bg-background px-3 text-sm`} value={detail.fuelType || ''} onChange={(event) => setDetail('fuelType', event.target.value)}><option value="">Choose fuel</option><option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="electric">Electric</option><option value="hybrid">Hybrid</option></select></div>
      <div><Label htmlFor="transmission">Transmission *</Label><select id="transmission" className={`${fieldClass} mt-1 w-full border bg-background px-3 text-sm`} value={detail.transmission || ''} onChange={(event) => setDetail('transmission', event.target.value)}><option value="">Choose transmission</option><option value="manual">Manual</option><option value="automatic">Automatic</option></select></div>
      <div className="sm:col-span-2"><Label htmlFor="car-condition">Condition</Label><Input id="car-condition" className={`${fieldClass} mt-1`} value={detail.condition || ''} onChange={(event) => setDetail('condition', event.target.value)} placeholder="e.g. Good" /></div>
    </div>}

    {kind === 'machinery' && <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="machinery-type">Machinery type *</Label><select id="machinery-type" className={`${fieldClass} mt-1 w-full border bg-background px-3 text-sm`} value={detail.machineryType || ''} onChange={(event) => setDetail('machineryType', event.target.value)}><option value="">Choose type</option><option value="construction">Construction</option><option value="agricultural">Agricultural</option><option value="industrial">Industrial</option><option value="transport">Transport</option><option value="other">Other</option></select></div>
      <div><Label htmlFor="machinery-condition">Condition *</Label><select id="machinery-condition" className={`${fieldClass} mt-1 w-full border bg-background px-3 text-sm`} value={detail.condition || ''} onChange={(event) => setDetail('condition', event.target.value)}><option value="">Choose condition</option><option value="new">New</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_repair">Needs repair</option></select></div>
      <div><Label htmlFor="machinery-brand">Make *</Label><Input id="machinery-brand" className={`${fieldClass} mt-1`} value={detail.brand || ''} onChange={(event) => setDetail('brand', event.target.value)} /></div>
      <div><Label htmlFor="machinery-model">Model *</Label><Input id="machinery-model" className={`${fieldClass} mt-1`} value={detail.model || ''} onChange={(event) => setDetail('model', event.target.value)} /></div>
      <div><Label htmlFor="machinery-year">Year</Label><Input id="machinery-year" type="number" min="1900" max={new Date().getFullYear() + 1} className={`${fieldClass} mt-1`} value={detail.year || ''} onChange={(event) => setDetail('year', event.target.value)} /></div>
      <div><Label htmlFor="usage-hours">Usage hours</Label><Input id="usage-hours" type="number" min="0" className={`${fieldClass} mt-1`} value={detail.usageHours || ''} onChange={(event) => setDetail('usageHours', event.target.value)} /></div>
    </div>}
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <StepNav onBack={onBack} onContinue={continueIfValid} />
  </div>;
}
