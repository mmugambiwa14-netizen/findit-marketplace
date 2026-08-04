const TECHNICAL_PATTERN = /(?:postgres|postgrest|supabase|sqlstate|row-level security|\brls\b|\bjwt\b|fetch failed|failed to fetch|networkerror|typeerror|referenceerror|syntaxerror|constraint|duplicate key|violates|\brpc\b|edge function|status code|\b[45]\d\d\b|[a-z_]{3,}\([^)]*\)|\bPGRST\d+\b|\b23\d{3}\b)/i;

const RULES = [
  { pattern: /invalid login credentials|invalid email or password|email.*password.*invalid/i, message: 'The email or password is incorrect.' },
  { pattern: /email not confirmed|confirm.*email/i, message: 'Confirm your email address before logging in.' },
  { pattern: /user already registered|already.*account|email.*already/i, message: 'An account already exists for this email.' },
  { pattern: /password.*(?:short|length|weak)/i, message: 'Choose a stronger password with at least 8 characters.' },
  { pattern: /rate limit|too many requests|too many attempts/i, message: 'Too many attempts. Please wait a moment and try again.' },
  { pattern: /not authenticated|authentication required|jwt.*expired|session.*expired/i, message: 'Your session has expired. Log in again to continue.' },
  { pattern: /camera.*denied|camera.*blocked|notallowederror/i, message: 'Camera access is off. Allow it in your device settings, or upload a video instead.' },
  { pattern: /location.*denied|geolocation.*denied/i, message: 'Location access is off. Allow it in your device settings, or choose a location manually.' },
  { pattern: /notification.*denied|push.*denied/i, message: 'Notifications are off. You can enable them in your device settings.' },
  { pattern: /permission denied|not allowed|forbidden|unauthorized/i, message: 'You do not have permission to do that.' },
  { pattern: /network|offline|failed to fetch|fetch failed|connection/i, message: 'Check your internet connection and try again.' },
  { pattern: /timeout|timed out/i, message: 'This is taking longer than expected. Please try again.' },
  { pattern: /not found|does not exist/i, message: 'This item is no longer available.' },
  { pattern: /conversation.*blocked|message.*blocked|cannot send.*blocked/i, message: 'This conversation is blocked.' },
  { pattern: /message.*closed|conversation.*closed|cannot send/i, message: 'This conversation is closed.' },
  { pattern: /file.*large|too large|maximum.*size|250 mb/i, message: 'This file is too large. Choose one under 250 MB.' },
  { pattern: /mime|file type|unsupported.*video|(?:mp4|mov|webm).*(?:required|only)/i, message: 'Choose an MP4, MOV, or WebM video.' },
  { pattern: /duration|too long|120 seconds|2 minutes/i, message: 'Choose a video that is 2 minutes or shorter.' },
  { pattern: /upload.*interrupted|upload.*failed|storage/i, message: 'The upload did not finish. Check your connection and try again.' },
  { pattern: /processing/i, message: 'The Peek could not be prepared. Try uploading it again.' },
  { pattern: /duplicate|already exists/i, message: 'This has already been added.' },
];

function rawMessage(error) {
  if (typeof error === 'string') return error.trim();
  if (error && typeof error.message === 'string') return error.message.trim();
  return '';
}

export function userFacingError(error, fallback = 'Something went wrong. Please try again.') {
  const message = rawMessage(error);
  if (!message) return fallback;

  const matched = RULES.find((rule) => rule.pattern.test(message));
  if (matched) return matched.message;

  if (TECHNICAL_PATTERN.test(message) || message.length > 180) return fallback;
  return message
    .replace(/\s+/g, ' ')
    .replace(/[.;:]?\s*(?:code|details|hint|stack):.*$/i, '')
    .trim() || fallback;
}

export function shouldShowError(error) {
  const message = rawMessage(error);
  if (!message) return false;
  return !/aborterror|cancelled|canceled|stale request|superseded|background refresh/i.test(message);
}

export function reportError(error, context = 'application') {
  if (import.meta.env?.DEV) console.error(`[${context}]`, error);
}
