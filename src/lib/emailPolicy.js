// Signup email policy (client-side).
//
// Two jobs: reject addresses that are not plausibly deliverable, and reject
// disposable / throwaway domains that exist only to evade accountability. This
// runs in the browser for immediate feedback; it is NOT the enforcement point.
// The before_user_created database hook (migration
// 20260805110000_reject_disposable_signup_emails) applies the same blocklist
// server-side, so a caller that skips this check is still refused by Supabase
// Auth before any user row is created.
//
// The blocklist is intentionally a curated set of the highest-volume disposable
// providers rather than an exhaustive list — an exhaustive list is tens of
// thousands of domains, goes stale weekly, and belongs in a maintained data
// feed, not in source. The database hook reads the same list, and both can be
// extended by editing DISPOSABLE_EMAIL_DOMAINS here and the seed in the hook
// migration.

export const DISPOSABLE_EMAIL_DOMAINS = Object.freeze([
  '0-mail.com', '10minutemail.com', '10minutemail.net', '20minutemail.com',
  '33mail.com', 'anonbox.net', 'byom.de', 'chacuo.net', 'dispostable.com',
  'discard.email', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net',
  'fakemailgenerator.com', 'getairmail.com', 'getnada.com', 'guerrillamail.com',
  'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'harakirimail.com', 'inboxbear.com', 'inboxkitten.com', 'jetable.org',
  'mailcatch.com', 'maildrop.cc', 'maileater.com', 'mailinator.com',
  'mailinator.net', 'mailnesia.com', 'mailsac.com', 'mailtemp.info',
  'mintemail.com', 'mohmal.com', 'moakt.com', 'mytemp.email', 'nada.email',
  'no-spam.ws', 'nowmymail.com', 'objectmail.com', 'sharklasers.com',
  'spam4.me', 'spamgourmet.com', 'temp-mail.io', 'temp-mail.org',
  'tempinbox.com', 'tempmail.com', 'tempmail.dev', 'tempmail.net',
  'tempmailo.com', 'tempr.email', 'throwawaymail.com', 'trashmail.com',
  'trashmail.de', 'trashmail.net', 'wegwerfmail.de', 'yopmail.com',
  'yopmail.fr', 'yopmail.net', 'yovy.co', 'yuurok.com',
]);

const DISPOSABLE_SET = new Set(DISPOSABLE_EMAIL_DOMAINS);

// A pragmatic single-address pattern. It is deliberately not RFC 5322 (which
// permits quoted local parts and IP-literal domains no marketplace user types);
// it rejects whitespace, missing @, missing dot in the domain and a leading or
// trailing dot in the domain.
const EMAIL_PATTERN = /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]{2,}$/;

/**
 * Extract the lowercased registrable-ish domain (everything after the last
 * at-sign).
 * @param {string} email
 * @returns {string}
 */
export function emailDomain(email) {
  const at = typeof email === 'string' ? email.lastIndexOf('@') : -1;
  return at === -1 ? '' : email.slice(at + 1).trim().toLowerCase();
}

/**
 * Is this a known disposable / throwaway domain?
 * Matches the exact domain and any subdomain of it, so `x.mailinator.com` is
 * caught as well as `mailinator.com`.
 * @param {string} email
 * @returns {boolean}
 */
export function isDisposableEmail(email) {
  const domain = emailDomain(email);
  if (!domain) return false;
  if (DISPOSABLE_SET.has(domain)) return true;
  // Subdomain match: walk parent domains.
  const labels = domain.split('.');
  for (let i = 1; i < labels.length - 1; i += 1) {
    if (DISPOSABLE_SET.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

/**
 * Returns a user-facing error string, or '' when the email is acceptable.
 * Mirrors passwordPolicyError so Register.jsx can use the same guard shape.
 * @param {unknown} email
 * @returns {string}
 */
export function emailPolicyError(email) {
  const value = typeof email === 'string' ? email.trim() : '';
  if (!value) return 'Enter your email address';
  if (value.length > 254) return 'Email address is too long';
  if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email address';
  if (isDisposableEmail(value)) {
    return 'Disposable email addresses are not allowed. Use a permanent address.';
  }
  return '';
}
