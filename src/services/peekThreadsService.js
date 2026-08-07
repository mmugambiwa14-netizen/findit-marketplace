import {
  acceptPeekRequestRow,
  bindResponsePeekRows,
  cancelPeekRequestFulfilmentRow,
  createPeekRequestRow,
  declinePeekRequestRow,
  invokeResponsePeekPlayback,
  mergePeekRequestRows,
  readMyPeekRequestActivityPage,
  readPeekThreadPage,
  readResponsePeekRequestCandidates,
  readSellerPeekRequestQueue,
  readUnboundResponsePeeks,
  supportPeekRequestRow,
  withdrawPeekRequestSupportRow,
} from '@/repositories/peekThreadsRepository';
import { normalizePeekActivityPage, normalizePeekActivityRequest } from '@/domain/peekThreads/activityContracts';
import { normalizePeekThreadPage, normalizePeekThreadReadRequest } from '@/domain/peekThreads/readContracts';
import { normalizeSellerPeekQueuePage, normalizeSellerPeekQueueRequest } from '@/domain/peekThreads/sellerQueueContracts';
import {
  normalizeCreatePeekRequest,
  normalizeDeclinePeekRequest,
  normalizeMergePeekRequests,
  normalizeRequestId,
  normalizeResponseBinding,
} from '@/domain/peekThreads/writeContracts';

function requireValid(result) {
  if (result.ok) return result.value;
  const error = new Error(result.errors[0]?.message || 'Invalid Peek Request');
  error.validationErrors = result.errors;
  throw error;
}

export async function getPeekThreadPage(input) {
  const request = normalizePeekThreadReadRequest(input);
  return normalizePeekThreadPage(await readPeekThreadPage(request), request.limit);
}

export async function getMyPeekRequestActivityPage(input = {}) {
  const request = normalizePeekActivityRequest(input);
  return normalizePeekActivityPage(await readMyPeekRequestActivityPage(request), request.limit);
}

export async function getSellerPeekRequestQueue(input = {}) {
  const request = normalizeSellerPeekQueueRequest(input);
  return normalizeSellerPeekQueuePage(await readSellerPeekRequestQueue(request), request.limit);
}

export async function getUnboundResponsePeeks() {
  return (await readUnboundResponsePeeks()).map((row) => ({
    tourId: row.tour_id,
    parentType: row.parent_type,
    parentId: row.listing_id ?? row.service_id,
    parentKind: row.parent_kind,
    parentTitle: row.parent_title,
    publishedAt: row.published_at,
    pendingRequestCount: Number(row.pending_request_count) || 0,
  }));
}

export async function getResponsePeekRequestCandidates(tourId) {
  const id = requireValid(normalizeRequestId(tourId));
  return (await readResponsePeekRequestCandidates(id)).map((row) => ({
    requestId: row.request_id,
    category: row.category,
    body: row.body,
    supporterCount: Number(row.supporter_count) || 0,
    createdAt: row.created_at,
  }));
}

export function getResponsePeekPlayback(tourId) { return invokeResponsePeekPlayback(requireValid(normalizeRequestId(tourId))); }
export function createPeekRequest(input) { return createPeekRequestRow(requireValid(normalizeCreatePeekRequest(input))); }
export function supportPeekRequest(requestId) { return supportPeekRequestRow(requireValid(normalizeRequestId(requestId))); }
export function withdrawPeekRequestSupport(requestId) { return withdrawPeekRequestSupportRow(requireValid(normalizeRequestId(requestId))); }
export function declinePeekRequest(input) { return declinePeekRequestRow(requireValid(normalizeDeclinePeekRequest(input))); }
export function mergePeekRequests(input) { return mergePeekRequestRows(requireValid(normalizeMergePeekRequests(input))); }
export function bindResponsePeek(input) { return bindResponsePeekRows(requireValid(normalizeResponseBinding(input))); }
export function acceptPeekRequest(requestId) { return acceptPeekRequestRow(requireValid(normalizeRequestId(requestId))); }
export function cancelPeekRequestFulfilment(requestId, reason = null) {
  const id = requireValid(normalizeRequestId(requestId));
  const normalizedReason = typeof reason === 'string' ? reason.trim().slice(0, 500) || null : null;
  return cancelPeekRequestFulfilmentRow(id, normalizedReason);
}