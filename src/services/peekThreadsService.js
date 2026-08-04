import {
  bindResponsePeekRows,
  createPeekRequestRow,
  declinePeekRequestRow,
  mergePeekRequestRows,
  readPeekThreadPage,
  supportPeekRequestRow,
  withdrawPeekRequestSupportRow,
} from '@/repositories/peekThreadsRepository';
import {
  normalizePeekThreadPage,
  normalizePeekThreadReadRequest,
} from '@/domain/peekThreads/readContracts';
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
