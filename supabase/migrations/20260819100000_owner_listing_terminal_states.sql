begin;

-- Sellers need an explicit, auditable way to distinguish a completed sale or
-- rental from a listing they merely paused or withdrew. Keep this in the
-- trusted lifecycle RPC so the client cannot write status directly.
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
  if p_action not in ('submit', 'pause', 'resume', 'unavailable', 'sold', 'rented') then
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
  elsif p_action in ('sold', 'rented') and listing_row.status in ('available', 'under_offer', 'paused') then
    next_status := p_action::public.listing_status;
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

revoke all on function private.owner_transition_listing(uuid, text) from public, anon, authenticated, service_role;
grant execute on function private.owner_transition_listing(uuid, text) to authenticated, service_role;

create or replace function public.owner_transition_listing(
  p_listing_id uuid,
  p_action text
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.owner_transition_listing($1, $2);
$$;

revoke all on function public.owner_transition_listing(uuid, text) from public, anon;
grant execute on function public.owner_transition_listing(uuid, text) to authenticated, service_role;
comment on function public.owner_transition_listing(uuid, text) is 'findit:0101-authenticated-boundary';

commit;
