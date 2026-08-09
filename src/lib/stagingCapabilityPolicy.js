export const TRUSTED_STAGING_BRANCHES = Object.freeze([
  'feature/listing-intelligence-foundation',
  'claude/findit-hardening-listing-012cf0',
  'feature/peek-threads-phase-3',
  'feature/contextual-permissions',
  'continuation/release-certification-ci',
]);

export const TRUSTED_NON_PRODUCTION_DEPLOYMENTS = Object.freeze([
  'preview',
  'staging',
]);

const trustedStagingBranches = new Set(TRUSTED_STAGING_BRANCHES);
const trustedNonProductionDeployments = new Set(TRUSTED_NON_PRODUCTION_DEPLOYMENTS);
const LEGACY_STAGING_HOST_PREFIX = 'findit-marketplace-stagi';
const TRUSTED_STAGING_HOSTS = new Set([
  'staging.peekalisting.com',
]);

export function isTrustedStagingDeployment(env = {}) {
  const deployment = String(env.VITE_DEPLOY_ENV ?? '').trim().toLowerCase();
  return trustedNonProductionDeployments.has(deployment);
}

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
  if (TRUSTED_STAGING_HOSTS.has(normalized)) return true;

  // Preserve the old staging preview boundary during the Cloudflare cutover.
  // It is compatibility-only; staging.peekalisting.com is the canonical host.
  return normalized.startsWith(LEGACY_STAGING_HOST_PREFIX)
    && normalized.endsWith('.vercel.app');
}

export function isTrustedStagingEnvironment(env = {}) {
  return isTrustedStagingDeployment(env)
    || isTrustedStagingBranch(env)
    || isTrustedStagingHost();
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
