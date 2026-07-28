export function sanitizeReturnTo(value, fallback = '/') {
  if (typeof value !== 'string') return fallback;
  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return fallback;
  return candidate || fallback;
}

export function createLoginPath(returnTo) {
  const safeReturnTo = sanitizeReturnTo(returnTo);
  return `/login?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function createRegisterPath(returnTo) {
  const safeReturnTo = sanitizeReturnTo(returnTo);
  return `/register?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
