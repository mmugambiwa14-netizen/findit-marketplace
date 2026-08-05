export const TRUSTED_STAGING_BRANCHES = Object.freeze([
  'feature/listing-intelligence-foundation',
  'claude/findit-hardening-listing-012cf0',
  'feature/peek-threads-phase-3',
  'feature/contextual-permissions',
  'continuation/release-certification-ci',
]);

const trustedStagingBranches = new Set(TRUSTED_STAGING_BRANCHES);
const STAGING_HOST_PREFIX = 'findit-marketplace-stagi';

export function isTrustedStagingBranch(env = {}) {
  const branch = String(
    env.VITE_VERCEL_GIT_COMMIT_REF
      ?? env.VERCEL_GIT_COMMIT_REF
      ?? '',
  ).trim();
  return trustedStagingBranches.has(branch);
}

export function isTrustedStagingHost(hostname = globalThis.location?.hostname ?? '') {
  const normalized = String(hostname || '').trim().toLowerCase();
  return normalized.startsWith(STAGING_HOST_PREFIX)
    && normalized.endsWith('.vercel.app');
}

export function isTrustedStagingEnvironment(env = {}) {
  return isTrustedStagingBranch(env) || isTrustedStagingHost();
}

export function readBooleanFlag(env = {}, envVar, fallback = false) {
  const raw = env[envVar];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === true;
}

export function resolveStagingCertifiedFlag(env = {}, envVar) {
  return isTrustedStagingEnvironment(env) || readBooleanFlag(env, envVar, false);
}

export function resolveStagingProviderFlag(env = {}, envVar, legacyEnvVar) {
  const raw = env[envVar] ?? env[legacyEnvVar];
  if (raw === 'false' || raw === false) return false;
  return isTrustedStagingEnvironment(env) || raw === 'true' || raw === true;
}
