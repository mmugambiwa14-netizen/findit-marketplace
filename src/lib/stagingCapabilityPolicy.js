export const TRUSTED_NON_PRODUCTION_DEPLOYMENTS = Object.freeze([
  'preview',
  'staging',
]);

const trustedNonProductionDeployments = new Set(TRUSTED_NON_PRODUCTION_DEPLOYMENTS);
const TRUSTED_STAGING_HOSTS = new Set([
  'staging.peekalisting.com',
]);

export function isTrustedStagingDeployment(env = {}) {
  const deployment = String(env.VITE_DEPLOY_ENV ?? '').trim().toLowerCase();
  return trustedNonProductionDeployments.has(deployment);
}

export function isTrustedStagingHost(hostname = globalThis.location?.hostname ?? '') {
  const normalized = String(hostname || '').trim().toLowerCase();
  return TRUSTED_STAGING_HOSTS.has(normalized);
}

export function isTrustedStagingEnvironment(env = {}) {
  return isTrustedStagingDeployment(env) || isTrustedStagingHost();
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
