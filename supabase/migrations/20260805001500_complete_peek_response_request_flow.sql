create table if not exists public.peek_response_binding_intents (
  tour_id uuid primary key references public.listing_tours(id) on delete cascade,
  request_id uuid not null references public.peek_requests(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.peek_response_binding_intents enable row level security;
revoke all on public.peek_response_binding_intents from anon, authenticated;

create or replace function public.queue_response_peek_binding(p_tour_id uuid, p_request_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_tour public.listing_tours%rowtype;
  v_request public.peek_requests%rowtype;
  v_owner uuid;
begin
  if v_user is null then raise exception 'Sign in to attach a Response Peek'; end if;
  select * into v_tour from public.listing_tours where id=p_tour_id;
  if not found or v_tour.peek_kind <> 'response' then raise exception 'Response Peek not found'; end if;
  select * into v_request from public.peek_requests where id=p_request_id;
  if not found then raise exception 'Peek Request not found'; end if;
  if v_request.listing_id is distinct from v_tour.listing_id or v_request.service_id is distinct from v_tour.service_id then raise exception 'Response Peek and request must belong to the same listing'; end if;
  if v_tour.listing_id is not null then select seller_id into v_owner from public.listings where id=v_tour.listing_id;
  else select provider_id into v_owner from public.services where id=v_tour.service_id; end if;
  if v_owner is distinct from v_user or v_tour.owner_id is distinct from v_user then raise exception 'Only the listing owner can attach this response'; end if;
  if v_request.status <> 'pending' or v_request.moderation_status <> 'approved' or v_request.merged_into_id is not null then raise exception 'This Peek Request cannot be answered'; end if;
  insert into public.peek_response_binding_intents(tour_id,request_id,owner_id) values(p_tour_id,p_request_id,v_user)
  on conflict(tour_id) do update set request_id=excluded.request_id,owner_id=excluded.owner_id,created_at=now();
  return true;
end; $$;

grant execute on function public.queue_response_peek_binding(uuid,uuid) to authenticated;

create or replace function public.apply_pending_response_peek_binding()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_intent public.peek_response_binding_intents%rowtype;
  v_request public.peek_requests%rowtype;
  v_link text;
  v_kind text;
begin
  if new.peek_kind <> 'response' or new.status <> 'published' or new.moderation_status <> 'approved' then return new; end if;
  select * into v_intent from public.peek_response_binding_intents where tour_id=new.id for update;
  if not found then return new; end if;
  select * into v_request from public.peek_requests where id=v_intent.request_id for update;
  if not found or v_request.status <> 'pending' or v_request.moderation_status <> 'approved' or v_request.merged_into_id is not null or v_request.listing_id is distinct from new.listing_id or v_request.service_id is distinct from new.service_id then
    delete from public.peek_response_binding_intents where tour_id=new.id;
    return new;
  end if;
  update public.peek_request_responses set is_current=false,superseded_at=now() where request_id=v_request.id and is_current;
  insert into public.peek_request_responses(request_id,tour_id,is_current) values(v_request.id,new.id,true)
  on conflict(request_id,tour_id) do update set is_current=true,superseded_at=null;
  update public.peek_requests set status='answered',current_response_id=new.id,answered_at=now(),declined_at=null,decline_reason=null,updated_at=now() where id=v_request.id;
  if new.listing_id is not null then
    select kind::text into v_kind from public.listings where id=new.listing_id;
    v_link := '/' || case when v_kind='car' then 'car' when v_kind='machinery' then 'machinery' else 'property' end || '/' || new.listing_id::text || '?responsePeek=' || new.id::text || '#peek-threads';
  else v_link := '/service/' || new.service_id::text || '?responsePeek=' || new.id::text || '#peek-threads'; end if;
  with recipients as (
    select requester_id user_id,true is_requester from public.peek_requests where id=v_request.id
    union all select user_id,false from public.peek_request_supporters where request_id=v_request.id
  ), deduped as (
    select user_id,bool_or(is_requester) is_requester from recipients where user_id is not null and user_id<>v_intent.owner_id group by user_id
  )
  insert into public.app_alerts(user_id,title,message,type,link,is_read,listing_id,event_type,source_key,created_at)
  select user_id,case when is_requester then 'Your Peek Request has been answered' else 'A Peek you wanted is now available' end,
    'The seller added new visual evidence. Watch the Response Peek on the listing.','info',v_link,false,new.listing_id,'peek_request_answered','peek-response:'||new.id::text,now()
  from deduped on conflict(user_id,event_type,source_key) where event_type is not null and source_key is not null do nothing;
  delete from public.peek_response_binding_intents where tour_id=new.id;
  return new;
end; $$;

drop trigger if exists trg_apply_pending_response_peek_binding on public.listing_tours;
create trigger trg_apply_pending_response_peek_binding after insert or update of status,moderation_status,published_at on public.listing_tours for each row execute function public.apply_pending_response_peek_binding();
