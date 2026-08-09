// This checked-in value keeps local Functions builds deterministic. The
// deployment workflow replaces this module in its ephemeral checkout with the
// environment-specific Supabase URL and publishable key immediately before
// Wrangler bundles the Pages Function.
export const generatedPagesRuntimeConfig = Object.freeze({
  supabaseUrl: '',
  supabasePublishableKey: '',
});
