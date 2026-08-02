-- 0109_seller_contact_reveal_boundary.sql
--
-- Seller contact details (phone, WhatsApp, email) were readable by the `anon`
-- role on public.listings and public.services. RLS is row-level, so the
-- `listings_public_read_available` / `services_public_read_active` policies
-- combined with column-level SELECT grants to `anon` exposed every published
-- seller's contact record to anyone holding the public anon key -- which ships
-- in the browser bundle by design. Automated harvesting of these fields is the
-- primary real-world abuse target for a classifieds marketplace.
--
-- This migration:
--   1. Adds derived "has contact" booleans so listing cards can keep rendering
--      Call / WhatsApp / Email affordances without carrying the values.
--   2. Revokes the raw contact columns from `anon`.
--   3. Adds an authenticated, logged, rate-limited reveal RPC as the only
--      client path to the actual values.
--
-- Scope note: `authenticated` retains column SELECT because the owner edit
-- flow (ownerListingsRepository -> EditListingDialog) reads a seller's own
-- contact fields directly. Closing that too requires routing owner reads
-- through an RPC and is deliberately left as a separate change.

-- 1. Derived presence flags -------------------------------------------------

alter table public.listings
  add column if not exists has_contact_phone boolean
    generated always as (contact_phone is not null and btrim(contact_phone) <> '') stored,
  add column if not exists has_contact_whatsapp boolean
    generated always as (contact_whatsapp is not null and btrim(contact_whatsapp) <> '') stored,
  add column if not exists has_contact_email boolean
    generated always as (contact_email is not null and btrim(contact_email) <> '') stored;

alter table public.services
  add column if not exists has_contact_phone boolean
    generated always as (contact_phone is not null and btrim(contact_phone) <> '') stored,
  add column if not exists has_contact_whatsapp boolean
    generated always as (contact_whatsapp is not null and btrim(contact_whatsapp) <> '') stored,
  add column if not exists has_contact_email boolean
    generated always as (contact_email is not null and btrim(contact_email) <> '') stored;

grant select (has_contact_phone, has_contact_whatsapp, has_contact_email)
  on public.listings to anon, authenticated;

grant select (has_contact_phone, has_contact_whatsapp, has_contact_email)
  on public.services to anon, authenticated;

-- 2. Remove the anonymous read path on the raw values -----------------------

revoke select (contact_phone, contact_whatsapp, contact_email)
  on public.listings from anon;

revoke select (contact_phone, contact_whatsapp, contact_email)
  on public.services from anon;

-- 3. Reveal audit log -------------------------------------------------------

create table if not exists public.contact_reveal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  service_id uuid references public.services (id) on delete cascade,
  revealed_at timestamptz not null default now(),
  constraint contact_reveal_events_single_subject check (
    (listing_id is not null and service_id is null)
    or (listing_id is null and service_id is not null)
  )
);

create index if not exists idx_contact_reveal_events_user_recent
  on public.contact_reveal_events (user_id, revealed_at desc);

alter table public.contact_reveal_events enable row level security;

-- Readable only by the acting user and admins. No client INSERT/UPDATE/DELETE
-- policy exists, so the log is append-only through the SECURITY DEFINER RPCs.
drop policy if exists contact_reveal_events_own_read on public.contact_reveal_events;
create policy contact_reveal_events_own_read
  on public.contact_reveal_events
  for select
  using (user_id = auth.uid() or public.is_admin());

grant select on public.contact_reveal_events to authenticated;

-- 4. Reveal RPCs ------------------------------------------------------------

-- The `private` schema holds helpers that must never be reachable over
-- PostgREST. Staging already has it; production does not, so create it
-- idempotently rather than assuming. No USAGE is granted to anon or
-- authenticated -- the SECURITY DEFINER callers below run as owner.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

-- Rolling 24h cap per account. Generous for a genuine buyer, restrictive for
-- an automated harvester, and every reveal is attributable.
create or replace function private.assert_contact_reveal_budget(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_recent integer;
  v_limit constant integer := 40;
begin
  select count(*) into v_recent
  from public.contact_reveal_events
  where user_id = p_user_id
    and revealed_at > now() - interval '24 hours';

  if v_recent >= v_limit then
    raise exception 'contact reveal limit reached, try again later'
      using errcode = '54000';
  end if;
end;
$function$;

revoke all on function private.assert_contact_reveal_budget(uuid) from public;

create or replace function public.reveal_listing_contact(p_listing_id uuid)
returns table (contact_phone text, contact_whatsapp text, contact_email text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'authentication required to reveal seller contact details'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = v_user and u.status = 'active'
  ) then
    raise exception 'authentication required to reveal seller contact details'
      using errcode = '42501';
  end if;

  -- Only published, unsuspended listings expose contact details. Owners and
  -- admins bypass the publication predicate but still pass through the log.
  if not exists (
    select 1 from public.listings l
    where l.id = p_listing_id
      and (
        (l.status in ('available', 'under_offer') and l.content_suspended_at is null)
        or l.seller_id = v_user
        or public.is_admin()
      )
  ) then
    raise exception 'listing not available' using errcode = 'P0002';
  end if;

  perform private.assert_contact_reveal_budget(v_user);

  insert into public.contact_reveal_events (user_id, listing_id)
  values (v_user, p_listing_id);

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
begin
  if v_user is null then
    raise exception 'authentication required to reveal provider contact details'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = v_user and u.status = 'active'
  ) then
    raise exception 'authentication required to reveal provider contact details'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.services s
    where s.id = p_service_id
      and s.category <> 'legal'
      and (
        s.status = 'active'
        or s.provider_id = v_user
        or public.is_admin()
      )
  ) then
    raise exception 'service not available' using errcode = 'P0002';
  end if;

  perform private.assert_contact_reveal_budget(v_user);

  insert into public.contact_reveal_events (user_id, service_id)
  values (v_user, p_service_id);

  return query
    select s.contact_phone, s.contact_whatsapp, s.contact_email
    from public.services s
    where s.id = p_service_id;
end;
$function$;

-- `revoke ... from public` is not sufficient on its own. This project carries
-- default privileges that grant EXECUTE on new functions in `public` to anon,
-- authenticated and service_role, so the anon grant is explicit and must be
-- revoked explicitly. Verified: has_function_privilege('anon', ...) was still
-- true after the revoke-from-public alone.
revoke all on function public.reveal_listing_contact(uuid) from public;
revoke all on function public.reveal_service_contact(uuid) from public;
revoke execute on function public.reveal_listing_contact(uuid) from anon;
revoke execute on function public.reveal_service_contact(uuid) from anon;
grant execute on function public.reveal_listing_contact(uuid) to authenticated;
grant execute on function public.reveal_service_contact(uuid) to authenticated;
