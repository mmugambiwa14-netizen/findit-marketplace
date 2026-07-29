import { featureFlags } from '@/lib/featureFlags';

const viteEnv = /** @type {Record<string, string | boolean | undefined>} */ (import.meta.env || {});

export function isPrivatePreviewHost(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

function explicitPreviewAuthBypassEnabled() {
  return viteEnv.DEV === true
    && viteEnv.VITE_PREVIEW_AUTH_BYPASS === 'true';
}

export function localPreviewModeEnabled() {
  if (!featureFlags.toursPreview) return false;
  if (featureFlags.previewFixtures) return true;

  try {
    return isPrivatePreviewHost(new URL(import.meta.env.VITE_SUPABASE_URL).hostname);
  } catch {
    return false;
  }
}

export function localPreviewAuthBypassEnabled() {
  if (!featureFlags.toursPreview || !explicitPreviewAuthBypassEnabled()) return false;

  try {
    return isPrivatePreviewHost(new URL(import.meta.env.VITE_SUPABASE_URL).hostname);
  } catch {
    return false;
  }
}
