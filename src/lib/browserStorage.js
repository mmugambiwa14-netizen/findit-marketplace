function getStorage(kind) {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredString(kind, key, fallback = null) {
  try {
    return getStorage(kind)?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function readStoredJson(kind, key, fallback) {
  const raw = readStoredString(kind, key, null);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    removeStoredValue(kind, key);
    return fallback;
  }
}

export function writeStoredString(kind, key, value) {
  try {
    const storage = getStorage(kind);
    if (!storage) return false;
    storage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function writeStoredJson(kind, key, value) {
  try {
    return writeStoredString(kind, key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function removeStoredValue(kind, key) {
  try {
    const storage = getStorage(kind);
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredValues(kind) {
  try {
    const storage = getStorage(kind);
    if (!storage) return false;
    storage.clear();
    return true;
  } catch {
    return false;
  }
}
