-- 0053_recommendation_foundation_hardening.sql
-- Close attribution, immutability and hot-query gaps before Phase 1 certification.

alter table public.recommendation_taxonomy_nodes
  add constraint recommendation_taxonomy_stable_key_format
  check (stable_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') not valid;
alter table public.recommendation_taxonomy_nodes
  validate constraint recommendation_taxonomy_stable_key_format;

alter table public.recommendation_relationships
  add constraint recommendation_relationship_reason_code_format
  check (reason_code ~ '^[A-Z0-9_]{3,64}$') not valid;
alter table public.recommendation_relationships
  validate constraint recommendation_relationship_reason_code_format;

alter table public.recommendation_events
  add constraint recommendation_events_exactly_one_identity
  check ((actor_id is null) <> (anonymous_session_id is null)) not valid;
alter table public.recommendation_events
  validate constraint recommendation_events_exactly_one_identity;

alter table public.recommendation_events
  add constraint recommendation_events_context_boundary
  check (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 2048) not valid;
alter table public.recommendation_events
  validate constraint recommendation_events_context_boundary;

alter table public.recommendation_events
  add constraint recommendation_events_subject_boundary
  check (
    (event_type = 'search' and listing_id is null)
    or (event_type = 'seller_follow' and listing_id is null and seller_id is not null)
    or (event_type in ('view', 'save', 'tour_watch', 'chat_start', 'recommendation_impression', 'recommendation_click') and listing_id is not null)
  ) not valid;
alter table public.recommendation_events
  validate constraint recommendation_events_subject_boundary;

alter table public.recommendation_events
  add constraint recommendation_events_recommendation_attribution
  check (
    (
      event_type in ('recommendation_impression', 'recommendation_click')
      and recommendation_request_id is not null
      and recommendation_service is not null
      and reason_code ~ '^[A-Z0-9_]{3,64}$'
    )
    or (
      event_type not in ('recommendation_impression', 'recommendation_click')
      and recommendation_request_id is null
      and recommendation_service is null
      and reason_code is null
    )
  ) not valid;
alter table public.recommendation_events
  validate constraint recommendation_events_recommendation_attribution;

create index if not exists idx_recommendation_events_request_cursor
  on public.recommendation_events(recommendation_request_id, event_type, occurred_at desc, id)
  where recommendation_request_id is not null;
create index if not exists idx_listing_recommendation_recent
  on public.listing_recommendation_features(country_code, published_at desc, listing_id desc);
create index if not exists idx_listing_recommendation_quality_popularity
  on public.listing_recommendation_features(category_key, quality_score desc, popularity_score desc, published_at desc, listing_id desc);

create or replace function public.sync_listing_detail_recommendation_feature()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_listing_id uuid;
begin
  if tg_op = 'DELETE' then
    target_listing_id := old.listing_id;
    perform public.refresh_listing_recommendation_feature(target_listing_id);
    return old;
  end if;

  target_listing_id := new.listing_id;
  perform public.refresh_listing_recommendation_feature(target_listing_id);
  return new;
end;
$$;

revoke all on function public.sync_listing_detail_recommendation_feature() from public, anon, authenticated;

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
  event_name text := lower(trim(coalesce(p_event_type, ''));
  service_name text := public.normalize_recommendation_key(p_recommendation_service);
  reason text := upper(trim(coalesce(p_reason_code, ''));
  safe_context jsonb := coalesce(p_context, '{}'::jsonb);
  event_id uuid := gen_random_uuid();
  event_time timestamptz := now();
  attributed_seller uuid;
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
    into attributed_seller
    from public.listings listing
    where listing.id = p_listing_id
      and listing.status in ('available', 'under_offer')
      and listing.content_suspended_at is null;

    if not found then
      raise exception 'listing is not publicly available' using errcode = '22023';
    end if;

    if p_seller_id is not null and p_seller_id <> attributed_seller then
      raise exception 'listing seller attribution does not match' using errcode = '22023';
    end if;
  elsif event_name = 'seller_follow' then
    if p_listing_id is not null
      or p_seller_id is null
      or not exists (
        select 1
        from public.users seller
        where seller.id = p_seller_id
          and seller.status = 'active'
      )
    then
      raise exception 'active seller is required' using errcode = '22023';
    end if;
    attributed_seller := p_seller_id;
  else
    if p_listing_id is not null or p_seller_id is not null then
      raise exception 'search events cannot include a listing or seller' using errcode = '22023';
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
    if p_recommendation_request_id is not null
      or p_recommendation_service is not null
      or p_reason_code is not null
    then
      raise exception 'non-recommendation events cannot include recommendation attribution'
        using errcode = '22023';
    end if;
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
    attributed_seller,
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
grant execute on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb) to anon, authenticated;

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

  update public.listing_recommendation_features
  set popularity_score = 0, projected_at = now();

  update public.listing_recommendation_features feature
  set
    popularity_score = score.total_score,
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

create or replace function public.prevent_recommendation_configuration_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'recommendation configuration audit history is immutable'
    using errcode = '42501';
end;
$$;

revoke all on function public.prevent_recommendation_configuration_audit_mutation() from public, anon, authenticated;

drop trigger if exists trg_recommendation_configuration_audit_immutable on public.recommendation_configuration_audit;
create trigger trg_recommendation_configuration_audit_immutable
  before update or delete on public.recommendation_configuration_audit
  for each row execute function public.prevent_recommendation_configuration_audit_mutation();

comment on constraint recommendation_events_exactly_one_identity on public.recommendation_events
  is 'An event belongs either to an authenticated account or to one short-lived anonymous session, never both.';
