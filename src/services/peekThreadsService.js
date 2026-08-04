import { readPeekThreadPage } from '@/repositories/peekThreadsRepository';
import {
  normalizePeekThreadPage,
  normalizePeekThreadReadRequest,
} from '@/domain/peekThreads/readContracts';

export async function getPeekThreadPage(input) {
  const request = normalizePeekThreadReadRequest(input);
  const rows = await readPeekThreadPage(request);
  return normalizePeekThreadPage(rows, request.limit);
}
