-- 0123_response_peek_binding_and_notifications.sql
-- Post-moderation Response Peek selection, binding and deduplicated buyer alerts.

create or replace function public.seller_unbound_response_peeks()
returns table (tour_id uuid, listing_id uuid, service_id uuid, parent_type text,
  parent_kind text, parent_title text, ready_at timestamptz, published_at timestamptz,
  pending_request_count integer)
language sql stable security definer set search_path to ''
as $function$
  select t.id, t.listing_id, t.service_id,
    case when t.listing_id is not null then 'listing' else 'service' end,
    coalesce(l.kind::text, 'service'), coalesce(l.title, s.title), t.ready_at, t.published_at,
    count(r.id)::integer
  from public.listing_tours t
  left join public.listings l on l.id = t.listing_id
  left join public.services s on s.id = t.service_id
  left join public.peek_requests r
    on r.listing_id is not distinct from t.listing_id
   and r.service_id is not distinct from t.service_id
   and r.status = 'pending' and r.moderation_status = 'approved' and r.merged_into_id is null
  where t.owner_id = auth.uid() and t.peek_kind = 'response'
    and t.status = 'published' and t.moderation_status = 'approved'
    and not exists (select 1 from public.peek_request_responses pr where pr.tour_id = t.id and pr.is_current)
  group by t.id, t.listing_id, t.service_id, l.kind, l.title, s.title, t.ready_at, t.published_at
  order by t.published_at asc, t.id asc limit 50;
$function$;

create or replace function public.response_peek_request_candidates(p_tour_id uuid)
returns table (request_id uuid, category public.peek_request_category, body text,
  supporter_count integer, created_at timestamptz)
language plpgsql stable security definer set search_path to ''
as $function$
declare v_tour public.listing_tours%rowtype;
begin
  select * into v_tour from public.listing_tours where id = p_tour_id;
  if not found then raise exception 'Response Peek not found' using errcode = 'P0002'; end if;
  if v_tour.owner_id <> auth.uid() then raise exception 'Response Peek ownership required' using errcode = '42501'; end if;
  if v_tour.peek_kind <> 'response' or v_tour.status <> 'published' or v_tour.moderation_status <> 'approved' then
    raise exception 'Response Peek is not ready for binding' using errcode = '22023';
  end if;
  return query select r.id, r.category, r.body, r.supporter_count, r.created_at
  from public.peek_requests r
  where r.listing_id is not distinct from v_tour.listing_id
    and r.service_id is not distinct from v_tour.service_id
    and r.status in ('pending','answered','declined','expired')
    and r.moderation_status = 'approved' and r.merged_into_id is null
  order by (r.status = 'pending') desc, r.supporter_count desc, r.created_at asc, r.id asc limit 100;
end;
$function$;

create or replace function public.bind_response_peek(p_tour_id uuid, p_request_ids uuid[])
returns integer language plpgsql security definer set search_path to ''
as $function$
declare
  v_tour public.listing_tours%rowtype; v_request public.peek_requests%rowtype;
  v_count integer := 0; v_request_id uuid; v_link text; v_kind text;
begin
  if coalesce(cardinality(p_request_ids),0) = 0 or cardinality(p_request_ids) > 25 then
    raise exception 'choose between 1 and 25 Peek Requests' using errcode = '22023'; end if;
  if cardinality(p_request_ids) <> (select count(distinct x) from unnest(p_request_ids) x) then
    raise exception 'duplicate Peek Request selections are not allowed' using errcode = '22023'; end if;

  select * into v_tour from public.listing_tours where id = p_tour_id for update;
  if not found then raise exception 'Response Peek not found' using errcode = 'P0002'; end if;
  if v_tour.peek_kind <> 'response' or v_tour.status <> 'published' or v_tour.moderation_status <> 'approved' then
    raise exception 'Response Peek must be published and approved before binding' using errcode = '22023'; end if;
  perform private.assert_peek_parent_owner(v_tour.listing_id, v_tour.service_id, auth.uid());

  foreach v_request_id in array p_request_ids loop
    select * into v_request from public.peek_requests where id = v_request_id for update;
    if not found then raise exception 'Peek Request not found' using errcode = 'P0002'; end if;
    if v_request.listing_id is distinct from v_tour.listing_id or v_request.service_id is distinct from v_tour.service_id then
      raise exception 'Response Peek and request must share the same parent' using errcode = '22023'; end if;
    if v_request.status not in ('pending','answered','declined','expired')
       or v_request.moderation_status <> 'approved' or v_request.merged_into_id is not null then
      raise exception 'this Peek Request cannot be answered' using errcode = '22023'; end if;
    update public.peek_request_responses set is_current=false, superseded_at=now()
      where request_id=v_request_id and is_current;
    insert into public.peek_request_responses(request_id,tour_id,is_current)
      values(v_request_id,p_tour_id,true)
      on conflict(request_id,tour_id) do update set is_current=true,superseded_at=null;
    update public.peek_requests set status='answered',current_response_id=p_tour_id,
      answered_at=now(),declined_at=null,decline_reason=null where id=v_request_id;
    v_count := v_count + 1;
  end loop;

  if v_tour.listing_id is not null then
    select kind::text into v_kind from public.listings where id=v_tour.listing_id;
    v_link := '/' || case when v_kind='car' then 'car' when v_kind='machinery' then 'machinery' else 'property' end
      || '/' || v_tour.listing_id::text || '?responsePeek=' || p_tour_id::text || '#peek-threads';
  else
    v_link := '/service/' || v_tour.service_id::text || '?responsePeek=' || p_tour_id::text || '#peek-threads';
  end if;

  with recipients as (
    select r.requester_id user_id, true is_requester from public.peek_requests r where r.id=any(p_request_ids)
    union all select s.user_id,false from public.peek_request_supporters s where s.request_id=any(p_request_ids)
  ), deduped as (
    select user_id,bool_or(is_requester) is_requester from recipients
    where user_id is not null and user_id<>auth.uid() group by user_id
  )
  insert into public.app_alerts(user_id,title,message,type,link,is_read,listing_id,event_type,source_key,created_at)
  select d.user_id,
    case when d.is_requester then 'Your Peek Request has been answered' else 'A Peek you wanted is now available' end,
    'The seller added new visual evidence. Watch the Response Peek on the listing.',
    'info',v_link,false,v_tour.listing_id,'peek_response_available',p_tour_id::text,now()
  from deduped d
  on conflict(user_id,event_type,source_key) where event_type is not null and source_key is not null do nothing;
  return v_count;
end;
$function$;

revoke all on function public.seller_unbound_response_peeks() from public;
revoke all on function public.response_peek_request_candidates(uuid) from public;
revoke all on function public.bind_response_peek(uuid,uuid[]) from public;
grant execute on function public.seller_unbound_response_peeks() to authenticated;
grant execute on function public.response_peek_request_candidates(uuid) to authenticated;
grant execute on function public.bind_response_peek(uuid,uuid[]) to authenticated;
