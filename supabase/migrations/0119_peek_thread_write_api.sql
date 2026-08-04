-- 0119_peek_thread_write_api.sql
-- Peek Threads phase 4: authoritative write-side RPCs.
--
-- Extends the existing request tables and listing_tours video pipeline. A
-- Response Peek remains an ordinary listing_tours row; this migration only
-- binds an approved, published response row to one or more requests.

create or replace function private.assert_peek_parent_owner(
  p_listing_id uuid,
  p_service_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if p_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_listing_id is not null then
    if not exists (
      select 1 from public.listings l
      where l.id = p_listing_id and l.seller_id = p_user_id
    ) then
      raise exception 'only the listing owner can manage Peek Requests' using errcode = '42501';
    end if;
    return;
  end if;

  if p_service_id is not null then
    if not exists (
      select 1 from public.services s
      where s.id = p_service_id and s.provider_id = p_user_id
    ) then
      raise exception 'only the service owner can manage Peek Requests' using errcode = '42501';
    end if;
    return;
  end if;

  raise exception 'Peek Request has no parent' using errcode = '22023';
end;
$function$;

create or replace function public.create_peek_request(
  p_listing_id uuid default null,
  p_service_id uuid default null,
  p_category public.peek_request_category default 'custom',
  p_body text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '[\n\r\t]+', ' ', 'g'));
  v_recent_count integer;
begin
  if not public.is_active_user() then
    raise exception 'an active account is required' using errcode = '42501';
  end if;
  if ((p_listing_id is not null)::integer + (p_service_id is not null)::integer) <> 1 then
    raise exception 'exactly one Peek Request parent is required' using errcode = '22023';
  end if;
  if char_length(v_body) not between 8 and 280 then
    raise exception 'Peek Request must be between 8 and 280 characters' using errcode = '22023';
  end if;
  if not private.is_peek_parent_public(p_listing_id, p_service_id) then
    raise exception 'this listing is not accepting public Peek Requests' using errcode = '42501';
  end if;
  if (p_listing_id is not null and exists (
      select 1 from public.listings l where l.id = p_listing_id and l.seller_id = auth.uid()
    )) or (p_service_id is not null and exists (
      select 1 from public.services s where s.id = p_service_id and s.provider_id = auth.uid()
    )) then
    raise exception 'owners cannot request Peeks from themselves' using errcode = '42501';
  end if;

  select count(*) into v_recent_count
  from public.peek_requests r
  where r.requester_id = auth.uid()
    and r.category = p_category
    and r.created_at >= now() - interval '30 minutes';
  if v_recent_count >= 3 then
    raise exception 'too many recent Peek Requests in this category' using errcode = '42900';
  end if;

  insert into public.peek_requests (
    listing_id, service_id, requester_id, category, body,
    status, moderation_status, supporter_count
  ) values (
    p_listing_id, p_service_id, auth.uid(), p_category, v_body,
    'pending', 'pending', 0
  ) returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.support_peek_request(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer;
begin
  if not public.is_active_user() then
    raise exception 'an active account is required' using errcode = '42501';
  end if;
  if not private.can_support_peek_request(p_request_id) then
    raise exception 'this Peek Request cannot be supported' using errcode = '42501';
  end if;

  insert into public.peek_request_supporters (request_id, user_id)
  values (p_request_id, auth.uid())
  on conflict (request_id, user_id) do nothing;

  select supporter_count into v_count from public.peek_requests where id = p_request_id;
  return coalesce(v_count, 0);
end;
$function$;

create or replace function public.withdraw_peek_request_support(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_count integer;
begin
  delete from public.peek_request_supporters
  where request_id = p_request_id and user_id = auth.uid();
  select supporter_count into v_count from public.peek_requests where id = p_request_id;
  return coalesce(v_count, 0);
end;
$function$;

create or replace function public.decline_peek_request(
  p_request_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.peek_requests%rowtype;
  v_reason text := btrim(regexp_replace(coalesce(p_reason, ''), '[\n\r\t]+', ' ', 'g'));
begin
  select * into v_request from public.peek_requests where id = p_request_id for update;
  if not found then raise exception 'Peek Request not found' using errcode = 'P0002'; end if;
  perform private.assert_peek_parent_owner(v_request.listing_id, v_request.service_id, auth.uid());
  if v_request.status <> 'pending' then
    raise exception 'only pending Peek Requests can be declined' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 1 and 280 then
    raise exception 'decline reason must be between 1 and 280 characters' using errcode = '22023';
  end if;

  update public.peek_requests
  set status = 'declined', declined_at = now(), decline_reason = v_reason
  where id = p_request_id;
end;
$function$;

create or replace function public.merge_peek_request(
  p_source_request_id uuid,
  p_target_request_id uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_source public.peek_requests%rowtype;
  v_target public.peek_requests%rowtype;
begin
  if p_source_request_id = p_target_request_id then
    raise exception 'a Peek Request cannot be merged into itself' using errcode = '22023';
  end if;
  select * into v_source from public.peek_requests where id = p_source_request_id for update;
  select * into v_target from public.peek_requests where id = p_target_request_id for update;
  if v_source.id is null or v_target.id is null then
    raise exception 'Peek Request not found' using errcode = 'P0002';
  end if;
  perform private.assert_peek_parent_owner(v_source.listing_id, v_source.service_id, auth.uid());
  if v_source.listing_id is distinct from v_target.listing_id
     or v_source.service_id is distinct from v_target.service_id
     or v_source.category <> v_target.category then
    raise exception 'only requests for the same parent and category can be merged' using errcode = '22023';
  end if;
  if v_source.status <> 'pending' or v_target.status not in ('pending', 'answered') then
    raise exception 'these Peek Requests cannot be merged' using errcode = '22023';
  end if;

  insert into public.peek_request_supporters (request_id, user_id)
  select p_target_request_id, s.user_id
  from public.peek_request_supporters s
  where s.request_id = p_source_request_id
  on conflict do nothing;

  insert into public.peek_request_supporters (request_id, user_id)
  values (p_target_request_id, v_source.requester_id)
  on conflict do nothing;

  delete from public.peek_request_supporters where request_id = p_source_request_id;
  update public.peek_requests
  set status = 'merged', merged_into_id = p_target_request_id
  where id = p_source_request_id;
end;
$function$;

create or replace function public.bind_response_peek(
  p_tour_id uuid,
  p_request_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tour public.listing_tours%rowtype;
  v_request public.peek_requests%rowtype;
  v_count integer := 0;
  v_request_id uuid;
begin
  if coalesce(cardinality(p_request_ids), 0) = 0 or cardinality(p_request_ids) > 25 then
    raise exception 'choose between 1 and 25 Peek Requests' using errcode = '22023';
  end if;

  select * into v_tour from public.listing_tours where id = p_tour_id for update;
  if not found then raise exception 'Response Peek not found' using errcode = 'P0002'; end if;
  if v_tour.peek_kind <> 'response' or v_tour.status <> 'published' or v_tour.moderation_status <> 'approved' then
    raise exception 'Response Peek must be published and approved before binding' using errcode = '22023';
  end if;
  perform private.assert_peek_parent_owner(v_tour.listing_id, v_tour.service_id, auth.uid());

  foreach v_request_id in array p_request_ids loop
    select * into v_request from public.peek_requests where id = v_request_id for update;
    if not found then raise exception 'Peek Request not found' using errcode = 'P0002'; end if;
    if v_request.listing_id is distinct from v_tour.listing_id
       or v_request.service_id is distinct from v_tour.service_id then
      raise exception 'Response Peek and request must share the same parent' using errcode = '22023';
    end if;
    if v_request.status not in ('pending', 'answered', 'declined', 'expired') then
      raise exception 'this Peek Request cannot be answered' using errcode = '22023';
    end if;

    update public.peek_request_responses
    set is_current = false, superseded_at = now()
    where request_id = v_request_id and is_current;

    insert into public.peek_request_responses (request_id, tour_id, is_current)
    values (v_request_id, p_tour_id, true)
    on conflict (request_id, tour_id) do update
      set is_current = true, superseded_at = null;

    update public.peek_requests
    set status = 'answered', current_response_id = p_tour_id,
        answered_at = now(), declined_at = null, decline_reason = null
    where id = v_request_id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.create_peek_request(uuid, uuid, public.peek_request_category, text) from public;
revoke all on function public.support_peek_request(uuid) from public;
revoke all on function public.withdraw_peek_request_support(uuid) from public;
revoke all on function public.decline_peek_request(uuid, text) from public;
revoke all on function public.merge_peek_request(uuid, uuid) from public;
revoke all on function public.bind_response_peek(uuid, uuid[]) from public;

grant execute on function public.create_peek_request(uuid, uuid, public.peek_request_category, text) to authenticated;
grant execute on function public.support_peek_request(uuid) to authenticated;
grant execute on function public.withdraw_peek_request_support(uuid) to authenticated;
grant execute on function public.decline_peek_request(uuid, text) to authenticated;
grant execute on function public.merge_peek_request(uuid, uuid) to authenticated;
grant execute on function public.bind_response_peek(uuid, uuid[]) to authenticated;
