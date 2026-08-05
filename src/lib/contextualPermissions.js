import { readStoredString, writeStoredString } from '@/lib/browserStorage';

const STORAGE_PREFIX = 'findit:permission-intro:';

export const PERMISSION_KINDS = Object.freeze({
  CAMERA: 'camera',
  LOCATION: 'location',
  NOTIFICATIONS: 'notifications',
  MICROPHONE: 'microphone',
});

function storageKey(kind) {
  return `${STORAGE_PREFIX}${kind}`;
}

export function hasSeenPermissionIntro(kind) {
  return readStoredString('local', storageKey(kind)) === 'seen';
}

export function markPermissionIntroSeen(kind) {
  writeStoredString('local', storageKey(kind), 'seen');
}

export async function readBrowserPermissionState(kind) {
  if (typeof navigator === 'undefined') return 'unsupported';

  if (kind === PERMISSION_KINDS.NOTIFICATIONS) {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  }

  if (!navigator.permissions?.query) return 'unknown';

  const permissionName = kind === PERMISSION_KINDS.LOCATION ? 'geolocation' : kind;
  try {
    const status = await navigator.permissions.query({ name: permissionName });
    return status.state;
  } catch {
    // Camera and microphone permission queries are not supported consistently
    // across browsers. The product action can still invoke the native prompt.
    return 'unknown';
  }
}
