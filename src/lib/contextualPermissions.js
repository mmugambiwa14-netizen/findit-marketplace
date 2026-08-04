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
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey(kind)) === 'seen';
  } catch {
    return false;
  }
}

export function markPermissionIntroSeen(kind) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(kind), 'seen');
  } catch {
    // Permission education must never block the requested product action.
  }
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
    return 'unknown';
  }
}

export function openBrowserPermissionSettings() {
  return false;
}
