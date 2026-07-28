import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getCurrencyConfig, LISTING_CURRENCIES } from "@/lib/marketConfig";

const CurrencyContext = createContext(null);

const STATIC_FALLBACK_RATES = Object.freeze({
  USD: { USD: 1 },
  ZWL: { ZWL: 1 },
  ZAR: { ZAR: 1 },
});

export const CURRENCIES = LISTING_CURRENCIES;

function formatNativeAmount(amount, currencyCode, opts = {}) {
  if (amount == null || amount === "") return "Price on request";
  const currency = getCurrencyConfig(currencyCode);
  const decimals = opts.decimals ?? 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(amount));
  return `${currency.symbol} ${formatted}`;
}

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState("USD");
  const rates = STATIC_FALLBACK_RATES;
  const loadingRates = false;
  const fetchRates = useCallback(async () => STATIC_FALLBACK_RATES, []);

  const setCurrency = useCallback((code) => {
    const normalized = String(code || "USD").toUpperCase();
    setCurrencyState(CURRENCIES.some((candidate) => candidate.code === normalized) ? normalized : "USD");
  }, []);

  const convert = useCallback((amount, fromCurrency = "USD", toCurrency = currency) => {
    if (amount == null || amount === "") return null;
    const source = String(fromCurrency || "USD").toUpperCase();
    const target = String(toCurrency || currency).toUpperCase();
    if (source === target) return Number(amount);
    const rate = rates[source]?.[target];
    return Number.isFinite(rate) ? Number(amount) * rate : null;
  }, [currency, rates]);

  const format = useCallback((amount, opts = {}) => {
    const source = opts.currency || opts.nativeCurrency || "USD";
    const converted = convert(amount, source, currency);
    if (converted == null) return formatNativeAmount(amount, source, opts);
    const label = formatNativeAmount(converted, currency, opts);
    return source === currency ? label : `Approximately ${label}`;
  }, [currency, convert]);

  const value = useMemo(() => ({
    currency,
    setCurrency,
    rates,
    convert,
    format,
    formatNative: formatNativeAmount,
    loadingRates,
    fetchRates,
  }), [convert, currency, fetchRates, format, loadingRates, rates, setCurrency]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
