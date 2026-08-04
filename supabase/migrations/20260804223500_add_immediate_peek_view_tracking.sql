create table if not exists public.tour_view_events (
  id bigint generated always as identity primary key,
  tour_id uuid not null references public.listing_tours(id) on delete cascade,
  viewer_key uuid not null,
  viewer_id uuid null,
  viewed_on date not null default current_date,
  first_played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tour_id, viewer_key, viewed_on)
);

create index if not exists tour_view_events_tour_id_idx on public.tour_view_events(tour_id);
create index if not exists tour_view_events_created_at_idx on public.tour_view_events(created_at desc);

alter table public.tour_view_events enable row level security;
revoke all on public.tour_view_events from anon, authenticated;

create or replace function public.record_public_tour_view(p_tour_id uuid, p_viewer_key uuid)
returns table(recorded boolean, view_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if p_tour_id is null or p_viewer_key is null then
    raise exception 'invalid Peek view' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.listing_tours t
    where t.id = p_tour_id
      and t.status = 'ready'
      and t.moderation_status = 'approved'
      and t.deleted_at is null
      and t.removed_at is null
      and t.published_at is not null
      and public.is_tour_public_eligible(t.id)
  ) then
    raise exception 'Peek is unavailable' using errcode = 'P0002';
  end if;

  insert into public.tour_view_events(tour_id, viewer_key, viewer_id)
  values (p_tour_id, p_viewer_key, auth.uid())
  on conflict (tour_id, viewer_key, viewed_on) do nothing;
  get diagnostics inserted_count = row_count;

  return query
  select inserted_count = 1,
         (select count(*)::bigint from public.tour_view_events v where v.tour_id = p_tour_id);
end;
$$;

create or replace function public.public_tour_view_counts(p_tour_ids uuid[])
returns table(tour_id uuid, view_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select requested.id, count(v.id)::bigint
  from unnest(coalesce(p_tour_ids, '{}'::uuid[])) requested(id)
  left join public.tour_view_events v on v.tour_id = requested.id
  group by requested.id;
$$;

grant execute on function public.record_public_tour_view(uuid, uuid) to anon, authenticated;
grant execute on function public.public_tour_view_counts(uuid[]) to anon, authenticated;
