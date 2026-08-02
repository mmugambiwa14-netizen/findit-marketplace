import { supabase } from '@/lib/supabaseClient';

/**
 * Seller and provider contact values are not part of the public column grant.
 * They are returned only by these SECURITY DEFINER RPCs, which require an
 * authenticated active account, verify the listing/service is publicly
 * visible (or owned by the caller), enforce a rolling 24h reveal budget, and
 * append to public.contact_reveal_events. See migration 0109.
 *
 * @param {'service' | 'property' | 'car' | 'machinery'} type
 * @param {string} id
 * @returns {Promise<{ contact_phone: string | null, contact_whatsapp: string | null, contact_email: string | null }>}
 */
export async function revealContactDetails(type, id) {
  const isService = type === 'service';
  const { data, error } = await supabase.rpc(
    isService ? 'reveal_service_contact' : 'reveal_listing_contact',
    isService ? { p_service_id: id } : { p_listing_id: id },
  );

  if (error) {
    const failure = new Error(
      error.code === '54000'
        ? 'You have reached the contact limit for today. Please try again later.'
        : 'Unable to load contact details right now.',
    );
    failure.cause = error;
    throw failure;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    contact_phone: row?.contact_phone ?? null,
    contact_whatsapp: row?.contact_whatsapp ?? null,
    contact_email: row?.contact_email ?? null,
  };
}
