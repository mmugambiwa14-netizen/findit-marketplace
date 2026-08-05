import { sanitizeText } from '../lib/sanitizeText.js';
const SUPPORT_CATEGORIES = new Set(['account', 'listing', 'report', 'safety', 'technical', 'other']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizedText(value) {
  // Strip null bytes, control, zero-width and bidi characters. A newline is kept
  // so a multi-line support message is preserved.
  return typeof value === 'string' ? sanitizeText(value, { collapseWhitespace: false }) : '';
}

export function normalizeSupportRequest(input = {}) {
  const category = normalizedText(input.category);
  const contactEmail = normalizedText(input.contactEmail).toLowerCase();
  const message = normalizedText(input.message);
  const relatedReference = normalizedText(input.relatedReference);

  if (!SUPPORT_CATEGORIES.has(category)) throw new TypeError('Support category is invalid');
  if (contactEmail.length > 254 || !EMAIL_PATTERN.test(contactEmail)) {
    throw new TypeError('Enter a valid contact email');
  }
  if (message.length < 20 || message.length > 4000) {
    throw new TypeError('Message must be between 20 and 4000 characters');
  }
  if (relatedReference.length > 120) throw new TypeError('Reference is too long');

  return {
    category,
    contactEmail,
    message,
    relatedReference: relatedReference || null,
  };
}
