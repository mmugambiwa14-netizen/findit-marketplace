begin;

-- The no-human-review MVP rewrite of owner_transition_listing correctly removed
-- the moderation state transition, but it also dropped the independent country
-- publication gate established by 0046. Restore only that market-availability
-- guard on the current private implementation. Human listing review remains
-- absent and the public compatibility wrapper remains SECURITY INVOKER.
create or replace function private.owner_transition_listing(
  p_listing_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_row public.listings%rowtype;
  next_status public.listing_status;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_action not in ('submit', 'pause', 'resume', 'unavailable') then
    raise exception 'invalid owner listing action' using errcode = '22023';
  end if;

  select * into listing_row
  from public.listings
  where id = p_listing_id and seller_id = auth.uid()
  for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;

  if p_action = 'submit' and listing_row.status in ('draft', 'rejected', 'expired', 'unavailable') then
    if not exists (select 1 from public.listing_media where listing_id = p_listing_id) then
      raise exception 'at least one validated image is required' using errcode = '22023';
    end if;
    if not public.is_country_publishable(coalesce(listing_row.country_code, 'ZW')) then
      raise exception 'country is not open for publishing' using errcode = '22023';
    end if;
    next_status := 'available';
  elsif p_action = 'pause' and listing_row.status in ('available', 'under_offer', 'rented') then
    next_status := 'paused';
  elsif p_action = 'resume' and listing_row.status = 'paused' then
    next_status := 'available';
  elsif p_action = 'unavailable' and listing_row.status in ('available', 'under_offer', 'rented', 'paused') then
    next_status := 'unavailable';
  else
    raise exception 'listing action is not allowed from the current status' using errcode = '22023';
  end if;

  update public.listings
  set status = next_status,
      submitted_at = case when p_action = 'submit' then now() else submitted_at end,
      moderation_reason = null,
      expires_at = case when next_status = 'available' then null else expires_at end,
      expiry_notice_sent_at = case when next_status = 'available' then null else expiry_notice_sent_at end
  where id = p_listing_id
  returning * into listing_row;

  return jsonb_build_object('id', listing_row.id, 'kind', listing_row.kind, 'status', listing_row.status);
end;
$$;

do $migration$
declare
  private_oid regprocedure := to_regprocedure('private.owner_transition_listing(uuid,text)');
  public_oid regprocedure := to_regprocedure('public.owner_transition_listing(uuid,text)');
begin
  if private_oid is null
     or not (select p.prosecdef from pg_proc p where p.oid = private_oid::oid)
     or position('public.is_country_publishable(' in (select p.prosrc from pg_proc p where p.oid = private_oid::oid)) = 0 then
    raise exception 'owner transition country publication guard was not restored';
  end if;

  if public_oid is null
     or (select p.prosecdef from pg_proc p where p.oid = public_oid::oid)
     or (select p.proconfig from pg_proc p where p.oid = public_oid::oid) <> array['search_path=""']::text[]
     or position('private.owner_transition_listing(' in (select p.prosrc from pg_proc p where p.oid = public_oid::oid)) = 0 then
    raise exception 'owner transition public invoker wrapper drifted during country-gate repair';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ) then
    raise exception 'country-gate repair reintroduced an authenticated public SECURITY DEFINER function';
  end if;
end;
$migration$;

commit;
