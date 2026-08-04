import { supabase } from '@/lib/supabaseClient';

const CATEGORY_KEYS = new Set(['property', 'car', 'machinery', 'service']);

export async function getDiscoverCategoryCounts() {
  const { data, error } = await supabase.rpc('discover_category_counts');
  if (error) throw new Error('Could not load marketplace category counts');

  return Object.fromEntries(
    (Array.isArray(data) ? data : [])
      .filter((row) => CATEGORY_KEYS.has(row?.category_key))
      .map((row) => [row.category_key, Math.max(0, Number(row.item_count) || 0)]),
  );
}
