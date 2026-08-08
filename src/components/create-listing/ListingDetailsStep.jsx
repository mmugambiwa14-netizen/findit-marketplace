import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import StepNav from './StepNav';
import { getSupportedListingCurrencies } from '@/lib/marketConfig';
import {
  getSchema,
  isFieldRequired,
  resolveVisibleFields,
} from '@/domain/listingSchema/registry';
import { toStoragePayload } from '@/services/listingAttributes';

const fieldClass = 'h-11 rounded-xl';
const DEFAULT_OFFER_OPTIONS = Object.freeze([
  { value: 'sale', label: 'For sale' },
  { value: 'rent', label: 'For rent' },
]);
const SUPPORTED_LISTING_KINDS = new Set(['property', 'car', 'machinery']);
const SECTION_LABELS = Object.freeze({
  overview: 'Overview',
  specifications: 'Specifications',
  features: 'Features',
  condition_history: 'Condition & history',
  location: 'Location',
  service_area: 'Service area',
  pricing: 'Pricing details',
  availability: 'Availability',
  documents: 'Documents & status',
});

function additionalSelectOptions(field) {
  const existing = new Set((field.options ?? []).map((option) => option.value));
  const options = [];
  if (field.allowUnknown && !existing.has('unknown')) options.push({ value: 'unknown', label: 'Unknown' });
  if (field.allowNotApplicable && !existing.has('not_applicable')) options.push({ value: 'not_applicable', label: 'Not applicable' });
  return options;
}

export default function ListingDetailsStep({ formData, update, onBack, onContinue }) {
  const [error, setError] = useState('');
  const kind = formData.listing_category;
  const detail = formData.detail ?? {};
  const currencies = getSupportedListingCurrencies(formData.country_code);
  const schema = SUPPORTED_LISTING_KINDS.has(kind) ? getSchema(kind) : null;
  const offerField = schema?.fields.find((field) => field.id === 'listing_type') ?? null;
  const offerOptions = offerField?.options?.length ? offerField.options : DEFAULT_OFFER_OPTIONS;
  const effectiveDetail = kind === 'property'
    ? { ...detail, listing_type: formData.listing_type || detail.listing_type || '' }
    : detail;

  const sections = useMemo(() => {
    if (!schema) return [];
    const grouped = new Map();
    for (const field of resolveVisibleFields(kind, effectiveDetail)) {
      // Property offer type is represented once by the shared offer control.
      if (field.id === 'listing_type') continue;
      if (!grouped.has(field.section)) grouped.set(field.section, []);
      grouped.get(field.section).push(field);
    }
    return [...grouped.entries()].map(([section, fields]) => ({ section, fields }));
  }, [effectiveDetail, kind, schema]);

  const setDetail = (key, value) => {
    setError('');
    update('detail', { ...detail, [key]: value });
  };

  const chooseOffer = (value) => {
    setError('');
    update('listing_type', value);
    if (kind === 'property') update('detail', { ...detail, listing_type: value });
  };

  const toggleMultiselect = (fieldId, optionValue) => {
    const current = Array.isArray(detail[fieldId]) ? detail[fieldId] : [];
    const next = current.includes(optionValue)
      ? current.filter((entry) => entry !== optionValue)
      : [...current, optionValue];
    setDetail(fieldId, next);
  };

  const continueIfValid = () => {
    if (!schema) return setError('Choose a supported listing category first.');
    if (!offerOptions.some((option) => option.value === formData.listing_type)) {
      return setError('Choose an offer type.');
    }
    if ((formData.title || '').trim().length < 10) return setError('Use a clear title with at least 10 characters.');
    if ((formData.description || '').trim().length < 50) return setError('Add at least 50 characters of useful description.');
    if (!(Number(formData.price) > 0)) return setError('Enter a valid price above zero.');

    const preparedDetail = kind === 'property'
      ? { ...detail, listing_type: formData.listing_type }
      : detail;
    const storage = toStoragePayload(kind, preparedDetail);
    if ('errors' in storage) return setError(storage.errors[0]?.message || 'Review the listing details and try again.');

    // Persist only values that remain visible and schema-valid. This clears
    // answers that became irrelevant after a subtype or conditional choice
    // changed, while preserving the subtype dimension in attributes.
    update('detail', { ...storage.attributes.values, ...storage.columns });
    setError('');
    onContinue();
  };

  const renderField = (field) => {
    const id = `listing-detail-${field.id}`;
    const required = isFieldRequired(field, effectiveDetail);
    const value = detail[field.id];
    const label = `${field.label}${required ? ' *' : ''}`;
    const unit = field.unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">({field.unit})</span> : null;

    if (field.input === 'boolean') {
      return (
        <div key={field.id} className="flex min-h-14 items-center justify-between gap-4 rounded-xl border bg-card p-3">
          <div>
            <Label htmlFor={id}>{label}</Label>
            {field.unit && <p className="mt-0.5 text-xs text-muted-foreground">Unit: {field.unit}</p>}
          </div>
          <Switch
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => setDetail(field.id, checked)}
          />
        </div>
      );
    }

    if (field.input === 'multiselect') {
      const selected = Array.isArray(value) ? value : [];
      return (
        <fieldset key={field.id} className="sm:col-span-2">
          <legend className="text-sm font-medium">{label}{unit}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(field.options ?? []).map((option) => (
              <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={selected.includes(option.value)}
                  onChange={() => toggleMultiselect(field.id, option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    if (field.input === 'select') {
      const options = [...(field.options ?? []), ...additionalSelectOptions(field)];
      return (
        <div key={field.id}>
          <Label htmlFor={id}>{label}{unit}</Label>
          <select
            id={id}
            className={`${fieldClass} mt-1 w-full border bg-background px-3 text-sm`}
            value={value ?? ''}
            onChange={(event) => setDetail(field.id, event.target.value)}
          >
            <option value="">Choose {field.label.toLowerCase()}</option>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      );
    }

    if (field.input === 'textarea') {
      return (
        <div key={field.id} className="sm:col-span-2">
          <Label htmlFor={id}>{label}{unit}</Label>
          <Textarea
            id={id}
            className="mt-1 min-h-28 rounded-xl"
            maxLength={field.validation?.maxLength}
            value={value ?? ''}
            onChange={(event) => setDetail(field.id, event.target.value)}
          />
        </div>
      );
    }

    if (field.input === 'number') {
      return (
        <div key={field.id}>
          <Label htmlFor={id}>{label}{unit}</Label>
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step}
            className={`${fieldClass} mt-1`}
            value={value ?? ''}
            onChange={(event) => setDetail(field.id, event.target.value)}
          />
        </div>
      );
    }

    if (field.input === 'date') {
      return (
        <div key={field.id}>
          <Label htmlFor={id}>{label}{unit}</Label>
          <Input
            id={id}
            type="date"
            className={`${fieldClass} mt-1`}
            value={value ?? ''}
            onChange={(event) => setDetail(field.id, event.target.value)}
          />
        </div>
      );
    }

    return (
      <div key={field.id}>
        <Label htmlFor={id}>{label}{unit}</Label>
        <Input
          id={id}
          maxLength={field.validation?.maxLength}
          className={`${fieldClass} mt-1`}
          value={value ?? ''}
          onChange={(event) => setDetail(field.id, event.target.value)}
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Describe your advert</h2>
        <p className="mt-1 text-sm text-muted-foreground">Give buyers structured facts they can compare, filter, and verify.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Offer type *</legend>
        <div className={`grid gap-2 ${offerOptions.length > 2 ? 'sm:grid-cols-4' : 'grid-cols-2'}`}>
          {offerOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => chooseOffer(option.value)}
              className={`min-h-11 rounded-xl border-2 px-3 text-sm font-semibold ${formData.listing_type === option.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label htmlFor="listing-title">Title *</Label>
        <Input id="listing-title" maxLength={160} className={`${fieldClass} mt-1`} value={formData.title || ''} onChange={(event) => update('title', event.target.value)} placeholder="A clear, specific title" />
        <p className="mt-1 text-right text-xs text-muted-foreground">{(formData.title || '').length}/160</p>
      </div>

      <div>
        <Label htmlFor="listing-description">Description *</Label>
        <Textarea id="listing-description" maxLength={5000} className="mt-1 min-h-36 rounded-xl" value={formData.description || ''} onChange={(event) => update('description', event.target.value)} placeholder="Condition, history, important features, and anything a buyer should know" />
        <p className="mt-1 text-right text-xs text-muted-foreground">{(formData.description || '').length}/5000</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <Label htmlFor="listing-price">Price *</Label>
          <Input id="listing-price" type="number" min="0.01" step="0.01" inputMode="decimal" className={`${fieldClass} mt-1`} value={formData.price || ''} onChange={(event) => update('price', event.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label htmlFor="listing-currency">Currency *</Label>
          <select id="listing-currency" className={`${fieldClass} mt-1 w-full border bg-background px-3 text-sm`} value={formData.currency || 'USD'} onChange={(event) => update('currency', event.target.value)}>
            {currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-card p-3">
        <div>
          <p className="text-sm font-semibold">Price is negotiable</p>
          <p className="text-xs text-muted-foreground">Buyers will see a clear negotiable label.</p>
        </div>
        <Switch id="listing-negotiable" aria-label="Price is negotiable" checked={Boolean(formData.negotiable)} onCheckedChange={(value) => update('negotiable', value)} />
      </div>

      {sections.map(({ section, fields }) => (
        <section key={section} className="rounded-2xl border bg-card/45 p-4">
          <div className="mb-4">
            <h3 className="text-base font-bold">{SECTION_LABELS[section] || section}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Only fields relevant to this listing are shown.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(renderField)}
          </div>
        </section>
      ))}

      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <StepNav onBack={onBack} onContinue={continueIfValid} />
    </div>
  );
}
