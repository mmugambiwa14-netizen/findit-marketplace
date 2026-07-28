import { updateOwnProfileRow } from '@/repositories/profileRepository';
import { normalizeProfileIdentity, normalizeProfileUpdate } from '@/services/profileContracts';

export async function updateOwnProfile(userId, input) {
  return updateOwnProfileRow(
    normalizeProfileIdentity(userId),
    normalizeProfileUpdate(input),
  );
}
