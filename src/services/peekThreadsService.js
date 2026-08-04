import {
  bindResponsePeekRows,
  createPeekRequestRow,
  declinePeekRequestRow,
  invokeResponsePeekPlayback,
  mergePeekRequestRows,
  readPeekThreadPage,
  readSellerPeekRequestQueue,
  supportPeekRequestRow,
  withdrawPeekRequestSupportRow,
} from '@/repositories/peekThreadsRepository';
import {
  normalizePeekThreadPage,
  normalizePeekThreadReadRequest,
} from '@/domain/peekThreads/readContracts';
import {
  normalizeSellerPeekQueuePage,
  normalizeSellerPeekQueueRequest,
} from '@/domain/peekThreads/sellerQueueContracts';
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
  const rows = await readPeekThreadPage(request);
  return normalizePeekThreadPage(rows, request.limit);
}

export async function getSellerPeekRequestQueue(input = {}) {
  const request = normalizeSellerPeekQueueRequest(input);
  const rows = await readSellerPeekRequestQueue(request);
  return normalizeSellerPeekQueuePage(rows, request.limit);
}

export function getResponsePeekPlayback(tourId) {
  return invokeResponsePeekPlayback(requireValid(normalizeRequestId(tourId)));
}

export function createPeekRequest(input) {
  return createPeekRequestRow(requireValid(normalizeCreatePeekRequest(input)));
}

export function supportPeekRequest(requestId) {
  return supportPeekRequestRow(requireValid(normalizeRequestId(requestId)));
}

export function withdrawPeekRequestSupport(requestId) {
  return withdrawPeekRequestSupportRow(requireValid(normalizeRequestId(requestId)));
}

export function declinePeekRequest(input) {
  return declinePeekRequestRow(requireValid(normalizeDeclinePeekRequest(input)));
}

export function mergePeekRequests(input) {
  return mergePeekRequestRows(requireValid(normalizeMergePeekRequests(input)));
}

export function bindResponsePeek(input) {
  return bindResponsePeekRows(requireValid(normalizeResponseBinding(input)));
}
