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

const STAGING_BRANCH = 'feature/listing-intelligence-foundation';
const STAGING_SUPABASE_URL = 'https://bwgklpxoetrrkutottdb.supabase.co';
const deploymentBranch = String(import.meta.env.VITE_VERCEL_GIT_COMMIT_REF ?? '').trim();
const isStagingBranch = deploymentBranch === STAGING_BRANCH;

// The staging branch may use its browser-public project URL as a branch-scoped
// fallback so a missing Vercel variable cannot prevent React from mounting.
// Every other deployment still fails closed and must provide its own URL.
const supabaseUrl =
  String(import.meta.env.VITE_SUPABASE_URL ?? '').trim() ||
  (isStagingBranch ? STAGING_SUPABASE_URL : '');
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
