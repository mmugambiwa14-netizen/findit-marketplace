-- 0109_seller_contact_reveal_boundary.rollback.sql
--
-- WARNING: this restores anonymous read access to seller contact details.
-- 0109 exists because `anon` could read every published seller's phone,
-- WhatsApp and email using only the public key that ships in the bundle.
-- Rolling it back reopens that. Do it only to unblock an incident, and
-- re-apply promptly.
--
-- public.contact_reveal_events is deliberately NOT dropped. It holds the
-- reveal audit trail, it is inert once the RPCs are gone, and destroying
-- evidence during an incident rollback is the wrong default. Drop it manually
-- if it is genuinely unwanted.
--
-- The has_contact_* columns are generated, so removing them discards nothing:
-- every value is derived from the contact columns that remain.

drop function if exists public.reveal_listing_contact(uuid);
drop function if exists public.reveal_service_contact(uuid);
drop function if exists private.assert_contact_reveal_budget(uuid);

grant select (contact_phone, contact_whatsapp, contact_email)
  on public.listings to anon;
grant select (contact_phone, contact_whatsapp, contact_email)
  on public.services to anon;

alter table public.listings
  drop column if exists has_contact_phone,
  drop column if exists has_contact_whatsapp,
  drop column if exists has_contact_email;

alter table public.services
  drop column if exists has_contact_phone,
  drop column if exists has_contact_whatsapp,
  drop column if exists has_contact_email;
