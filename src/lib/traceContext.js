import { readStoredString, writeStoredString } from '@/lib/browserStorage';

const TRACE_HEADER = 'x-request-id';
const TRACE_STORAGE_KEY = 'peekalisting.trace-session';

function valid(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

export function createTraceId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function getSessionTraceId() {
  try {
    const existing = readStoredString('session', TRACE_STORAGE_KEY, null);
    if (valid(existing)) return existing;
    const next = createTraceId();
    writeStoredString('session', TRACE_STORAGE_KEY, next);
    return next;
  } catch {
    return createTraceId();
  }
}

export function withTraceHeaders(headers = {}, traceId = createTraceId()) {
  const next = new Headers(headers);
  next.set(TRACE_HEADER, traceId);
  next.set('x-trace-session', getSessionTraceId());
  return next;
}

export function traceEvent(event, fields = {}) {
  const record = {
    event,
    traceId: fields.traceId || createTraceId(),
    traceSession: getSessionTraceId(),
    occurredAt: new Date().toISOString(),
    ...fields,
  };
  console.info(JSON.stringify(record));
  return record;
}

export { TRACE_HEADER };
