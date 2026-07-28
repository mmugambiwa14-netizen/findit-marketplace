import { featureFlags } from '@/lib/featureFlags';

export function isPrivatePreviewHost(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

export function localPreviewModeEnabled() {
  if (!featureFlags.toursPreview) return false;

  try {
    return isPrivatePreviewHost(new URL(import.meta.env.VITE_SUPABASE_URL).hostname);
  } catch {
    return false;
  }
}
