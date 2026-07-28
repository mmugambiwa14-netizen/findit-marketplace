import { createContext, useContext, useState, useCallback } from "react";

const CurrencyContext = createContext(null);

const MVP_RATES = { USD: 1 };

export const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
];

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState("USD");
  const rates = MVP_RATES;
  const loadingRates = false;
  const fetchRates = useCallback(async () => MVP_RATES, []);

  const setCurrency = useCallback((code) => {
    // V1 prices are USD-only. Keep the context setter for component
    // compatibility, but reject unsupported legacy conversion choices.
    setCurrencyState(code === "USD" ? code : "USD");
  }, []);

  // Convert a USD price to the selected currency
  const convert = useCallback((usdAmount) => {
    if (!usdAmount && usdAmount !== 0) return null;
    const rate = rates[currency] || 1;
    return usdAmount * rate;
  }, [currency, rates]);

  // Format a converted price with symbol
  const format = useCallback((usdAmount, opts = {}) => {
    if (!usdAmount && usdAmount !== 0) return "—";
    const converted = convert(usdAmount);
    const curr = CURRENCIES.find(c => c.code === currency);
    const symbol = curr?.symbol || currency;
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: opts.decimals ?? (currency === "USD" ? 0 : 0),
      maximumFractionDigits: opts.decimals ?? 0,
    }).format(converted);
    return `${symbol}${formatted}`;
  }, [currency, convert]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, convert, format, loadingRates, fetchRates }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
