begin;

drop trigger if exists close_peek_fulfilment_from_request on public.peek_requests;
drop trigger if exists sync_peek_fulfilment_from_tour on public.listing_tours;
drop function if exists private.close_peek_fulfilment_from_request();
drop function if exists private.sync_peek_fulfilment_from_tour();
drop function if exists public.expire_stale_peek_request_fulfilments(integer);
drop function if exists public.cancel_peek_request_fulfilment(uuid, text);
drop function if exists public.accept_peek_request(uuid);
drop policy if exists peek_request_fulfilments_owner_read on public.peek_request_fulfilments;
drop table if exists public.peek_request_fulfilments;
drop function if exists private.peek_request_parent_owner(public.peek_requests);

-- Restore the pre-fulfilment binding-intent contract.
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

revoke all on function public.queue_response_peek_binding(uuid,uuid) from public, anon;
grant execute on function public.queue_response_peek_binding(uuid,uuid) to authenticated;

commit;
