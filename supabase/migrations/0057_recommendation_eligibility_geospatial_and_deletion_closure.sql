-- 0057_recommendation_eligibility_geospatial_and_deletion_closure.sql
-- Phase 1 closure:
-- - project only listings owned by active sellers;
-- - index privacy-safe public geography for nearby services;
-- - prevent recommendation constraints from blocking account or listing deletion;
-- - validate event subject eligibility at the table boundary.

alter table public.listing_recommendation_features
  add column if not exists public_location extensions.geography(point, 4326);

create index if not exists idx_listing_recommendation_public_location
  on public.listing_recommendation_features
  using gist (public_location)
  where public_location is not null;

alter function public.refresh_listing_recommendation_feature(uuid)
  rename to refresh_listing_recommendation_feature_v1_core;

revoke all on function public.refresh_listing_recommendation_feature_v1_core(uuid)
  from public, anon, authenticated, service_role;

create function public.refresh_listing_recommendation_feature(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  location_value extensions.geography;
  refreshed boolean;
begin
  select listing.public_location
  into location_value
  from public.listings listing
  join public.users seller
    on seller.id = listing.seller_id
   and seller.status = 'active'
  where listing.id = p_listing_id
    and listing.status in ('available', 'under_offer')
    and listing.content_suspended_at is null;

  if not found then
    delete from public.listing_recommendation_features
    where listing_id = p_listing_id;
    return false;
  end if;

  refreshed := public.refresh_listing_recommendation_feature_v1_core(p_listing_id);

  if refreshed then
    update public.listing_recommendation_features
    set public_location = location_value
    where listing_id = p_listing_id
      and public_location is distinct from location_value;
  end if;

  return refreshed;
end;
$$;

revoke all on function public.refresh_listing_recommendation_feature(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_listing_recommendation_feature(uuid)
  to service_role;

create or replace function public.sync_seller_recommendation_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_id_value uuid;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  begin
    if new.status <> 'active' then
      delete from public.listing_recommendation_features
      where seller_id = new.id;
    end if;

    for listing_id_value in
      select listing.id
      from public.listings listing
      where listing.seller_id = new.id
      order by listing.id
    loop
      perform public.enqueue_listing_recommendation_projection(listing_id_value);
    end loop;
  exception when others then
    -- Recommendation maintenance must never block account suspension,
    -- restoration or another marketplace identity transition.
    null;
  end;

  return new;
end;
$$;

revoke all on function public.sync_seller_recommendation_eligibility()
  from public, anon, authenticated;

drop trigger if exists trg_users_recommendation_eligibility on public.users;
create trigger trg_users_recommendation_eligibility
  after update of status on public.users
  for each row execute function public.sync_seller_recommendation_eligibility();

alter table public.recommendation_events
  drop constraint if exists recommendation_events_actor_id_fkey;
alter table public.recommendation_events
  add constraint recommendation_events_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete cascade;

alter table public.recommendation_events
  drop constraint if exists recommendation_events_listing_id_fkey;
alter table public.recommendation_events
  add constraint recommendation_events_listing_id_fkey
  foreign key (listing_id) references public.listings(id) on delete cascade;

alter table public.recommendation_events
  drop constraint if exists recommendation_events_seller_id_fkey;
alter table public.recommendation_events
  add constraint recommendation_events_seller_id_fkey
  foreign key (seller_id) references auth.users(id) on delete cascade;

create or replace function public.validate_recommendation_event_subject_state()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  eligible_seller_id uuid;
begin
  if new.listing_id is not null then
    select listing.seller_id
    into eligible_seller_id
    from public.listings listing
    join public.users seller
      on seller.id = listing.seller_id
     and seller.status = 'active'
    where listing.id = new.listing_id
      and listing.status in ('available', 'under_offer')
      and listing.content_suspended_at is null;

    if not found or new.seller_id is distinct from eligible_seller_id then
      raise exception 'event subject is not publicly eligible'
        using errcode = '22023';
    end if;
  elsif new.event_type = 'seller_follow' then
    if new.seller_id is null or not exists (
      select 1
      from public.users seller
      where seller.id = new.seller_id
        and seller.status = 'active'
    ) then
      raise exception 'event subject is not publicly eligible'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_recommendation_event_subject_state()
  from public, anon, authenticated;

drop trigger if exists trg_recommendation_events_subject_state
  on public.recommendation_events;
create trigger trg_recommendation_events_subject_state
  before insert or update of event_type, listing_id, seller_id
  on public.recommendation_events
  for each row execute function public.validate_recommendation_event_subject_state();

update public.marketplace_operational_controls
set
  state = 'phase_1_closed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 57,
    'active_seller_required', true,
    'public_geospatial_projection', true,
    'deletion_safe_event_foreign_keys', true,
    'services_enabled', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on column public.listing_recommendation_features.public_location
  is 'Privacy-safe canonical public geography only. Exact owner-supplied coordinates are never projected.';
comment on function public.refresh_listing_recommendation_feature(uuid)
  is 'Eligibility wrapper around the deterministic V1 projection core. Inactive sellers and non-public listings are removed from the recommendation surface.';
comment on function public.validate_recommendation_event_subject_state()
  is 'Table-level guarantee that listing and seller events reference currently public subjects owned by active accounts.';
