-- 0115_owner_contact_access_boundary.sql
--
-- Closes the residual left open by 0109.
--
-- 0109 revoked the seller contact columns from `anon`, but left them granted to
-- `authenticated` because the owner edit flow reads its own values directly to
-- prefill a form. Verified on staging, acting as an ordinary authenticated user
-- with no relationship to the seller:
--
--   select count(contact_phone) from public.listings where seller_id = <other user>
--   -> 2
--
-- So the reveal boundary was bypassable by anyone with a free account: the
-- 40-per-day cap and the contact_reveal_events audit trail applied only to
-- callers who chose to use the RPC. Column access is not row-scoped, so RLS
-- could not distinguish "my own listing" from "someone else's".
--
-- This migration removes the column grant from `authenticated` as well, and
-- replaces the owner read path with two SECURITY DEFINER functions that return
-- contact details only for rows the caller owns.
--
-- Also fixes a real defect in 0109: an owner viewing their own listing consumed
-- reveal budget. Reading your own contact details should never count against a
-- cap meant to slow down harvesting of other people's.

-- 1. Owner-scoped contact access ------------------------------------------

create or replace function public.owner_listing_contacts(p_listing_ids uuid[])
returns table (
  listing_id uuid,
  contact_phone text,
  contact_whatsapp text,
  contact_email text
)
language sql
stable
security definer
set search_path to ''
as $function$
  -- Ownership is the whole filter. No budget and no audit row: this is the
  -- caller's own data, and logging a seller opening their own edit form would
  -- pollute the harvesting signal that contact_reveal_events exists to carry.
  select l.id, l.contact_phone, l.contact_whatsapp, l.contact_email
  from public.listings l
  where l.seller_id = auth.uid()
    and l.id = any(coalesce(p_listing_ids, array[]::uuid[]));
$function$;

create or replace function public.owner_service_contacts(p_service_ids uuid[])
returns table (
  service_id uuid,
  contact_phone text,
  contact_whatsapp text,
  contact_email text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select s.id, s.contact_phone, s.contact_whatsapp, s.contact_email
  from public.services s
  where s.provider_id = auth.uid()
    and s.id = any(coalesce(p_service_ids, array[]::uuid[]));
$function$;

revoke all on function public.owner_listing_contacts(uuid[]) from public;
revoke all on function public.owner_service_contacts(uuid[]) from public;
revoke execute on function public.owner_listing_contacts(uuid[]) from anon;
revoke execute on function public.owner_service_contacts(uuid[]) from anon;
grant execute on function public.owner_listing_contacts(uuid[]) to authenticated;
grant execute on function public.owner_service_contacts(uuid[]) to authenticated;

-- 2. Owners no longer spend reveal budget on their own rows ----------------

create or replace function public.reveal_listing_contact(p_listing_id uuid)
returns table (contact_phone text, contact_whatsapp text, contact_email text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_is_owner boolean;
begin
  if v_user is null then
    raise exception 'authentication required to reveal seller contact details'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.users u where u.id = v_user and u.status = 'active'
  ) then
    raise exception 'authentication required to reveal seller contact details'
      using errcode = '42501';
  end if;

  select exists (
    select 1 from public.listings l where l.id = p_listing_id and l.seller_id = v_user
  ) into v_is_owner;

  if not exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and (
        (l.status in ('available', 'under_offer') and l.content_suspended_at is null)
        or v_is_owner
        or public.is_admin()
      )
  ) then
    raise exception 'listing not available' using errcode = 'P0002';
  end if;

  -- Budget and audit apply to reading someone else's details, not your own.
  if not v_is_owner then
    perform private.assert_contact_reveal_budget(v_user);
    insert into public.contact_reveal_events (user_id, listing_id)
    values (v_user, p_listing_id);
  end if;

  return query
    select l.contact_phone, l.contact_whatsapp, l.contact_email
    from public.listings l
    where l.id = p_listing_id;
end;
$function$;

create or replace function public.reveal_service_contact(p_service_id uuid)
returns table (contact_phone text, contact_whatsapp text, contact_email text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_is_owner boolean;
begin
  if v_user is null then
    raise exception 'authentication required to reveal provider contact details'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.users u where u.id = v_user and u.status = 'active'
  ) then
    raise exception 'authentication required to reveal provider contact details'
      using errcode = '42501';
  end if;

  select exists (
    select 1 from public.services s where s.id = p_service_id and s.provider_id = v_user
  ) into v_is_owner;

  if not exists (
    select 1 from public.services s
    where s.id = p_service_id
      and s.category <> 'legal'
      and (s.status = 'active' or v_is_owner or public.is_admin())
  ) then
    raise exception 'service not available' using errcode = 'P0002';
  end if;

  if not v_is_owner then
    perform private.assert_contact_reveal_budget(v_user);
    insert into public.contact_reveal_events (user_id, service_id)
    values (v_user, p_service_id);
  end if;

  return query
    select s.contact_phone, s.contact_whatsapp, s.contact_email
    from public.services s
    where s.id = p_service_id;
end;
$function$;

revoke execute on function public.reveal_listing_contact(uuid) from anon;
revoke execute on function public.reveal_service_contact(uuid) from anon;
grant execute on function public.reveal_listing_contact(uuid) to authenticated;
grant execute on function public.reveal_service_contact(uuid) to authenticated;

-- 3. Remove the direct column grant ----------------------------------------
-- Done last, so the replacement paths exist before the old one is withdrawn.

revoke select (contact_phone, contact_whatsapp, contact_email)
  on public.listings from authenticated;

revoke select (contact_phone, contact_whatsapp, contact_email)
  on public.services from authenticated;
