import { sanitizeText } from '../lib/sanitizeText.js';
function normalizedUserId(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('User is required');
  return value.trim();
}

function normalizedText(value, label, maximum, required = false) {
  if (typeof value !== 'string') throw new TypeError(`${label} must be text`);
  // Strip null bytes, control, zero-width and bidi characters. The bidi strip in
  // particular stops a display name from rendering as something other than what
  // is stored.
  const normalized = sanitizeText(value, { collapseWhitespace: false });
  if (required && !normalized) throw new TypeError(`${label} is required`);
  if (normalized.length > maximum) throw new RangeError(`${label} is too long`);
  return normalized;
}

export function normalizeProfileIdentity(userId) {
  return normalizedUserId(userId);
}

export function normalizeProfileUpdate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Profile update is required');
  }

  const update = {};
  if (input.full_name !== undefined) {
    update.full_name = normalizedText(input.full_name, 'Full name', 120, true);
  }
  if (input.bio !== undefined) {
    update.bio = normalizedText(input.bio, 'Bio', 500) || null;
  }
  if (Object.keys(update).length === 0) {
    throw new TypeError('No supported profile fields were provided');
  }
  return update;
}
