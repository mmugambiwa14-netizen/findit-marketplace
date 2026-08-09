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

const STAGING_BRANCHES = new Set([
  'feature/listing-intelligence-foundation',
  'claude/findit-hardening-listing-012cf0',
  'feature/peek-threads-phase-3',
]);
const STAGING_SUPABASE_URL = 'https://bwgklpxoetrrkutottdb.supabase.co';
const STAGING_SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_D1bWn2S-Dh4vbrzYVLa3GQ_UQXrMcWb';
const deploymentBranch = String(import.meta.env.VITE_VERCEL_GIT_COMMIT_REF ?? '').trim();
const isStagingBranch = STAGING_BRANCHES.has(deploymentBranch);

const SUBMISSION_RPC_NAMES = new Set([
  'create_peek_request',
  'support_peek_request',
  'withdraw_peek_request_support',
  'submit_business_application',
  'respond_to_business_application',
  'submit_managed_listing_request',
]);

function stagingLikeOrigin() {
  if (typeof window === 'undefined') return false;
  const explicitPreview = String(import.meta.env.VITE_PREVIEW_DEPLOYMENT || '').trim().toLowerCase() === 'true';
  const hostname = String(window.location.hostname || '').trim().toLowerCase();
  return explicitPreview
    || hostname.includes('staging')
    || hostname.startsWith('findit-marketplace-stagi')
    || hostname.startsWith('peekalisting-stagi');
}

function rpcNameFromRequest(input) {
  const rawUrl = typeof input === 'string' ? input : input?.url;
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
    const match = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)/);
    if (!match) return null;
    const name = decodeURIComponent(match[1]);
    return SUBMISSION_RPC_NAMES.has(name) ? name : null;
  } catch {
    return null;
  }
}

function emitSubmissionDiagnostic(message, phase, rpcName = null, status = null) {
  if (!stagingLikeOrigin() || typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('peekalisting:submission-diagnostic', {
    detail: { message, phase, rpcName, status, at: Date.now() },
  }));
}

async function tracedFetch(input, init) {
  const rpcName = rpcNameFromRequest(input);
  if (!rpcName) return fetch(input, init);

  emitSubmissionDiagnostic(`Sending ${rpcName}`, 'sending', rpcName);
  try {
    const response = await fetch(input, init);
    emitSubmissionDiagnostic(
      `${rpcName} returned HTTP ${response.status}`,
      response.ok ? 'success' : 'error',
      rpcName,
      response.status,
    );
    return response;
  } catch (error) {
    emitSubmissionDiagnostic(
      `${rpcName} failed before an HTTP response: ${error?.message || 'network error'}`,
      'error',
      rpcName,
    );
    throw error;
  }
}

// Only the explicitly trusted staging branch lineage may use this
// browser-public Supabase URL and publishable key as fallbacks. This keeps
// stacked staging previews usable when Vercel Preview variables are absent,
// while every unrelated branch and all production deployments still fail
// closed and require their own environment-specific values.
const supabaseUrl =
  String(import.meta.env.VITE_SUPABASE_URL ?? '').trim() ||
  (isStagingBranch ? STAGING_SUPABASE_URL : '');
const supabaseAnonKey =
  String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim() ||
  (isStagingBranch ? STAGING_SUPABASE_PUBLISHABLE_KEY : '');

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
  global: {
    fetch: tracedFetch,
  },
});
