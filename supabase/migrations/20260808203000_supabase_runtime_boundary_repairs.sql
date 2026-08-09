-- Repair hosted Supabase drift without exposing listing or service rows.
-- Category counts are served from a four-row aggregate projection. The
-- browser can read the projection, while only database-owned routines write
-- it; the source marketplace tables remain protected by their existing RLS.

create table if not exists public.discover_category_count_snapshots (
  category_key text primary key,
  item_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint discover_category_count_key_check
    check (category_key in ('property', 'car', 'machinery', 'service')),
  constraint discover_category_count_snapshots_item_count_check
    check (item_count >= 0)
);

alter table public.discover_category_count_snapshots enable row level security;
revoke all on table public.discover_category_count_snapshots from public, anon, authenticated;
grant select on table public.discover_category_count_snapshots to anon, authenticated;
drop policy if exists discover_category_count_snapshots_public_read on public.discover_category_count_snapshots;
create policy discover_category_count_snapshots_public_read
  on public.discover_category_count_snapshots
  for select
  to anon, authenticated
  using (true);

insert into public.discover_category_count_snapshots (category_key, item_count)
values
  ('property', 0),
  ('car', 0),
  ('machinery', 0),
  ('service', 0)
on conflict (category_key) do nothing;

create or replace function private.discover_listing_category_key(p_category text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select min(c.marketplace_kind)
  from public.categories c
  where c.slug = p_category
    and c.marketplace_kind in ('property', 'car', 'machinery')
    and c.is_active = true;
$$;

create or replace function private.discover_listing_is_countable(
  p_status public.listing_status,
  p_expires_at timestamptz,
  p_content_suspended_at timestamptz
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status in ('available'::public.listing_status, 'under_offer'::public.listing_status)
    and (p_expires_at is null or p_expires_at > now())
    and p_content_suspended_at is null;
$$;

create or replace function private.adjust_discover_category_count(p_category_key text, p_delta bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_category_key is null
     or p_category_key not in ('property', 'car', 'machinery', 'service')
     or p_delta is null
     or p_delta = 0 then
    return;
  end if;

  insert into public.discover_category_count_snapshots (category_key, item_count, updated_at)
  values (p_category_key, greatest(p_delta, 0), now())
  on conflict (category_key) do update
    set item_count = greatest(0, public.discover_category_count_snapshots.item_count + p_delta),
        updated_at = now();
end;
$$;

create or replace function private.reconcile_discover_category_counts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.discover_category_count_snapshots (category_key, item_count, updated_at)
  with listing_counts as (
    select c.marketplace_kind as category_key, count(*)::bigint as item_count
    from public.listings l
    join public.categories c
      on c.slug = l.category
     and c.marketplace_kind in ('property', 'car', 'machinery')
     and c.is_active = true
    where private.discover_listing_is_countable(l.status, l.expires_at, l.content_suspended_at)
    group by c.marketplace_kind
  ), service_count as (
    select 'service'::text as category_key, count(*)::bigint as item_count
    from public.services s
    where s.status = 'active'::public.service_status
  ), keys(category_key) as (
    values ('property'::text), ('car'::text), ('machinery'::text), ('service'::text)
  )
  select k.category_key, coalesce(lc.item_count, sc.item_count, 0)::bigint, now()
  from keys k
  left join listing_counts lc using (category_key)
  left join service_count sc using (category_key)
  on conflict (category_key) do update
    set item_count = excluded.item_count,
        updated_at = excluded.updated_at;
end;
$$;

create or replace function private.maintain_listing_discover_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_key text;
  new_key text;
begin
  begin
    if tg_op in ('UPDATE', 'DELETE')
       and private.discover_listing_is_countable(old.status, old.expires_at, old.content_suspended_at) then
      old_key := private.discover_listing_category_key(old.category);
      perform private.adjust_discover_category_count(old_key, -1);
    end if;

    if tg_op in ('INSERT', 'UPDATE')
       and private.discover_listing_is_countable(new.status, new.expires_at, new.content_suspended_at) then
      new_key := private.discover_listing_category_key(new.category);
      perform private.adjust_discover_category_count(new_key, 1);
    end if;
  exception when others then
    raise warning 'Discover listing count maintenance failed: %', sqlerrm;
  end;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.maintain_service_discover_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op in ('UPDATE', 'DELETE') and old.status = 'active'::public.service_status then
      perform private.adjust_discover_category_count('service', -1);
    end if;
    if tg_op in ('INSERT', 'UPDATE') and new.status = 'active'::public.service_status then
      perform private.adjust_discover_category_count('service', 1);
    end if;
  exception when others then
    raise warning 'Discover service count maintenance failed: %', sqlerrm;
  end;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.reconcile_discover_counts_after_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.reconcile_discover_category_counts();
  exception when others then
    raise warning 'Discover category count reconciliation failed: %', sqlerrm;
  end;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists maintain_listing_discover_count on public.listings;
create trigger maintain_listing_discover_count
  after insert or delete or update of category, status, expires_at, content_suspended_at
  on public.listings
  for each row execute function private.maintain_listing_discover_count();

drop trigger if exists maintain_service_discover_count on public.services;
create trigger maintain_service_discover_count
  after insert or delete or update of status
  on public.services
  for each row execute function private.maintain_service_discover_count();

drop trigger if exists reconcile_discover_counts_after_category_change on public.categories;
create trigger reconcile_discover_counts_after_category_change
  after insert or delete or update of slug, marketplace_kind, is_active
  on public.categories
  for each statement execute function private.reconcile_discover_counts_after_category_change();

revoke all on function private.discover_listing_category_key(text) from public, anon, authenticated, service_role;
revoke all on function private.discover_listing_is_countable(public.listing_status, timestamptz, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.adjust_discover_category_count(text, bigint) from public, anon, authenticated, service_role;
revoke all on function private.reconcile_discover_category_counts() from public, anon, authenticated, service_role;
revoke all on function private.maintain_listing_discover_count() from public, anon, authenticated, service_role;
revoke all on function private.maintain_service_discover_count() from public, anon, authenticated, service_role;
revoke all on function private.reconcile_discover_counts_after_category_change() from public, anon, authenticated, service_role;

-- The public RPC reads only the aggregate projection. It must not read the
-- protected listings/services tables as an invoker.
create or replace function public.discover_category_counts()
returns table(category_key text, item_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.category_key, s.item_count
  from public.discover_category_count_snapshots s
  order by case s.category_key
    when 'property' then 1
    when 'car' then 2
    when 'machinery' then 3
    else 4
  end;
$$;

revoke all on function public.discover_category_counts() from public;
grant execute on function public.discover_category_counts() to anon, authenticated;

-- Correct any stale snapshot before the trigger-maintained path takes over.
select private.reconcile_discover_category_counts();

-- Private synchronization ledgers are service-owned and must also have
-- defense-in-depth RLS, even though browser roles have no grants.
alter table private.abuse_rate_limit_buckets enable row level security;
alter table private.location_registry_country_syncs enable row level security;
alter table private.location_registry_admin1_syncs enable row level security;

revoke all on table private.abuse_rate_limit_buckets from public, anon, authenticated;
revoke all on table private.location_registry_country_syncs from public, anon, authenticated;
revoke all on table private.location_registry_admin1_syncs from public, anon, authenticated;
