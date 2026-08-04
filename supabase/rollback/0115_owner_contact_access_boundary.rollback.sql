-- 0115_owner_contact_access_boundary.rollback.sql
--
-- WARNING: restoring the column grant lets any signed-in account bulk-read
-- every seller's contact details straight from the table, bypassing both the
-- 40-per-day reveal cap and the contact_reveal_events audit trail. That is the
-- exact hole 0115 closed, measured on staging before the fix: an ordinary user
-- with no relationship to the seller read 2 contact rows.
--
-- Restore only to unblock an incident, and re-apply promptly.
--
-- The owner_*_contacts functions are left in place. They are ownership-scoped
-- and harmless, and dropping them would break any client already using them.

grant select (contact_phone, contact_whatsapp, contact_email)
  on public.listings to authenticated;

grant select (contact_phone, contact_whatsapp, contact_email)
  on public.services to authenticated;
