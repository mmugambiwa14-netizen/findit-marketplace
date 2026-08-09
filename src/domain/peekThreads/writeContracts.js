import { normalizeDeclineReason, normalizePeekRequest } from './requestContracts.js';

function uuidLike(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
}

export function normalizeCreatePeekRequest(input = {}) {
  // Listing/detail surfaces expose the parent as { parentType, parentId } while
  // the domain validator deliberately models the database shape as
  // { listingId, serviceId }. Accept both shapes at this boundary so a valid
  // Request a Peek action reaches create_peek_request instead of being rejected
  // as having no parent before the RPC is called.
  const parentId = typeof input.parentId === 'string' && input.parentId ? input.parentId : null;
  const normalized = normalizePeekRequest({
    ...input,
    listingId: input.listingId ?? (input.parentType === 'listing' ? parentId : null),
    serviceId: input.serviceId ?? (input.parentType === 'service' ? parentId : null),
  });
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

  if (request.ok === false) {
    if (reason.ok === false) return { ok: false, errors: [...request.errors, ...reason.errors] };
    return request;
  }
  if (reason.ok === false) return reason;

  return { ok: true, value: { p_request_id: request.value, p_reason: reason.value } };
}

export function normalizeMergePeekRequests(input) {
  const source = normalizeRequestId(input?.sourceRequestId, 'sourceRequest');
  const target = normalizeRequestId(input?.targetRequestId, 'targetRequest');

  if (source.ok === false) {
    if (target.ok === false) return { ok: false, errors: [...source.errors, ...target.errors] };
    return source;
  }
  if (target.ok === false) return target;
  if (source.value === target.value) {
    return { ok: false, errors: [{ field: 'targetRequest', message: 'Choose a different request to merge into' }] };
  }

  return {
    ok: true,
    value: { p_source_request_id: source.value, p_target_request_id: target.value },
  };
}

export function normalizeResponseBinding(input) {
  const tour = normalizeRequestId(input?.tourId, 'tour');
  const uniqueRequestIds = [...new Set(Array.isArray(input?.requestIds) ? input.requestIds : [])];
  const errors = [];

  if (uniqueRequestIds.length < 1 || uniqueRequestIds.length > 25) {
    errors.push({ field: 'requestIds', message: 'Choose between 1 and 25 Peek Requests' });
  }
  for (const id of uniqueRequestIds) {
    if (!uuidLike(id)) errors.push({ field: 'requestIds', message: 'A selected Peek Request is invalid' });
  }
  if (tour.ok === false) return { ok: false, errors: [...tour.errors, ...errors] };
  if (errors.length) return { ok: false, errors };

  return { ok: true, value: { p_tour_id: tour.value, p_request_ids: uniqueRequestIds } };
}
