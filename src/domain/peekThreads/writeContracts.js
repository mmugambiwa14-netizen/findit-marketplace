import { normalizeDeclineReason, normalizePeekRequest } from './requestContracts.js';

function uuidLike(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
}

export function normalizeCreatePeekRequest(input) {
  const normalized = normalizePeekRequest(input);
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    value: {
      p_listing_id: normalized.value.listing_id,
      p_service_id: normalized.value.service_id,
      p_category: normalized.value.category,
      p_body: normalized.value.body,
    },
  };
}

export function normalizeRequestId(value, field = 'request') {
  if (!uuidLike(value)) {
    return { ok: false, errors: [{ field, message: 'Choose a valid Peek Request' }] };
  }
  return { ok: true, value: String(value) };
}

export function normalizeDeclinePeekRequest(input) {
  const request = normalizeRequestId(input?.requestId);
  const reason = normalizeDeclineReason(input?.reason);
  const errors = [...(request.ok ? [] : request.errors), ...(reason.ok ? [] : reason.errors)];
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { p_request_id: request.value, p_reason: reason.value } };
}

export function normalizeMergePeekRequests(input) {
  const source = normalizeRequestId(input?.sourceRequestId, 'sourceRequest');
  const target = normalizeRequestId(input?.targetRequestId, 'targetRequest');
  const errors = [...(source.ok ? [] : source.errors), ...(target.ok ? [] : target.errors)];
  if (source.ok && target.ok && source.value === target.value) {
    errors.push({ field: 'targetRequest', message: 'Choose a different request to merge into' });
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: { p_source_request_id: source.value, p_target_request_id: target.value },
  };
}

export function normalizeResponseBinding(input) {
  const tour = normalizeRequestId(input?.tourId, 'tour');
  const uniqueRequestIds = [...new Set(Array.isArray(input?.requestIds) ? input.requestIds : [])];
  const errors = tour.ok ? [] : [...tour.errors];
  if (uniqueRequestIds.length < 1 || uniqueRequestIds.length > 25) {
    errors.push({ field: 'requestIds', message: 'Choose between 1 and 25 Peek Requests' });
  }
  for (const id of uniqueRequestIds) {
    if (!uuidLike(id)) errors.push({ field: 'requestIds', message: 'A selected Peek Request is invalid' });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { p_tour_id: tour.value, p_request_ids: uniqueRequestIds } };
}
