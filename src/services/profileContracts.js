function normalizedUserId(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('User is required');
  return value.trim();
}

function normalizedText(value, label, maximum, required = false) {
  if (typeof value !== 'string') throw new TypeError(`${label} must be text`);
  const normalized = value.trim();
  if (required && !normalized) throw new TypeError(`${label} is required`);
  if (normalized.length > maximum) throw new RangeError(`${label} is too long`);
  return normalized;
}

function normalizedHttpUrl(value, label, maximum) {
  const normalized = normalizedText(value, label, maximum);
  if (!normalized) return null;

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new TypeError(`${label} must be a valid URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError(`${label} must use http or https`);
  }
  return parsed.toString();
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
  if (input.display_name !== undefined) {
    update.display_name = normalizedText(input.display_name, 'Public name', 120) || null;
  }
  if (input.public_address !== undefined) {
    update.public_address = normalizedText(input.public_address, 'Public address', 300) || null;
  }
  if (input.website_url !== undefined) {
    update.website_url = normalizedHttpUrl(input.website_url, 'Website', 2048);
  }
  if (Object.keys(update).length === 0) {
    throw new TypeError('No supported profile fields were provided');
  }
  return update;
}
