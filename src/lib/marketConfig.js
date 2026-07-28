export const COUNTRY_STATES = Object.freeze({
  ACTIVE: 'active',
  BROWSE_ONLY: 'browse_only',
  UNAVAILABLE: 'unavailable',
});

export const LAUNCH_COUNTRY_CODE = 'ZW';

export const COUNTRY_CONFIGS = Object.freeze({
  ZW: Object.freeze({
    code: 'ZW',
    name: 'Zimbabwe',
    state: COUNTRY_STATES.ACTIVE,
    supportedListingCurrencies: ['USD', 'ZWL', 'ZAR'],
    defaultListingCurrency: 'USD',
    defaultDisplayCurrency: 'USD',
    currencyPrecision: { USD: 0, ZWL: 0, ZAR: 0 },
    currencyNotices: {
      USD: 'Seller-native US dollar price.',
      ZWL: 'Confirm accepted payment method with the seller.',
      ZAR: 'Confirm accepted payment method with the seller.',
    },
  }),
});

export const LISTING_CURRENCIES = Object.freeze([
  { code: 'USD', name: 'US Dollar', symbol: 'US$' },
  { code: 'ZWL', name: 'Zimbabwe Dollar', symbol: 'ZWL' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
]);

export function getCountryConfig(countryCode = LAUNCH_COUNTRY_CODE) {
  return COUNTRY_CONFIGS[String(countryCode || '').toUpperCase()] ?? COUNTRY_CONFIGS[LAUNCH_COUNTRY_CODE];
}

export function getSupportedListingCurrencies(countryCode = LAUNCH_COUNTRY_CODE) {
  const supported = new Set(getCountryConfig(countryCode).supportedListingCurrencies);
  return LISTING_CURRENCIES.filter((currency) => supported.has(currency.code));
}

export function getCurrencyConfig(code = 'USD') {
  return LISTING_CURRENCIES.find((currency) => currency.code === code) ?? LISTING_CURRENCIES[0];
}

export function isSupportedListingCurrency(code, countryCode = LAUNCH_COUNTRY_CODE) {
  return getCountryConfig(countryCode).supportedListingCurrencies.includes(String(code || '').toUpperCase());
}
