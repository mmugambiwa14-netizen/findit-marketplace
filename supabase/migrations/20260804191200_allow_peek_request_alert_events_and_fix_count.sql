begin;

alter table public.app_alerts drop constraint if exists app_alerts_v1_event_type_check;
alter table public.app_alerts add constraint app_alerts_v1_event_type_check check (
  event_type is null or event_type in (
    'listing_approved','listing_rejected','listing_expires_soon','report_resolved','account_status',
    'tour_ready','tour_failed','tour_rejected','listing_status_changed','saved_listing_unavailable',
    'peek_request_created','peek_request_answered'
  )
);

create or replace function public.create_peek_request(
  p_listing_id uuid,
  p_service_id uuid,
  p_category public.peek_request_category,
  p_body text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_title text;
  v_request_id uuid;
begin
  if v_user is null then raise exception 'Sign in to request a Peek'; end if;
  if (p_listing_id is null) = (p_service_id is null) then raise exception 'Choose one listing or service'; end if;
  p_body := btrim(p_body);
  if char_length(p_body) < 8 or char_length(p_body) > 280 then raise exception 'Describe what you want to see in 8 to 280 characters'; end if;
  if p_listing_id is not null then
    select seller_id, title into v_owner, v_title from public.listings where id=p_listing_id and status in ('available','under_offer');
  else
    select provider_id, title into v_owner, v_title from public.services where id=p_service_id and status='active';
  end if;
  if v_owner is null then raise exception 'This listing is not available for Peek Requests'; end if;
  if v_owner=v_user then raise exception 'You cannot request a Peek from your own listing'; end if;
  if exists(select 1 from public.peek_requests r where r.requester_id=v_user and r.category=p_category and r.status='pending' and r.created_at>now()-interval '10 minutes' and ((p_listing_id is not null and r.listing_id=p_listing_id) or (p_service_id is not null and r.service_id=p_service_id))) then raise exception 'You recently sent a similar Peek Request'; end if;
  insert into public.peek_requests(listing_id,service_id,requester_id,category,body,status,supporter_count,moderation_status)
  values(p_listing_id,p_service_id,v_user,p_category,p_body,'pending',0,'approved') returning id into v_request_id;
  insert into public.peek_request_supporters(request_id,user_id) values(v_request_id,v_user) on conflict do nothing;
  insert into public.app_alerts(user_id,title,message,type,link,listing_id,event_type,source_key)
  values(v_owner,'New Peek Request','A buyer asked for new visual evidence on '||coalesce(v_title,'your listing')||'.','system','/peek-requests',p_listing_id,'peek_request_created','peek-request:'||v_request_id::text)
  on conflict do nothing;
  return v_request_id;
end;
$$;

revoke all on function public.create_peek_request(uuid,uuid,public.peek_request_category,text) from public,anon;
grant execute on function public.create_peek_request(uuid,uuid,public.peek_request_category,text) to authenticated;

commit;
