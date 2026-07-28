const DEFAULT_REFERENCE_PREFIX = 'FIT';

export const CUSTOMER_ERROR_DEFINITIONS = Object.freeze({
  AUTH_FAILED: {
    title: 'Sign-in did not complete',
    message: 'We could not complete sign-in. Try again or continue with email.',
    recovery: 'Try again',
    retryable: true,
    preservesWork: true,
  },
  SESSION_EXPIRED: {
    title: 'Session expired',
    message: 'Please sign in again to continue.',
    recovery: 'Sign in again',
    retryable: true,
    preservesWork: true,
  },
  NETWORK_UNAVAILABLE: {
    title: 'Connection problem',
    message: 'Check your connection and try again.',
    recovery: 'Try again',
    retryable: true,
    preservesWork: true,
  },
  LISTING_SAVE_FAILED: {
    title: 'Draft not saved',
    message: 'We could not save the draft on this device. Your current screen is still open.',
    recovery: 'Try saving again',
    retryable: true,
    preservesWork: true,
  },
  LISTING_PUBLISH_FAILED: {
    title: 'Listing not published',
    message: 'We could not publish your listing right now. Your draft has been kept on this device.',
    recovery: 'Try publishing again',
    retryable: true,
    preservesWork: true,
  },
  IMAGE_UPLOAD_FAILED: {
    title: 'Image upload failed',
    message: 'We could not upload this image. Your listing draft is still saved.',
    recovery: 'Try another image or upload again',
    retryable: true,
    preservesWork: true,
  },
  TOUR_UPLOAD_FAILED: {
    title: 'Tour upload failed',
    message: 'We could not finish the Tour upload. The listing or service can still be used.',
    recovery: 'Resume the upload or continue without the Tour',
    retryable: true,
    preservesWork: true,
  },
  TOUR_PROCESSING_FAILED: {
    title: 'Tour could not be processed',
    message: 'The Tour could not be processed. The parent listing remains available.',
    recovery: 'Upload a shorter or clearer video',
    retryable: true,
    preservesWork: true,
  },
  MAP_UNAVAILABLE: {
    title: 'Map unavailable',
    message: 'The map is temporarily unavailable. You can continue browsing in Discover.',
    recovery: 'Use list view',
    retryable: true,
    preservesWork: true,
  },
  LOCATION_SEARCH_FAILED: {
    title: 'Location search unavailable',
    message: 'We could not search locations right now. You can choose a saved location or try again.',
    recovery: 'Try again',
    retryable: true,
    preservesWork: true,
  },
  CHAT_SEND_FAILED: {
    title: 'Message not sent',
    message: 'We could not send your message. Your text is still here.',
    recovery: 'Try sending again',
    retryable: true,
    preservesWork: true,
  },
  REPORT_SUBMISSION_FAILED: {
    title: 'Report not sent',
    message: 'We could not submit the report right now. Please try again.',
    recovery: 'Try again',
    retryable: true,
    preservesWork: true,
  },
  PHONE_VERIFICATION_FAILED: {
    title: 'Phone verification failed',
    message: 'We could not verify that code. Check it and try again.',
    recovery: 'Request or enter a new code',
    retryable: true,
    preservesWork: true,
  },
  PERMISSION_DENIED: {
    title: 'Action unavailable',
    message: 'You do not have permission to do that.',
    recovery: 'Go back or sign in with the right account',
    retryable: false,
    preservesWork: true,
  },
  CONTENT_SUSPENDED: {
    title: 'Content unavailable',
    message: 'This content is not publicly available.',
    recovery: 'Browse other listings',
    retryable: false,
    preservesWork: true,
  },
  ACCOUNT_SUSPENDED: {
    title: 'Account restricted',
    message: 'This account cannot perform that action right now.',
    recovery: 'Contact support',
    retryable: false,
    preservesWork: true,
  },
  UNEXPECTED_FAILURE: {
    title: 'Something went wrong',
    message: 'Something went wrong. Please try again.',
    recovery: 'Try again',
    retryable: true,
    preservesWork: true,
  },
});

function diagnosticReference() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${DEFAULT_REFERENCE_PREFIX}-${Date.now().toString(36).toUpperCase()}-${random}`;
}

function codeFromError(error, fallbackCode) {
  const text = `${error?.message || ''} ${error?.code || ''} ${error?.status || ''}`.toLowerCase();
  if (/network|fetch|offline|timeout|failed to fetch/.test(text)) return 'NETWORK_UNAVAILABLE';
  if (/jwt|session|refresh|expired|invalid_grant/.test(text)) return 'SESSION_EXPIRED';
  if (/permission|rls|42501|not allowed|unauthorized|forbidden/.test(text)) return 'PERMISSION_DENIED';
  if (/image|photo|storage|upload/.test(text)) return 'IMAGE_UPLOAD_FAILED';
  if (/tour|video/.test(text)) return 'TOUR_UPLOAD_FAILED';
  if (/location|geocod|map/.test(text)) return 'LOCATION_SEARCH_FAILED';
  return fallbackCode;
}

export function toCustomerError(error, fallbackCode = 'UNEXPECTED_FAILURE') {
  const code = codeFromError(error, fallbackCode);
  const definition = CUSTOMER_ERROR_DEFINITIONS[code] ?? CUSTOMER_ERROR_DEFINITIONS.UNEXPECTED_FAILURE;
  return {
    code,
    title: definition.title,
    message: definition.message,
    recovery: definition.recovery,
    retryable: definition.retryable,
    preservesWork: definition.preservesWork,
    reference: diagnosticReference(),
    cause: error,
  };
}

export function customerErrorMessage(error, fallbackCode = 'UNEXPECTED_FAILURE') {
  return toCustomerError(error, fallbackCode).message;
}
