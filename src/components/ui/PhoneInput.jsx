import { useEffect, useId, useMemo, useState } from "react";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/lib/constants";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { composePhoneValue, parsePhoneValue } from "@/lib/phoneNumber";

/**
 * @param {{
 *   value?: string,
 *   onChange: (value: string) => void,
 *   placeholder?: string,
 *   className?: string,
 *   id?: string,
 *   name?: string,
 *   required?: boolean,
 *   disabled?: boolean,
 *   autoComplete?: string,
 *   'aria-describedby'?: string,
 *   'aria-invalid'?: boolean | 'true' | 'false'
 * }} props
 */
export default function PhoneInput({
  value = "",
  onChange,
  placeholder = "Phone number",
  className,
  id,
  name,
  required = false,
  disabled = false,
  autoComplete = "tel",
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}) {
  const generatedId = useId();
  const inputId = id || `phone-${generatedId}`;
  const searchId = `${inputId}-country-search`;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(() => parsePhoneValue(value).country || DEFAULT_COUNTRY_CODE);

  useEffect(() => {
    const parsed = parsePhoneValue(value, selectedCountry);
    if (parsed.country.code !== selectedCountry.code || parsed.country.country !== selectedCountry.country) {
      setSelectedCountry(parsed.country);
    }
  }, [value, selectedCountry]);

  const { number } = parsePhoneValue(value, selectedCountry);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return COUNTRY_CODES;
    return COUNTRY_CODES.filter((country) => (
      country.country.toLowerCase().includes(normalizedSearch)
      || country.code.includes(normalizedSearch)
    ));
  }, [search]);

  const handleCountryChange = (country) => {
    setSelectedCountry(country);
    onChange(composePhoneValue(country, number));
    setOpen(false);
    setSearch("");
  };

  const handleNumberChange = (event) => {
    onChange(composePhoneValue(selectedCountry, event.target.value));
  };

  return (
    <div className={cn("flex gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Choose country calling code. Current selection: ${selectedCountry.country} ${selectedCountry.code}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-input bg-transparent px-2 text-sm transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-xs font-medium text-muted-foreground">{selectedCountry.code}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="z-[9999] w-72 p-0" align="start">
          <div className="border-b p-2">
            <label htmlFor={searchId} className="sr-only">Search country or calling code</label>
            <input
              id={searchId}
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search country..."
              className="w-full bg-transparent px-2 py-1 text-sm outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto" role="listbox" aria-label="Country calling codes">
            {filtered.map((country) => {
              const selected = country.code === selectedCountry.code && country.country === selectedCountry.country;
              return (
                <button
                  key={`${country.code}-${country.country}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleCountryChange(country)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    selected && "bg-primary/5",
                  )}
                >
                  <span className="flex-1 truncate">{country.country}</span>
                  <span className="text-xs font-medium text-muted-foreground">{country.code}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">No countries found</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <Input
        id={inputId}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        value={number}
        onChange={handleNumberChange}
        placeholder={placeholder}
        className="flex-1 rounded-md"
      />
    </div>
  );
}
