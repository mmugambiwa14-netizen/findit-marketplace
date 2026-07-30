import { supabase } from '@/lib/supabaseClient';
import { readStoredString, writeStoredString } from '@/lib/browserStorage';

const SUPPORTED_PARENT_TYPES = new Set(['listing', 'service']);

export async function recordMarketplaceView(parentType, parentId) {
  if (!SUPPORTED_PARENT_TYPES.has(parentType)) throw new TypeError('Unsupported marketplace parent type');
  if (typeof parentId !== 'string' || !parentId.trim()) throw new TypeError('Marketplace item id is required');

  const storageKey = `findit.viewed.${parentType}.${parentId}`;
  if (readStoredString('session', storageKey, null) === '1') return null;

  const { data, error } = await supabase.rpc('record_marketplace_view', {
    p_parent_type: parentType,
    p_parent_id: parentId,
  });

  if (error) {
    const failure = new Error('Unable to record this view');
    failure.cause = error;
    throw failure;
  }

  writeStoredString('session', storageKey, '1');
  const views = Number(data);
  return Number.isFinite(views) ? Math.max(0, views) : null;
}
