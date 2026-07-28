import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '@/lib/constants';

const countriesByLongestCode = [...COUNTRY_CODES].sort((left, right) => (
  right.code.length - left.code.length || left.country.localeCompare(right.country)
));

export function normalizePhoneDigits(value = '') {
  const raw = String(value).trim();
  const digits = raw.replace(/\D/g, '');
  return raw.startsWith('+') && digits ? `+${digits}` : digits;
}

export function findCountryForPhone(value = '') {
  const normalized = normalizePhoneDigits(value);
  return countriesByLongestCode.find((country) => normalized.startsWith(country.code)) || DEFAULT_COUNTRY_CODE;
}

export function parsePhoneValue(value = '', preferredCountry = null) {
  const normalized = normalizePhoneDigits(value);
  const parsedCountry = findCountryForPhone(normalized);
  const country = preferredCountry && normalized.startsWith(preferredCountry.code)
    ? preferredCountry
    : parsedCountry;

  return {
    country,
    number: normalized.startsWith(country.code)
      ? normalized.slice(country.code.length)
      : normalized.replace(/^\+/, ''),
  };
}

export function composePhoneValue(country, localNumber = '') {
  const safeCountry = country || DEFAULT_COUNTRY_CODE;
  const digits = String(localNumber).replace(/\D/g, '');
  return `${safeCountry.code}${digits}`;
}
