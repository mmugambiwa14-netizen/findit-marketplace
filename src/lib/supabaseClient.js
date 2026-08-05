// src/lib/supabaseClient.js
//
// Single browser client for the independent Supabase backend.
//
// Per the architecture principle "the frontend should never communicate
// directly with Supabase" -- this file is the ONLY place the Supabase SDK is
// imported. Everything else (pages, components, hooks) will go through
// src/services/*, which import this client and remain the only application
// consumers. The Phase 2A/2B auth service now uses this boundary; future
// domain repositories must preserve the same rule.

import { createClient } from '@supabase/supabase-js';

// Every deployment supplies its own Supabase URL and publishable key through
// the environment. There is deliberately no in-source fallback.
//
// A previous revision embedded the staging project URL and publishable key here
// and used them whenever the build came from one of a hardcoded set of branch
// names. That kept stacked previews convenient, but it put credential material
// in git, tied backend selection to branch naming, and meant renaming a branch
// silently changed which database the app talked to. Preview environments now
// set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY like every other
// environment; a preview without them fails closed here rather than reaching
// for someone else's project.
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
