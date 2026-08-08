// src/lib/supabaseClient.js
//
// Single browser client for the independent Supabase backend.
//
// The deployment environment is configured explicitly by the hosting
// platform. Preview deployments must receive preview/staging Supabase values;
// production must receive production values. There are deliberately no
// environment-specific fallbacks in source.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

const missingVariables = [
  ['VITE_SUPABASE_URL', supabaseUrl],
  ['VITE_SUPABASE_ANON_KEY', supabaseAnonKey],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingVariables.length > 0) {
  throw new Error(
    `FindIt configuration error: missing ${missingVariables.join(', ')}`
  );
}

try {
  const parsedUrl = new URL(supabaseUrl);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('unsupported protocol');
  }
} catch {
  throw new Error(
    'FindIt configuration error: VITE_SUPABASE_URL must be a valid HTTP(S) URL'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
