import { supabase } from '@/lib/supabaseClient';

function normalizePreference(value) {
  return {
    contractVersion: Number.isInteger(value?.contractVersion) ? value.contractVersion : 1,
    enabled: value?.enabled === true,
    consentVersion: Number.isInteger(value?.consentVersion) ? value.consentVersion : 1,
    enabledAt: typeof value?.enabledAt === 'string' ? value.enabledAt : null,
    disabledAt: typeof value?.disabledAt === 'string' ? value.disabledAt : null,
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : null,
  };
}

export async function getRecommendationPersonalizationPreference() {
  const { data, error } = await supabase.rpc('get_my_recommendation_personalization_v1');
  if (error) throw Object.assign(new Error('Unable to load recommendation privacy settings'), { cause: error });
  return normalizePreference(data);
}

export async function setRecommendationPersonalizationPreference(enabled) {
  if (typeof enabled !== 'boolean') throw new TypeError('Personalization preference must be true or false');
  const { data, error } = await supabase.rpc('set_my_recommendation_personalization_v1', {
    p_enabled: enabled,
  });
  if (error) throw Object.assign(new Error('Unable to update recommendation privacy settings'), { cause: error });
  return normalizePreference(data);
}

export async function clearRecommendationPersonalizationData() {
  const { data, error } = await supabase.rpc('clear_my_recommendation_personalization_data_v1');
  if (error) throw Object.assign(new Error('Unable to clear recommendation activity'), { cause: error });
  return {
    cleared: data?.cleared === true,
    removedEvents: Number.isInteger(data?.removedEvents) ? data.removedEvents : 0,
    personalizationEnabled: data?.personalizationEnabled === true,
  };
}
