-- 0055_recommendation_projection_queue.sql
-- Recommendation projection is asynchronous and fail-open. Listing writes must
-- never depend on projection tables, ranking data, worker availability or caches.

create table if not exists public.recommendation_projection_jobs (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  requested_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_recommendation_projection_jobs_due
  on public.recommendation_projection_jobs(next_attempt_at, requested_at, listing_id);

create table if not exists public.recommendation_projection_dead_letters (
  id bigint generated always as identity primary key,
  listing_id uuid not null,
  attempt_count integer not null check (attempt_count > 0),
  reason_code text not null check (reason_code ~ '^[a-z0-9_]{3,64}$'),
  first_requested_at timestamptz not null,
  failed_at timestamptz not null default now(),
  retried_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_recommendation_projection_dead_letters_listing
  on public.recommendation_projection_dead_letters(listing_id, failed_at desc, id desc);
create index if not exists idx_recommendation_projection_dead_letters_unretried
  on public.recommendation_projection_dead_letters(failed_at, id)
  where retried_at is null;

alter table public.recommendation_projection_jobs enable row level security;
alter table public.recommendation_projection_dead_letters enable row level security;
revoke all on table public.recommendation_projection_jobs from anon, authenticated;
revoke all on table public.recommendation_projection_dead_letters from anon, authenticated;

create or replace function public.enqueue_listing_recommendation_projection(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_listing_id is null or not exists (
    select 1 from public.listings where id = p_listing_id
  ) then
    return false;
  end if;

  insert into public.recommendation_projection_jobs (
    listing_id, requested_at, next_attempt_at, attempt_count, last_error_code, updated_at
  ) values (
    p_listing_id, now(), now(), 0, null, now()
  )
  on conflict (listing_id) do update set
    requested_at = excluded.requested_at,
    next_attempt_at = excluded.next_attempt_at,
    attempt_count = 0,
    last_error_code = null,
    updated_at = excluded.updated_at;

  return true;
end;
$$;

revoke all on function public.enqueue_listing_recommendation_projection(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_listing_recommendation_projection(uuid) to service_role;

create or replace function public.sync_listing_recommendation_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.listing_recommendation_features where listing_id = old.id;
    delete from public.recommendation_projection_jobs where listing_id = old.id;
    return old;
  end if;

  begin
    perform public.enqueue_listing_recommendation_projection(new.id);
  exception when others then
    null;
  end;

  return new;
end;
$$;

create or replace function public.sync_listing_detail_recommendation_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing_id uuid;
begin
  target_listing_id := case when tg_op = 'DELETE' then old.listing_id else new.listing_id end;

  begin
    perform public.enqueue_listing_recommendation_projection(target_listing_id);
  exception when others then
    null;
  end;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.sync_listing_recommendation_feature() from public, anon, authenticated;
revoke all on function public.sync_listing_detail_recommendation_feature() from public, anon, authenticated;

create or replace function public.process_listing_recommendation_projection_jobs(
  p_limit integer default 100,
  p_max_attempts integer default 8
)
returns table (
  processed_count integer,
  succeeded_count integer,
  retried_count integer,
  dead_lettered_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  job record;
  processed integer := 0;
  succeeded integer := 0;
  retried integer := 0;
  dead_lettered integer := 0;
  next_attempt_count integer;
begin
  if p_limit not between 1 and 500 then
    raise exception 'projection worker batch size must be between 1 and 500' using errcode = '22023';
  end if;
  if p_max_attempts not between 1 and 20 then
    raise exception 'projection worker max attempts must be between 1 and 20' using errcode = '22023';
  end if;

  for job in
    select queue.*
    from public.recommendation_projection_jobs queue
    where queue.next_attempt_at <= now()
    order by queue.next_attempt_at, queue.requested_at, queue.listing_id
    for update skip locked
    limit p_limit
  loop
    processed := processed + 1;

    begin
      perform public.refresh_listing_recommendation_feature(job.listing_id);
      delete from public.recommendation_projection_jobs where listing_id = job.listing_id;
      succeeded := succeeded + 1;
    exception when others then
      next_attempt_count := job.attempt_count + 1;

      if next_attempt_count >= p_max_attempts then
        insert into public.recommendation_projection_dead_letters (
          listing_id, attempt_count, reason_code, first_requested_at, failed_at
        ) values (
          job.listing_id, next_attempt_count, 'projection_failed', job.requested_at, now()
        );
        delete from public.recommendation_projection_jobs where listing_id = job.listing_id;
        dead_lettered := dead_lettered + 1;
      else
        update public.recommendation_projection_jobs
        set
          attempt_count = next_attempt_count,
          next_attempt_at = now() + make_interval(
            secs => least(3600, 5 * power(2, next_attempt_count - 1))::double precision
          ),
          last_error_code = 'projection_failed',
          updated_at = now()
        where listing_id = job.listing_id;
        retried := retried + 1;
      end if;
    end;
  end loop;

  return query select processed, succeeded, retried, dead_lettered;
end;
$$;

create or replace function public.retry_recommendation_projection_dead_letter(p_dead_letter_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  dead_letter public.recommendation_projection_dead_letters%rowtype;
begin
  select * into dead_letter
  from public.recommendation_projection_dead_letters
  where id = p_dead_letter_id and retried_at is null
  for update;

  if not found then return false; end if;
  if not public.enqueue_listing_recommendation_projection(dead_letter.listing_id) then return false; end if;

  update public.recommendation_projection_dead_letters
  set retried_at = now()
  where id = dead_letter.id;
  return true;
end;
$$;

revoke all on function public.process_listing_recommendation_projection_jobs(integer, integer) from public, anon, authenticated;
revoke all on function public.retry_recommendation_projection_dead_letter(bigint) from public, anon, authenticated;
grant execute on function public.process_listing_recommendation_projection_jobs(integer, integer) to service_role;
grant execute on function public.retry_recommendation_projection_dead_letter(bigint) to service_role;

insert into public.recommendation_projection_jobs (listing_id)
select listing.id from public.listings listing
on conflict (listing_id) do update set
  requested_at = now(), next_attempt_at = now(), attempt_count = 0,
  last_error_code = null, updated_at = now();

insert into public.marketplace_operational_controls (control_key, enabled, state, configuration)
values (
  'recommendation_projection', true, 'asynchronous',
  '{"projection_version":1,"batch_limit":500,"max_attempts":8,"listing_write_dependency":false}'::jsonb
)
on conflict (control_key) do update set
  enabled = excluded.enabled,
  state = excluded.state,
  configuration = excluded.configuration,
  updated_at = now();

insert into public.marketplace_operational_controls (control_key, enabled, state, configuration)
values (
  'recommendation_foundation', true, 'phase_1_implemented',
  '{"schema_version":55,"projection_version":1,"projection_mode":"asynchronous","services_enabled":false}'::jsonb
)
on conflict (control_key) do update set
  enabled = excluded.enabled,
  state = excluded.state,
  configuration = excluded.configuration,
  updated_at = now();

comment on table public.recommendation_projection_jobs
  is 'Coalescing asynchronous projection queue. Listing and detail writes only enqueue and never await ranking work.';
comment on table public.recommendation_projection_dead_letters
  is 'Stable-code operational evidence for projection jobs that exhausted bounded retries. Raw database errors are never persisted.';
comment on function public.process_listing_recommendation_projection_jobs(integer, integer)
  is 'Concurrent-safe bounded worker using FOR UPDATE SKIP LOCKED. Failures retry with capped exponential backoff and never affect listing availability.';
