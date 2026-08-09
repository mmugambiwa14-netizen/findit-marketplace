import { supabase } from '@/lib/supabaseClient';

function mapPreferences(row) {
  const value = Array.isArray(row) ? row[0] : row;
  return {
    enabled: value?.enabled !== false,
    messages: value?.messages !== false,
    peekActivity: value?.peek_activity !== false,
    listingActivity: value?.listing_activity !== false,
    moderation: value?.moderation !== false,
    productUpdates: value?.product_updates === true,
    updatedAt: value?.updated_at || null,
  };
}

export async function getEmailNotificationPreferences() {
  const { data, error } = await supabase.rpc('get_email_notification_preferences');
  if (error) throw error;
  return mapPreferences(data);
}

export async function updateEmailNotificationPreferences(changes = {}) {
  const { data, error } = await supabase.rpc('update_email_notification_preferences', {
    p_enabled: changes.enabled ?? null,
    p_messages: changes.messages ?? null,
    p_peek_activity: changes.peekActivity ?? null,
    p_listing_activity: changes.listingActivity ?? null,
    p_moderation: changes.moderation ?? null,
    p_product_updates: changes.productUpdates ?? null,
  });
  if (error) throw error;
  return mapPreferences(data);
}
