// Pricing remains presentation/protocol metadata for the current service form.
// Service domains, specializations, labels, hierarchy, aliases and market
// availability are owned by the canonical database taxonomy and must not be
// reintroduced here as source-code arrays.
export const PRICING_TYPES = [
  { value: "fixed", label: "Fixed price" },
  { value: "starting_from", label: "Starting from" },
  { value: "hourly", label: "Per hour" },
  { value: "daily", label: "Per day" },
  { value: "quote_required", label: "Quote required" },
  { value: "contact_for_price", label: "Contact for price" },
];
