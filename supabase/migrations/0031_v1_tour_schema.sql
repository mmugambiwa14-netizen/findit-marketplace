-- 0031_v1_tour_schema.sql
-- Dormant Tours domain foundation. Tours remain attached to one canonical
-- marketplace parent (listing or service), are versioned for atomic replacement,
-- and cannot become public through direct browser writes.

create table public.marketplace_feature_controls (
  feature_key text primary key check (feature_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(configuration) = 'object')
);

insert into public.marketplace_feature_controls (feature_key, enabled, configuration)
values (
  'tours',
  false,
  jsonb_build_object(
    'maxDurationSeconds', 120,
    'maxSourceBytes', 262144000,
    'publicHeight', 720,
    'sourceRetentionDays', 7,
    'maxProcessingAttempts', 3
  )
)
on conflict (feature_key) do nothing;

create or replace function public.validate_tour_feature_configuration(p_configuration jsonb)
returns jsonb as $$
declare
  max_duration integer;
  max_source_bytes bigint;
  public_height integer;
  retention_days integer;
  max_attempts integer;
begin
  if p_configuration is null or jsonb_typeof(p_configuration) <> 'object' then
    raise exception 'Tour feature configuration must be an object' using errcode = '22023';
  end if;
  if coalesce(p_configuration ->> 'maxDurationSeconds', '') !~ '^[0-9]+$'
    or coalesce(p_configuration ->> 'maxSourceBytes', '') !~ '^[0-9]+$'
    or coalesce(p_configuration ->> 'publicHeight', '') !~ '^[0-9]+$'
    or coalesce(p_configuration ->> 'sourceRetentionDays', '') !~ '^[0-9]+$'
    or coalesce(p_configuration ->> 'maxProcessingAttempts', '') !~ '^[0-9]+$' then
    raise exception 'Tour feature configuration is incomplete or invalid' using errcode = '22023';
  end if;

  max_duration := (p_configuration ->> 'maxDurationSeconds')::integer;
  max_source_bytes := (p_configuration ->> 'maxSourceBytes')::bigint;
  public_height := (p_configuration ->> 'publicHeight')::integer;
  retention_days := (p_configuration ->> 'sourceRetentionDays')::integer;
  max_attempts := (p_configuration ->> 'maxProcessingAttempts')::integer;

  -- Browser, Storage and processor contracts are deliberately fixed for this
  -- release. Operational retention and retry counts remain bounded settings.
  if max_duration <> 120 or max_source_bytes <> 262144000 or public_height <> 720
    or retention_days not between 1 and 30
    or max_attempts not between 1 and 10 then
    raise exception 'Tour feature configuration is outside the supported boundary' using errcode = '22023';
  end if;
  return p_configuration;
end;
$$ language plpgsql immutable set search_path = public;

create or replace function public.tour_processing_max_attempts()
returns integer as $$
  select least(10, greatest(1, coalesce((
    select (configuration ->> 'maxProcessingAttempts')::integer
    from public.marketplace_feature_controls
    where feature_key = 'tours'
  ), 3)));
$$ language sql stable security definer set search_path = public;

create or replace function public.is_backend_feature_enabled(p_feature_key text)
returns boolean as $$
  select coalesce((
    select enabled
    from public.marketplace_feature_controls
    where feature_key = p_feature_key
  ), false);
$$ language sql stable security definer set search_path = public;

create or replace function public.set_backend_feature_enabled(
  p_feature_key text,
  p_enabled boolean,
  p_configuration jsonb default null
)
returns void as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_feature_key !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'invalid feature key' using errcode = '22023';
  end if;
  if p_configuration is not null and jsonb_typeof(p_configuration) <> 'object' then
    raise exception 'feature configuration must be an object' using errcode = '22023';
  end if;
  if p_feature_key = 'tours' and p_configuration is not null then
    perform public.validate_tour_feature_configuration(p_configuration);
  end if;

  insert into public.marketplace_feature_controls (
    feature_key, enabled, configuration, updated_by, updated_at
  ) values (
    p_feature_key,
    p_enabled,
    coalesce(p_configuration, '{}'::jsonb),
    auth.uid(),
    now()
  )
  on conflict (feature_key) do update set
    enabled = excluded.enabled,
    configuration = case
      when p_configuration is null then public.marketplace_feature_controls.configuration
      else excluded.configuration
    end,
    updated_by = auth.uid(),
    updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

create table public.listing_tours (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,

  source_storage_path text not null unique,
  playback_storage_path text unique,
  thumbnail_storage_path text unique,

  status text not null default 'created' check (
    status in (
      'created', 'upload_authorized', 'uploaded', 'processing', 'ready',
      'failed', 'superseded', 'removed', 'cleaned'
    )
  ),
  moderation_status text not null default 'pending' check (
    moderation_status in ('pending', 'approved', 'rejected', 'reported')
  ),

  duration_seconds numeric(7,3) check (duration_seconds is null or duration_seconds between 0.001 and 120),
  width integer check (width is null or width between 1 and 7680),
  height integer check (height is null or height between 1 and 4320),
  aspect_ratio numeric(9,6) check (aspect_ratio is null or aspect_ratio between 0.1 and 10),
  mime_type text check (mime_type is null or mime_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  detected_container text check (detected_container is null or detected_container ~ '^[a-z0-9._-]{1,40}$'),
  detected_video_codec text check (detected_video_codec is null or detected_video_codec ~ '^[a-z0-9._-]{1,40}$'),
  detected_audio_codec text check (detected_audio_codec is null or detected_audio_codec ~ '^[a-z0-9._-]{1,40}$'),
  source_byte_size bigint check (source_byte_size is null or source_byte_size between 1 and 262144000),
  processed_byte_size bigint check (processed_byte_size is null or processed_byte_size between 1 and 262144000),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),

  processor_name text check (processor_name is null or processor_name ~ '^[a-z0-9._-]{1,80}$'),
  processor_job_id text,
  processing_attempts integer not null default 0 check (processing_attempts between 0 and 10),
  processing_lease_token uuid,
  processing_lease_until timestamptz,
  processing_retry_at timestamptz,
  processing_heartbeat_at timestamptz,

  failure_code text check (failure_code is null or failure_code ~ '^[a-z0-9_]{1,80}$'),
  failure_message text check (failure_message is null or length(failure_message) <= 1000),
  rejection_reason text check (rejection_reason is null or length(rejection_reason) between 3 and 1000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uploaded_at timestamptz,
  processing_started_at timestamptz,
  ready_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  superseded_at timestamptz,
  removed_at timestamptz,
  deleted_at timestamptz,

  constraint listing_tours_exactly_one_parent check (
    (listing_id is not null and service_id is null)
    or (listing_id is null and service_id is not null)
  ),
  constraint listing_tours_source_path check (
    source_storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/source/[0-9a-f-]{36}\.(mp4|mov|webm)$'
  ),
  constraint listing_tours_playback_path check (
    playback_storage_path is null
    or playback_storage_path ~ '^(listing|service)/[0-9a-f-]{36}/[0-9a-f-]{36}\.mp4$'
  ),
  constraint listing_tours_thumbnail_path check (
    thumbnail_storage_path is null
    or thumbnail_storage_path ~ '^(listing|service)/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'
  ),
  constraint listing_tours_processing_lease_consistency check (
    (processing_lease_token is null and processing_lease_until is null)
    or (processing_lease_token is not null and processing_lease_until is not null)
  ),
  constraint listing_tours_ready_metadata check (
    status <> 'ready'
    or (
      playback_storage_path is not null
      and thumbnail_storage_path is not null
      and duration_seconds is not null
      and width is not null
      and height is not null
      and processed_byte_size is not null
      and ready_at is not null
    )
  )
);

create trigger trg_listing_tours_updated_at
  before update on public.listing_tours
  for each row execute function public.set_updated_at();

create table public.listing_tour_slots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  current_tour_id uuid references public.listing_tours(id) on delete set null,
  pending_tour_id uuid references public.listing_tours(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_tour_slots_exactly_one_parent check (
    (listing_id is not null and service_id is null)
    or (listing_id is null and service_id is not null)
  ),
  constraint listing_tour_slots_distinct_versions check (
    current_tour_id is null or pending_tour_id is null or current_tour_id <> pending_tour_id
  )
);

create unique index idx_listing_tour_slots_listing
  on public.listing_tour_slots(listing_id) where listing_id is not null;
create unique index idx_listing_tour_slots_service
  on public.listing_tour_slots(service_id) where service_id is not null;
create index idx_listing_tour_slots_owner
  on public.listing_tour_slots(owner_id, updated_at desc);

create trigger trg_listing_tour_slots_updated_at
  before update on public.listing_tour_slots
  for each row execute function public.set_updated_at();

create table public.listing_tour_events (
  id bigint generated always as identity primary key,
  tour_id uuid not null references public.listing_tours(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  actor_type text not null check (actor_type in ('owner', 'admin', 'worker', 'system')),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_]{1,79}$'),
  previous_status text,
  next_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index idx_listing_tour_events_tour_created
  on public.listing_tour_events(tour_id, created_at desc, id desc);

create or replace function public.resolve_tour_parent_owner(
  p_listing_id uuid,
  p_service_id uuid
)
returns uuid as $$
declare
  resolved_owner uuid;
begin
  if (p_listing_id is null) = (p_service_id is null) then
    raise exception 'exactly one Tour parent is required' using errcode = '22023';
  end if;

  if p_listing_id is not null then
    select seller_id into resolved_owner from public.listings where id = p_listing_id;
  else
    select provider_id into resolved_owner from public.services where id = p_service_id and category <> 'legal';
  end if;

  if resolved_owner is null then
    raise exception 'Tour parent not found' using errcode = 'P0002';
  end if;
  return resolved_owner;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.enforce_listing_tour_parent_owner()
returns trigger as $$
declare
  expected_owner uuid;
begin
  expected_owner := public.resolve_tour_parent_owner(new.listing_id, new.service_id);
  if new.owner_id <> expected_owner then
    raise exception 'Tour owner must match parent owner' using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_listing_tours_parent_owner
  before insert or update of owner_id, listing_id, service_id on public.listing_tours
  for each row execute function public.enforce_listing_tour_parent_owner();

create or replace function public.enforce_listing_tour_slot_integrity()
returns trigger as $$
declare
  expected_owner uuid;
  candidate public.listing_tours%rowtype;
begin
  expected_owner := public.resolve_tour_parent_owner(new.listing_id, new.service_id);
  if new.owner_id <> expected_owner then
    raise exception 'Tour slot owner must match parent owner' using errcode = '42501';
  end if;

  if new.current_tour_id is not null then
    select * into candidate from public.listing_tours where id = new.current_tour_id;
    if not found
      or candidate.owner_id <> new.owner_id
      or candidate.listing_id is distinct from new.listing_id
      or candidate.service_id is distinct from new.service_id
      or candidate.status <> 'ready'
      or candidate.moderation_status <> 'approved'
      or candidate.deleted_at is not null then
      raise exception 'current Tour is not eligible for this parent' using errcode = '23514';
    end if;
  end if;

  if new.pending_tour_id is not null then
    select * into candidate from public.listing_tours where id = new.pending_tour_id;
    if not found
      or candidate.owner_id <> new.owner_id
      or candidate.listing_id is distinct from new.listing_id
      or candidate.service_id is distinct from new.service_id
      or candidate.status in ('superseded', 'removed', 'cleaned')
      or candidate.deleted_at is not null then
      raise exception 'pending Tour is not eligible for this parent' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_listing_tour_slots_integrity
  before insert or update on public.listing_tour_slots
  for each row execute function public.enforce_listing_tour_slot_integrity();

alter table public.marketplace_feature_controls enable row level security;
alter table public.listing_tours enable row level security;
alter table public.listing_tour_slots enable row level security;
alter table public.listing_tour_events enable row level security;

create policy "listing_tours_owner_admin_read" on public.listing_tours
  for select using (owner_id = auth.uid() or public.is_admin());
create policy "listing_tour_slots_owner_admin_read" on public.listing_tour_slots
  for select using (owner_id = auth.uid() or public.is_admin());
create policy "listing_tour_events_owner_admin_read" on public.listing_tour_events
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.listing_tours t
      where t.id = tour_id and t.owner_id = auth.uid()
    )
  );

revoke all on table public.marketplace_feature_controls from anon, authenticated;
revoke all on table public.listing_tours from anon, authenticated;
revoke all on table public.listing_tour_slots from anon, authenticated;
revoke all on table public.listing_tour_events from anon, authenticated;
grant select on table public.listing_tours to authenticated;
grant select on table public.listing_tour_slots to authenticated;
grant select on table public.listing_tour_events to authenticated;

revoke all on function public.validate_tour_feature_configuration(jsonb) from public, anon, authenticated;
revoke all on function public.tour_processing_max_attempts() from public, anon, authenticated;
revoke all on function public.is_backend_feature_enabled(text) from public, anon, authenticated;
revoke all on function public.set_backend_feature_enabled(text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.resolve_tour_parent_owner(uuid, uuid) from public, anon, authenticated;
revoke all on function public.enforce_listing_tour_parent_owner() from public, anon, authenticated;
revoke all on function public.enforce_listing_tour_slot_integrity() from public, anon, authenticated;
grant execute on function public.is_backend_feature_enabled(text) to service_role;
grant execute on function public.set_backend_feature_enabled(text, boolean, jsonb) to service_role;
