begin;

create or replace function public.create_peek_request(
  p_listing_id uuid default null,
  p_service_id uuid default null,
  p_category public.peek_request_category default 'custom',
  p_body text default null
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
    select seller_id, title into v_owner, v_title
    from public.listings
    where id = p_listing_id and status in ('available','under_offer');
  else
    select provider_id, title into v_owner, v_title
    from public.services
    where id = p_service_id and status = 'active';
  end if;

  if v_owner is null then raise exception 'This listing is not available for Peek Requests'; end if;
  if v_owner = v_user then raise exception 'You cannot request a Peek from your own listing'; end if;

  if exists (
    select 1 from public.peek_requests r
    where r.requester_id = v_user
      and r.category = p_category
      and r.status = 'pending'
      and r.created_at > now() - interval '10 minutes'
      and ((p_listing_id is not null and r.listing_id = p_listing_id)
        or (p_service_id is not null and r.service_id = p_service_id))
  ) then
    raise exception 'You recently sent a similar Peek Request';
  end if;

  insert into public.peek_requests(
    listing_id, service_id, requester_id, category, body,
    status, supporter_count, moderation_status
  ) values (
    p_listing_id, p_service_id, v_user, p_category, p_body,
    'pending', 1, 'approved'
  ) returning id into v_request_id;

  insert into public.peek_request_supporters(request_id, user_id)
  values (v_request_id, v_user)
  on conflict do nothing;

  insert into public.app_alerts(user_id, title, message, type, link, listing_id, event_type, source_key)
  values (
    v_owner,
    'New Peek Request',
    'A buyer asked for new visual evidence on ' || coalesce(v_title, 'your listing') || '.',
    'system',
    '/peek-requests',
    p_listing_id,
    'peek_request_created',
    'peek-request:' || v_request_id::text
  ) on conflict do nothing;

  return v_request_id;
end;
$$;

create or replace function public.support_peek_request(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_status public.peek_request_status;
  v_count integer;
begin
  if v_user is null then raise exception 'Sign in to support this Peek Request'; end if;
  select coalesce(l.seller_id, s.provider_id), r.status
  into v_owner, v_status
  from public.peek_requests r
  left join public.listings l on l.id = r.listing_id
  left join public.services s on s.id = r.service_id
  where r.id = p_request_id;
  if v_status is null then raise exception 'Peek Request not found'; end if;
  if v_status <> 'pending' then raise exception 'This Peek Request is no longer open'; end if;
  if v_owner = v_user then raise exception 'Sellers cannot support requests on their own listing'; end if;

  insert into public.peek_request_supporters(request_id, user_id)
  values (p_request_id, v_user)
  on conflict do nothing;

  update public.peek_requests r
  set supporter_count = (select count(*) from public.peek_request_supporters ps where ps.request_id = r.id), updated_at = now()
  where r.id = p_request_id
  returning supporter_count into v_count;
  return v_count;
end;
$$;

create or replace function public.withdraw_peek_request_support(p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_requester uuid;
  v_count integer;
begin
  if v_user is null then raise exception 'Sign in to update your interest'; end if;
  select requester_id into v_requester from public.peek_requests where id = p_request_id and status = 'pending';
  if v_requester is null then raise exception 'This Peek Request is no longer open'; end if;
  if v_requester = v_user then raise exception 'The original requester cannot remove their support'; end if;

  delete from public.peek_request_supporters where request_id = p_request_id and user_id = v_user;
  update public.peek_requests r
  set supporter_count = (select count(*) from public.peek_request_supporters ps where ps.request_id = r.id), updated_at = now()
  where r.id = p_request_id
  returning supporter_count into v_count;
  return v_count;
end;
$$;

create or replace function public.decline_peek_request(p_request_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sign in to manage Peek Requests'; end if;
  p_reason := btrim(p_reason);
  if char_length(p_reason) < 4 or char_length(p_reason) > 280 then raise exception 'Give buyers a short reason'; end if;
  update public.peek_requests r
  set status='declined', declined_at=now(), decline_reason=p_reason, updated_at=now()
  where r.id=p_request_id and r.status='pending' and (
    exists(select 1 from public.listings l where l.id=r.listing_id and l.seller_id=v_user)
    or exists(select 1 from public.services s where s.id=r.service_id and s.provider_id=v_user)
  );
  if not found then raise exception 'You cannot decline this Peek Request'; end if;
  return true;
end;
$$;

create or replace function public.merge_peek_request(p_source_request_id uuid, p_target_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_source public.peek_requests%rowtype;
  v_target public.peek_requests%rowtype;
begin
  if v_user is null then raise exception 'Sign in to manage Peek Requests'; end if;
  if p_source_request_id=p_target_request_id then raise exception 'Choose a different request'; end if;
  select * into v_source from public.peek_requests where id=p_source_request_id for update;
  select * into v_target from public.peek_requests where id=p_target_request_id for update;
  if v_source.id is null or v_target.id is null then raise exception 'Peek Request not found'; end if;
  if v_source.listing_id is distinct from v_target.listing_id or v_source.service_id is distinct from v_target.service_id then raise exception 'Requests must belong to the same listing'; end if;
  if not (
    exists(select 1 from public.listings l where l.id=v_source.listing_id and l.seller_id=v_user)
    or exists(select 1 from public.services s where s.id=v_source.service_id and s.provider_id=v_user)
  ) then raise exception 'You cannot merge these Peek Requests'; end if;

  insert into public.peek_request_supporters(request_id,user_id)
  select p_target_request_id,user_id from public.peek_request_supporters where request_id=p_source_request_id
  on conflict do nothing;
  update public.peek_requests set status='merged', merged_into_id=p_target_request_id, updated_at=now() where id=p_source_request_id;
  update public.peek_requests r set supporter_count=(select count(*) from public.peek_request_supporters ps where ps.request_id=r.id),updated_at=now() where r.id=p_target_request_id;
  return true;
end;
$$;

create or replace function public.peek_thread_page(
  p_listing_id uuid default null,
  p_service_id uuid default null,
  p_filter text default 'all',
  p_sort text default 'most_wanted',
  p_cursor_supporter_count integer default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
) returns table(
  request_id uuid, listing_id uuid, service_id uuid, category public.peek_request_category,
  body text, status public.peek_request_status, supporter_count integer,
  requested_by_label text, created_at timestamptz, answered_at timestamptz,
  current_response_id uuid, next_supporter_count integer, next_created_at timestamptz, next_id uuid
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with eligible as (
    select r.*
    from public.peek_requests r
    where ((p_listing_id is not null and r.listing_id=p_listing_id) or (p_service_id is not null and r.service_id=p_service_id))
      and r.moderation_status='approved'
      and r.status not in ('removed','merged')
      and (coalesce(p_filter,'all')='all'
        or (p_filter='answered' and r.status='answered')
        or (p_filter='pending' and r.status='pending'))
      and (
        p_cursor_id is null
        or (coalesce(p_sort,'most_wanted')='newest' and (r.created_at,r.id) < (p_cursor_created_at,p_cursor_id))
        or (coalesce(p_sort,'most_wanted')<>'newest' and (r.supporter_count,r.created_at,r.id) < (p_cursor_supporter_count,p_cursor_created_at,p_cursor_id))
      )
    order by
      case when coalesce(p_sort,'most_wanted')<>'newest' then r.supporter_count end desc,
      r.created_at desc, r.id desc
    limit least(greatest(coalesce(p_limit,20),1),50)+1
  ), page as (
    select *, row_number() over () as rn from eligible
  ), cursor_row as (
    select supporter_count, created_at, id from page where rn = least(greatest(coalesce(p_limit,20),1),50)+1
  )
  select p.id, p.listing_id, p.service_id, p.category, p.body, p.status, p.supporter_count,
    'a buyer'::text, p.created_at, p.answered_at, p.current_response_id,
    c.supporter_count, c.created_at, c.id
  from page p cross join lateral (select * from cursor_row union all select null::integer,null::timestamptz,null::uuid where not exists(select 1 from cursor_row) limit 1) c
  where p.rn <= least(greatest(coalesce(p_limit,20),1),50)
  order by p.rn;
$$;

revoke all on function public.create_peek_request(uuid,uuid,public.peek_request_category,text) from public, anon;
revoke all on function public.support_peek_request(uuid) from public, anon;
revoke all on function public.withdraw_peek_request_support(uuid) from public, anon;
revoke all on function public.decline_peek_request(uuid,text) from public, anon;
revoke all on function public.merge_peek_request(uuid,uuid) from public, anon;
revoke all on function public.peek_thread_page(uuid,uuid,text,text,integer,timestamptz,uuid,integer) from public;
grant execute on function public.create_peek_request(uuid,uuid,public.peek_request_category,text) to authenticated;
grant execute on function public.support_peek_request(uuid) to authenticated;
grant execute on function public.withdraw_peek_request_support(uuid) to authenticated;
grant execute on function public.decline_peek_request(uuid,text) to authenticated;
grant execute on function public.merge_peek_request(uuid,uuid) to authenticated;
grant execute on function public.peek_thread_page(uuid,uuid,text,text,integer,timestamptz,uuid,integer) to anon, authenticated;

commit;
