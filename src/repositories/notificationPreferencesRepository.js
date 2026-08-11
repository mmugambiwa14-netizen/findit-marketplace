import { supabase } from '@/lib/supabaseClient';

function mapPreferences(row) {
  const value = Array.isArray(row) ? row[0] : row;
  return {
    pushEnabled: value?.push_enabled !== false,
    inAppSoundEnabled: value?.in_app_sound_enabled !== false,
  };
}

export async function getNotificationPreferences() {
  const { data, error } = await supabase.rpc('get_notification_preferences');
  if (error) throw error;
  return mapPreferences(data);
}

export async function updateNotificationPreferences(changes = {}) {
  const { data, error } = await supabase.rpc('update_notification_preferences', {
    p_push_enabled: changes.pushEnabled ?? null,
    p_in_app_sound_enabled: changes.inAppSoundEnabled ?? null,
  });
  if (error) throw error;
  return mapPreferences(data);
}
