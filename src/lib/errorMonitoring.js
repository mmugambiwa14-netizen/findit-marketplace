const MAX_REPORTS_PER_WINDOW = 6;
const REPORT_WINDOW_MS = 60_000;
let windowStartedAt = 0;
let reportsInWindow = 0;

function safeText(value, maximum = 240) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maximum);
}

function canReport() {
  const now = Date.now();
  if (now - windowStartedAt >= REPORT_WINDOW_MS) {
    windowStartedAt = now;
    reportsInWindow = 0;
  }
  if (reportsInWindow >= MAX_REPORTS_PER_WINDOW) return false;
  reportsInWindow += 1;
  return true;
}

function reportPayload(error, context = {}) {
  const value = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
  return {
    message: safeText(value.message, 500),
    name: safeText(value.name, 120),
    stack: safeText(value.stack, 1800),
    route: safeText(window.location.pathname, 300),
    context: safeText(context, 300),
    build: safeText(document.querySelector('meta[name="application-version"]')?.getAttribute('content'), 80),
  };
}

export function reportClientError(error, context = '') {
  if (typeof window === 'undefined' || !canReport()) return;
  fetch('/api/client-errors', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(reportPayload(error, context)),
    keepalive: true,
    credentials: 'omit',
  }).catch(() => {
    // Monitoring must never affect the user-facing flow.
  });
}

export function installClientErrorMonitoring() {
  if (typeof window === 'undefined') return () => {};
  const onError = (event) => reportClientError(event.error || event.message, 'window.error');
  const onUnhandledRejection = (event) => reportClientError(event.reason, 'unhandledrejection');
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
