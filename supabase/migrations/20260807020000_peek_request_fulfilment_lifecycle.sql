begin;

create table if not exists public.peek_request_fulfilments (
  request_id uuid primary key references public.peek_requests(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  tour_id uuid unique references public.listing_tours(id) on delete set null,
  status text not null default 'accepted' check (
    status in ('accepted', 'uploading', 'processing', 'completed', 'failed', 'cancelled', 'expired')
  ),
  attempt_count integer not null default 1 check (attempt_count between 1 and 10),
  failure_reason text,
  accepted_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  updated_at timestamptz not null default now(),
  constraint peek_request_fulfilment_reason_length check (
    failure_reason is null or char_length(btrim(failure_reason)) between 3 and 500
  ),
  constraint peek_request_fulfilment_terminal_consistency check (
    (status = 'completed') = (completed_at is not null)
    and (status = 'cancelled') = (cancelled_at is not null)
  )
);

create index if not exists peek_request_fulfilments_owner_queue
  on public.peek_request_fulfilments(owner_id, status, updated_at desc, request_id);
create index if not exists peek_request_fulfilments_expiry_due
  on public.peek_request_fulfilments(expires_at)
  where status in ('accepted', 'uploading', 'processing');

alter table public.peek_request_fulfilments enable row level security;
revoke all on public.peek_request_fulfilments from public, anon, authenticated;
grant select on public.peek_request_fulfilments to authenticated;

create policy peek_request_fulfilments_owner_read
on public.peek_request_fulfilments
for select to authenticated
using (owner_id = auth.uid() or public.is_admin());

create or replace function private.peek_request_parent_owner(p_request public.peek_requests)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if p_request.listing_id is not null then
    select seller_id into v_owner from public.listings where id = p_request.listing_id;
  else
    select provider_id into v_owner from public.services where id = p_request.service_id;
  end if;
  return v_owner;
end;
$$;

revoke all on function private.peek_request_parent_owner(public.peek_requests) from public, anon, authenticated;

create or replace function public.accept_peek_request(p_request_id uuid)
returns public.peek_request_fulfilments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.peek_requests;
  v_owner uuid;
  v_row public.peek_request_fulfilments;
  v_max_attempts integer := public.tour_processing_max_attempts();
begin
  if not public.is_active_user() then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  select * into v_request from public.peek_requests where id = p_request_id for update;
  if not found then raise exception 'Peek Request not found' using errcode = 'P0002'; end if;
  v_owner := private.peek_request_parent_owner(v_request);
  if v_owner is distinct from auth.uid() then
    raise exception 'Only the listing owner can accept this Peek Request' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' or v_request.moderation_status <> 'approved'
     or v_request.merged_into_id is not null then
    raise exception 'This Peek Request cannot be accepted' using errcode = '22023';
  end if;

  insert into public.peek_request_fulfilments (
    request_id, owner_id, status, attempt_count, accepted_at, expires_at, updated_at
  ) values (
    p_request_id, auth.uid(), 'accepted', 1, now(), now() + interval '48 hours', now()
  )
  on conflict (request_id) do update set
    owner_id = excluded.owner_id,
    tour_id = null,
    status = 'accepted',
    attempt_count = public.peek_request_fulfilments.attempt_count + 1,
    failure_reason = null,
    accepted_at = now(),
    started_at = null,
    completed_at = null,
    cancelled_at = null,
    expires_at = now() + interval '48 hours',
    updated_at = now()
  where public.peek_request_fulfilments.status in ('failed', 'cancelled', 'expired')
    and public.peek_request_fulfilments.attempt_count < v_max_attempts
  returning * into v_row;

  if v_row.request_id is null then
    select * into v_row from public.peek_request_fulfilments where request_id = p_request_id;
    if v_row.status in ('accepted', 'uploading', 'processing') then return v_row; end if;
    raise exception 'Peek Request fulfilment retry limit reached' using errcode = '22023';
  end if;

  return v_row;
end;
$$;

create or replace function public.cancel_peek_request_fulfilment(
  p_request_id uuid,
  p_reason text default null
)
returns public.peek_request_fulfilments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.peek_request_fulfilments;
begin
  update public.peek_request_fulfilments
  set status = 'cancelled',
      failure_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      cancelled_at = now(),
      completed_at = null,
      updated_at = now()
  where request_id = p_request_id
    and owner_id = auth.uid()
    and status in ('accepted', 'uploading', 'processing')
  returning * into v_row;

  if not found then
    raise exception 'Active Peek Request fulfilment not found' using errcode = 'P0002';
  end if;

  delete from public.peek_response_binding_intents
  where request_id = p_request_id and owner_id = auth.uid();

  return v_row;
end;
$$;

create or replace function public.queue_response_peek_binding(p_tour_id uuid, p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_tour public.listing_tours;
  v_request public.peek_requests;
  v_fulfilment public.peek_request_fulfilments;
  v_owner uuid;
begin
  if v_user is null then raise exception 'Sign in to attach a Response Peek'; end if;
  select * into v_tour from public.listing_tours where id = p_tour_id;
  if not found or v_tour.peek_kind <> 'response' then raise exception 'Response Peek not found'; end if;
  select * into v_request from public.peek_requests where id = p_request_id;
  if not found then raise exception 'Peek Request not found'; end if;
  v_owner := private.peek_request_parent_owner(v_request);
  if v_owner is distinct from v_user or v_tour.owner_id is distinct from v_user then
    raise exception 'Only the listing owner can attach this response';
  end if;
  if v_request.listing_id is distinct from v_tour.listing_id
     or v_request.service_id is distinct from v_tour.service_id then
    raise exception 'Response Peek and request must belong to the same listing';
  end if;
  if v_request.status <> 'pending' or v_request.moderation_status <> 'approved'
     or v_request.merged_into_id is not null then
    raise exception 'This Peek Request cannot be answered';
  end if;

  select * into v_fulfilment from public.peek_request_fulfilments
  where request_id = p_request_id and owner_id = v_user for update;
  if not found or v_fulfilment.status not in ('accepted', 'uploading') then
    raise exception 'Accept this Peek Request before uploading a response' using errcode = '22023';
  end if;

  insert into public.peek_response_binding_intents(tour_id, request_id, owner_id)
  values(p_tour_id, p_request_id, v_user)
  on conflict(tour_id) do update set
    request_id = excluded.request_id,
    owner_id = excluded.owner_id,
    created_at = now();

  update public.peek_request_fulfilments
  set tour_id = p_tour_id,
      status = case when v_tour.status in ('processing', 'ready') then 'processing' else 'uploading' end,
      started_at = coalesce(started_at, now()),
      failure_reason = null,
      updated_at = now()
  where request_id = p_request_id;

  return true;
end;
$$;

create or replace function private.sync_peek_fulfilment_from_tour()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_reason text;
begin
  if new.peek_kind <> 'response' then return new; end if;

  v_status := case
    when new.status = 'failed' or new.moderation_status = 'rejected' then 'failed'
    when new.status in ('processing', 'ready') then 'processing'
    else null
  end;
  v_reason := case
    when new.moderation_status = 'rejected' then 'Response Peek was not approved'
    when new.status = 'failed' then 'Response Peek processing failed'
    else null
  end;

  if v_status is not null then
    update public.peek_request_fulfilments
    set status = v_status,
        failure_reason = v_reason,
        completed_at = null,
        cancelled_at = null,
        updated_at = now()
    where tour_id = new.id and status in ('uploading', 'processing');
  end if;
  return new;
end;
$$;

create or replace function private.close_peek_fulfilment_from_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'answered' then
    update public.peek_request_fulfilments
    set status = 'completed', completed_at = coalesce(new.answered_at, now()),
        cancelled_at = null, failure_reason = null, updated_at = now()
    where request_id = new.id and status <> 'completed';
  elsif new.status in ('declined', 'merged', 'removed') then
    update public.peek_request_fulfilments
    set status = 'cancelled', cancelled_at = now(), completed_at = null,
        failure_reason = coalesce(new.decline_reason, 'Peek Request closed'), updated_at = now()
    where request_id = new.id and status not in ('completed', 'cancelled');
  elsif new.status = 'expired' then
    update public.peek_request_fulfilments
    set status = 'expired', completed_at = null, cancelled_at = null,
        failure_reason = 'Peek Request expired', updated_at = now()
    where request_id = new.id and status not in ('completed', 'expired');
  end if;
  return new;
end;
$$;

create or replace function public.expire_stale_peek_request_fulfilments(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid expiry batch size' using errcode = '22023';
  end if;

  with due as (
    select request_id from public.peek_request_fulfilments
    where status in ('accepted', 'uploading', 'processing') and expires_at <= now()
    order by expires_at, request_id
    limit p_limit
    for update skip locked
  ), changed as (
    update public.peek_request_fulfilments f
    set status = 'expired', failure_reason = 'Fulfilment window expired', updated_at = now()
    from due where f.request_id = due.request_id
    returning f.request_id
  )
  select count(*) into v_count from changed;

  delete from public.peek_response_binding_intents i
  using public.peek_request_fulfilments f
  where i.request_id = f.request_id and f.status = 'expired';

  return v_count;
end;
$$;

revoke all on function public.accept_peek_request(uuid) from public, anon;
revoke all on function public.cancel_peek_request_fulfilment(uuid, text) from public, anon;
revoke all on function public.queue_response_peek_binding(uuid, uuid) from public, anon;
revoke all on function public.expire_stale_peek_request_fulfilments(integer) from public, anon, authenticated;
revoke all on function private.sync_peek_fulfilment_from_tour() from public, anon, authenticated;
revoke all on function private.close_peek_fulfilment_from_request() from public, anon, authenticated;
grant execute on function public.accept_peek_request(uuid) to authenticated;
grant execute on function public.cancel_peek_request_fulfilment(uuid, text) to authenticated;
grant execute on function public.queue_response_peek_binding(uuid, uuid) to authenticated;
grant execute on function public.expire_stale_peek_request_fulfilments(integer) to service_role;

drop trigger if exists sync_peek_fulfilment_from_tour on public.listing_tours;
create trigger sync_peek_fulfilment_from_tour
after update of status, moderation_status on public.listing_tours
for each row execute function private.sync_peek_fulfilment_from_tour();

drop trigger if exists close_peek_fulfilment_from_request on public.peek_requests;
create trigger close_peek_fulfilment_from_request
after update of status on public.peek_requests
for each row when (old.status is distinct from new.status)
execute function private.close_peek_fulfilment_from_request();

commit;
