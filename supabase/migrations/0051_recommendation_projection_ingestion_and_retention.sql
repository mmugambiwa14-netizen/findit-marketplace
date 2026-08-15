-- 0051_recommendation_projection_ingestion_and_retention.sql
-- Phase 1 operational foundation for listing projections and privacy-limited events.
-- Every function is additive and independent from listing delivery.

create or replace function public.normalize_recommendation_key(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    trim(both '-' from regexp_replace(lower(trim(coalesce(p_value, ''))), '[^a-z0-9]+', '-', 'g')),
    ''
  );
$$;

revoke all on function public.normalize_recommendation_key(text) from public, anon, authenticated;

create or replace function public.refresh_listing_recommendation_feature(p_listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  listing_record public.listings%rowtype;
  token_values text[] := '{}';
  detail_completeness numeric := 0;
  photo_count integer := 0;
  quality numeric := 0;
  freshness numeric := 0;
  category_value text;
  subcategory_value text;
begin
  select *
  into listing_record
  from public.listings
  where id = p_listing_id;

  if not found
    or listing_record.status not in ('available', 'under_offer')
    or listing_record.content_suspended_at is not null
  then
    delete from public.listing_recommendation_features
    where listing_id = p_listing_id;
    return false;
  end if;

  category_value := public.normalize_recommendation_key(listing_record.kind::text);
  subcategory_value := public.normalize_recommendation_key(listing_record.category);

  token_values := array_remove(array[
    category_value,
    subcategory_value,
    public.normalize_recommendation_key(listing_record.listing_type)
  ], null);

  if listing_record.kind = 'car' then
    select
      token_values || array_remove(array[
        public.normalize_recommendation_key(car.brand),
        public.normalize_recommendation_key(car.model),
        public.normalize_recommendation_key(car.year::text),
        public.normalize_recommendation_key(car.fuel_type::text),
        public.normalize_recommendation_key(car.transmission::text),
        public.normalize_recommendation_key(car.condition)
      ], null),
      (
        (car.brand is not null)::integer
        + (car.model is not null)::integer
        + (car.year is not null)::integer
        + (car.mileage is not null)::integer
        + (car.fuel_type is not null)::integer
        + (car.transmission is not null)::integer
        + (car.condition is not null)::integer
      )::numeric / 7
    into token_values, detail_completeness
    from public.car_details car
    where car.listing_id = listing_record.id;
  elsif listing_record.kind = 'property' then
    select
      token_values || array_remove(array[
        public.normalize_recommendation_key(property.property_type::text),
        case when property.bedrooms is null then null else 'bedrooms-' || property.bedrooms::text end,
        case when property.bathrooms is null then null else 'bathrooms-' || property.bathrooms::text end,
        case
          when property.size_sqm is null then null
          when property.size_sqm < 75 then 'size-small'
          when property.size_sqm < 180 then 'size-medium'
          else 'size-large'
        end
      ], null),
      (
        (property.property_type is not null)::integer
        + (property.bedrooms is not null)::integer
        + (property.bathrooms is not null)::integer
        + (property.size_sqm is not null)::integer
      )::numeric / 4
    into token_values, detail_completeness
    from public.property_details property
    where property.listing_id = listing_record.id;
  elsif listing_record.kind = 'machinery' then
    select
      token_values || array_remove(array[
        public.normalize_recommendation_key(machinery.machinery_type::text),
        public.normalize_recommendation_key(machinery.brand),
        public.normalize_recommendation_key(machinery.model),
        public.normalize_recommendation_key(machinery.condition::text),
        public.normalize_recommendation_key(machinery.year::text),
        case
          when machinery.usage_hours is null then null
          when machinery.usage_hours < 1000 then 'usage-low'
          when machinery.usage_hours < 5000 then 'usage-medium'
          else 'usage-high'
        end
      ], null),
      (
        (machinery.machinery_type is not null)::integer
        + (machinery.brand is not null)::integer
        + (machinery.model is not null)::integer
        + (machinery.condition is not null)::integer
        + (machinery.year is not null)::integer
        + (machinery.usage_hours is not null)::integer
      )::numeric / 6
    into token_values, detail_completeness
    from public.machinery_details machinery
    where machinery.listing_id = listing_record.id;
  end if;

  detail_completeness := coalesce(detail_completeness, 0);

  select coalesce(array_agg(distinct token order by token), '{}')
  into token_values
  from unnest(coalesce(token_values, '{}')) token
  where token is not null and token <> '';

  photo_count := case
    when jsonb_typeof(listing_record.photos) = 'array' then jsonb_array_length(listing_record.photos)
    else 0
  end;

  quality := least(1::numeric,
    0.10
    + case when length(trim(coalesce(listing_record.title, ''))) >= 20 then 0.10 else 0 end
    + case when length(trim(coalesce(listing_record.description, ''))) >= 120 then 0.15 else 0 end
    + case when photo_count >= 5 then 0.20 when photo_count >= 2 then 0.12 when photo_count = 1 then 0.05 else 0 end
    + case when listing_record.location_id is not null and listing_record.public_location_label is not null then 0.10 else 0 end
    + case when listing_record.native_price is not null and listing_record.native_price > 0 then 0.05 else 0 end
    + case when listing_record.verified then 0.10 else 0 end
    + (0.20 * detail_completeness)
  );

  freshness := greatest(
    0::numeric,
    least(
      1::numeric,
      exp(
        -greatest(extract(epoch from (now() - listing_record.created_at)) / 86400, 0) / 90.0
      )::numeric
    )
  );

  insert into public.listing_recommendation_features (
    listing_id,
    seller_id,
    category_key,
    subcategory_key,
    country_code,
    location_key,
    price_amount,
    currency,
    specification_tokens,
    quality_score,
    popularity_score,
    freshness_score,
    published_at,
    projected_at,
    projection_version
  ) values (
    listing_record.id,
    listing_record.seller_id,
    category_value,
    subcategory_value,
    upper(coalesce(listing_record.country_code, 'ZW')),
    coalesce(
      listing_record.location_id::text,
      public.normalize_recommendation_key(listing_record.public_location_label)
    ),
    coalesce(listing_record.native_price, listing_record.price),
    upper(coalesce(nullif(listing_record.native_currency, ''), nullif(listing_record.currency, ''), 'USD')),
    token_values,
    quality,
    coalesce((
      select sum(popularity.score)
      from public.recommendation_popularity_daily popularity
      where popularity.listing_id = listing_record.id
        and popularity.metric_date >= current_date - 30
    ), 0),
    freshness,
    listing_record.created_at,
    now(),
    1
  )
  on conflict (listing_id) do update set
    seller_id = excluded.seller_id,
    category_key = excluded.category_key,
    subcategory_key = excluded.subcategory_key,
    country_code = excluded.country_code,
    location_key = excluded.location_key,
    price_amount = excluded.price_amount,
    currency = excluded.currency,
    specification_tokens = excluded.specification_tokens,
    quality_score = excluded.quality_score,
    popularity_score = excluded.popularity_score,
    freshness_score = excluded.freshness_score,
    published_at = excluded.published_at,
    projected_at = excluded.projected_at,
    projection_version = excluded.projection_version;

  return true;
end;
$$;

revoke all on function public.refresh_listing_recommendation_feature(uuid) from public, anon, authenticated;
grant execute on function public.refresh_listing_recommendation_feature(uuid) to service_role;

create or replace function public.sync_listing_recommendation_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.listing_recommendation_features where listing_id = old.id;
    return old;
  end if;

  perform public.refresh_listing_recommendation_feature(new.id);
  return new;
end;
$$;

create or replace function public.sync_listing_detail_recommendation_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_listing_recommendation_feature(coalesce(new.listing_id, old.listing_id));
  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_listing_recommendation_feature() from public, anon, authenticated;
revoke all on function public.sync_listing_detail_recommendation_feature() from public, anon, authenticated;

drop trigger if exists trg_listings_recommendation_projection on public.listings;
create trigger trg_listings_recommendation_projection
  after insert or update of
    seller_id,
    title,
    description,
    photos,
    category,
    listing_type,
    status,
    content_suspended_at,
    price,
    currency,
    native_price,
    native_currency,
    location_id,
    country_code,
    public_location_label,
    verified
  on public.listings
  for each row execute function public.sync_listing_recommendation_feature();

drop trigger if exists trg_car_details_recommendation_projection on public.car_details;
create trigger trg_car_details_recommendation_projection
  after insert or update or delete on public.car_details
  for each row execute function public.sync_listing_detail_recommendation_feature();

drop trigger if exists trg_property_details_recommendation_projection on public.property_details;
create trigger trg_property_details_recommendation_projection
  after insert or update or delete on public.property_details
  for each row execute function public.sync_listing_detail_recommendation_feature();

drop trigger if exists trg_machinery_details_recommendation_projection on public.machinery_details;
create trigger trg_machinery_details_recommendation_projection
  after insert or update or delete on public.machinery_details
  for each row execute function public.sync_listing_detail_recommendation_feature();

create or replace function public.refresh_listing_recommendation_features_batch(
  p_after_listing_id uuid default null,
  p_limit integer default 500
)
returns table (processed_count integer, next_listing_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_cursor uuid;
  processed integer := 0;
  next_cursor uuid := null;
begin
  if p_limit not between 1 and 2000 then
    raise exception 'recommendation projection batch size must be between 1 and 2000'
      using errcode = '22023';
  end if;

  for listing_cursor in
    select listing.id
    from public.listings listing
    where p_after_listing_id is null or listing.id > p_after_listing_id
    order by listing.id
    limit p_limit
  loop
    perform public.refresh_listing_recommendation_feature(listing_cursor);
    processed := processed + 1;
    next_cursor := listing_cursor;
  end loop;

  return query select processed, next_cursor;
end;
$$;

revoke all on function public.refresh_listing_recommendation_features_batch(uuid, integer) from public, anon, authenticated;
grant execute on function public.refresh_listing_recommendation_features_batch(uuid, integer) to service_role;

create or replace function public.ensure_recommendation_event_partition(p_month date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := date_trunc('month', p_month)::date;
  month_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  partition_name text := 'recommendation_events_' || to_char(date_trunc('month', p_month), 'YYYYMM');
begin
  if p_month is null then
    raise exception 'partition month is required' using errcode = '22023';
  end if;

  execute format(
    'create table if not exists public.%I partition of public.recommendation_events for values from (%L) to (%L)',
    partition_name,
    month_start,
    month_end
  );
  execute format('alter table public.%I enable row level security', partition_name);
  execute format('revoke all on table public.%I from public, anon, authenticated', partition_name);

  return partition_name;
end;
$$;

revoke all on function public.ensure_recommendation_event_partition(date) from public, anon, authenticated;
grant execute on function public.ensure_recommendation_event_partition(date) to service_role;

do $$
declare
  month_offset integer;
begin
  for month_offset in -1..4 loop
    perform public.ensure_recommendation_event_partition((current_date + make_interval(months => month_offset))::date);
  end loop;
end;
$$;

drop policy if exists recommendation_events_actor_read on public.recommendation_events;
create policy recommendation_events_actor_read
  on public.recommendation_events
  for select
  to authenticated
  using (public.is_active_user() and actor_id = auth.uid());

create or replace function public.record_recommendation_event(
  p_event_type text,
  p_listing_id uuid default null,
  p_seller_id uuid default null,
  p_anonymous_session_id uuid default null,
  p_recommendation_request_id uuid default null,
  p_recommendation_service text default null,
  p_reason_code text default null,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  event_name text := lower(trim(coalesce(p_event_type, '')));
  service_name text := public.normalize_recommendation_key(p_recommendation_service);
  reason text := upper(trim(coalesce(p_reason_code, '')));
  safe_context jsonb := coalesce(p_context, '{}'::jsonb);
  event_id uuid := gen_random_uuid();
  event_time timestamptz := now();
  listing_seller uuid;
begin
  if event_name not in (
    'view',
    'save',
    'tour_watch',
    'search',
    'chat_start',
    'seller_follow',
    'recommendation_impression',
    'recommendation_click'
  ) then
    raise exception 'unsupported recommendation event type' using errcode = '22023';
  end if;

  if actor is not null and not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  if actor is null and p_anonymous_session_id is null then
    raise exception 'anonymous session is required' using errcode = '22023';
  end if;

  if actor is null and event_name in ('save', 'chat_start', 'seller_follow') then
    raise exception 'authentication required for this event' using errcode = '42501';
  end if;

  if jsonb_typeof(safe_context) <> 'object' or octet_length(safe_context::text) > 2048 then
    raise exception 'event context must be a small JSON object' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(safe_context) context_key
    where context_key not in (
      'source',
      'surface',
      'position',
      'page_size',
      'result_count',
      'query_token_count',
      'watch_seconds',
      'category_key',
      'location_key',
      'is_repeat'
    )
  ) then
    raise exception 'event context contains an unsupported field' using errcode = '22023';
  end if;

  if event_name in ('view', 'save', 'tour_watch', 'chat_start', 'recommendation_impression', 'recommendation_click') then
    if p_listing_id is null then
      raise exception 'listing is required for this event' using errcode = '22023';
    end if;

    select listing.seller_id
    into listing_seller
    from public.listings listing
    where listing.id = p_listing_id
      and listing.status in ('available', 'under_offer')
      and listing.content_suspended_at is null;

    if not found then
      raise exception 'listing is not publicly available' using errcode = '22023';
    end if;
  end if;

  if event_name = 'seller_follow' then
    if p_seller_id is null or not exists (
      select 1 from public.users seller
      where seller.id = p_seller_id and seller.status = 'active'
    ) then
      raise exception 'active seller is required' using errcode = '22023';
    end if;
  end if;

  if event_name in ('recommendation_impression', 'recommendation_click') then
    if p_recommendation_request_id is null
      or service_name not in (
        'similar-listings-service',
        'seller-recommendations-service',
        'related-services-service',
        'related-products-service',
        'nearby-service',
        'recently-listed-service',
        'personalized-recommendation-service'
      )
      or reason !~ '^[A-Z0-9_]{3,64}$'
    then
      raise exception 'recommendation attribution is incomplete' using errcode = '22023';
    end if;
  else
    service_name := null;
    reason := null;
  end if;

  insert into public.recommendation_events (
    id,
    occurred_at,
    actor_id,
    anonymous_session_id,
    event_type,
    listing_id,
    seller_id,
    recommendation_request_id,
    recommendation_service,
    reason_code,
    context,
    expires_at
  ) values (
    event_id,
    event_time,
    actor,
    case when actor is null then p_anonymous_session_id else null end,
    event_name,
    p_listing_id,
    coalesce(p_seller_id, listing_seller),
    p_recommendation_request_id,
    service_name,
    nullif(reason, ''),
    safe_context,
    event_time + case when actor is null then interval '30 days' else interval '180 days' end
  );

  return event_id;
end;
$$;

revoke all on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb) from public;
grant execute on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb) to anon, authenticated, service_role;

create or replace function public.refresh_recommendation_popularity_daily(p_metric_date date default current_date - 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  if p_metric_date is null or p_metric_date > current_date then
    raise exception 'metric date must not be in the future' using errcode = '22023';
  end if;

  delete from public.recommendation_popularity_daily
  where metric_date = p_metric_date;

  insert into public.recommendation_popularity_daily (
    metric_date,
    listing_id,
    view_count,
    save_count,
    tour_watch_count,
    chat_start_count,
    recommendation_click_count,
    score,
    refreshed_at
  )
  select
    p_metric_date,
    event.listing_id,
    count(*) filter (where event.event_type = 'view'),
    count(*) filter (where event.event_type = 'save'),
    count(*) filter (where event.event_type = 'tour_watch'),
    count(*) filter (where event.event_type = 'chat_start'),
    count(*) filter (where event.event_type = 'recommendation_click'),
    (
      count(*) filter (where event.event_type = 'view')
      + 4 * count(*) filter (where event.event_type = 'save')
      + 2 * count(*) filter (where event.event_type = 'tour_watch')
      + 8 * count(*) filter (where event.event_type = 'chat_start')
      + 1.5 * count(*) filter (where event.event_type = 'recommendation_click')
    )::numeric,
    now()
  from public.recommendation_events event
  where event.occurred_at >= p_metric_date::timestamptz
    and event.occurred_at < (p_metric_date + 1)::timestamptz
    and event.listing_id is not null
  group by event.listing_id;

  get diagnostics affected = row_count;

  update public.listing_recommendation_features feature
  set
    popularity_score = coalesce(score.total_score, 0),
    projected_at = now()
  from (
    select popularity.listing_id, sum(popularity.score) as total_score
    from public.recommendation_popularity_daily popularity
    where popularity.metric_date >= current_date - 30
    group by popularity.listing_id
  ) score
  where feature.listing_id = score.listing_id;

  return affected;
end;
$$;

revoke all on function public.refresh_recommendation_popularity_daily(date) from public, anon, authenticated;
grant execute on function public.refresh_recommendation_popularity_daily(date) to service_role;

create or replace function public.purge_expired_recommendation_data(p_limit integer default 5000)
returns table (events_deleted integer, cache_entries_deleted integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  event_count integer := 0;
  cache_count integer := 0;
begin
  if p_limit not between 1 and 50000 then
    raise exception 'retention batch size must be between 1 and 50000'
      using errcode = '22023';
  end if;

  with expired as (
    select event.occurred_at, event.id
    from public.recommendation_events event
    where event.expires_at <= now()
    order by event.expires_at, event.occurred_at, event.id
    limit p_limit
  )
  delete from public.recommendation_events event
  using expired
  where event.occurred_at = expired.occurred_at
    and event.id = expired.id;
  get diagnostics event_count = row_count;

  with expired as (
    select cache.cache_key
    from public.recommendation_cache cache
    where cache.expires_at <= now()
    order by cache.expires_at, cache.cache_key
    limit p_limit
  )
  delete from public.recommendation_cache cache
  using expired
  where cache.cache_key = expired.cache_key;
  get diagnostics cache_count = row_count;

  return query select event_count, cache_count;
end;
$$;

revoke all on function public.purge_expired_recommendation_data(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_recommendation_data(integer) to service_role;

insert into public.marketplace_operational_controls (control_key, enabled, state, configuration)
values
  ('recommendation_projection', true, 'enabled', '{"projection_version":1,"batch_limit":2000}'::jsonb),
  ('recommendation_event_collection', true, 'enabled', '{"anonymous_retention_days":30,"authenticated_retention_days":180}'::jsonb),
  ('recommendation_retention', true, 'enabled', '{"default_batch_limit":5000}'::jsonb)
on conflict (control_key) do update set
  enabled = excluded.enabled,
  state = excluded.state,
  configuration = excluded.configuration,
  updated_at = now();

do $$
declare
  listing_id_value uuid;
begin
  for listing_id_value in
    select listing.id from public.listings listing order by listing.id
  loop
    perform public.refresh_listing_recommendation_feature(listing_id_value);
  end loop;
end;
$$;

comment on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb)
  is 'First-party, bounded event ingestion. Actor identity comes only from auth.uid(); anonymous context is session-scoped and short-lived.';
comment on function public.refresh_listing_recommendation_feature(uuid)
  is 'Deterministic listing projection. Failure or absence never changes listing publication or listing reads.';
