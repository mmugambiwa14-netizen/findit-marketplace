import { insertSupportRequest } from '@/repositories/contactSupportRepository';
import { normalizeSupportRequest } from '@/services/contactSupportContracts';

export async function submitSupportRequest(input) {
  const result = await insertSupportRequest(normalizeSupportRequest(input));
  if (!result?.received || typeof result.referenceId !== 'string') {
    throw new Error('The support request was not confirmed');
  }
  return { referenceId: result.referenceId };
}
