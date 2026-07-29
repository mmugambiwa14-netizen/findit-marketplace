-- 0054_recommendation_foundation_certification_corrections.sql
-- Final Phase 1 corrections found during certification review.

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

  with rolling_scores as (
    select popularity.listing_id, sum(popularity.score) as total_score
    from public.recommendation_popularity_daily popularity
    where popularity.metric_date >= current_date - 30
    group by popularity.listing_id
  )
  update public.listing_recommendation_features feature
  set
    popularity_score = rolling_scores.total_score,
    projected_at = now()
  from rolling_scores
  where feature.listing_id = rolling_scores.listing_id
    and feature.popularity_score is distinct from rolling_scores.total_score;

  update public.listing_recommendation_features feature
  set
    popularity_score = 0,
    projected_at = now()
  where feature.popularity_score <> 0
    and not exists (
      select 1
      from public.recommendation_popularity_daily popularity
      where popularity.listing_id = feature.listing_id
        and popularity.metric_date >= current_date - 30
    );

  return affected;
end;
$$;

revoke all on function public.refresh_recommendation_popularity_daily(date) from public, anon, authenticated;
grant execute on function public.refresh_recommendation_popularity_daily(date) to service_role;

-- PostgreSQL cannot change an existing function return shape with CREATE OR REPLACE.
-- No application role can execute the previous worker function, so replace it
-- explicitly inside this migration before exposing the new cursor metadata.
drop function public.refresh_listing_recommendation_features_batch(uuid, integer);

create function public.refresh_listing_recommendation_features_batch(
  p_after_listing_id uuid default null,
  p_limit integer default 500
)
returns table (processed_count integer, next_listing_id uuid, has_more boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_cursor uuid;
  processed integer := 0;
  next_cursor uuid := null;
  requested_limit integer;
begin
  if p_limit not between 1 and 2000 then
    raise exception 'recommendation projection batch size must be between 1 and 2000'
      using errcode = '22023';
  end if;

  requested_limit := p_limit + 1;

  for listing_cursor in
    select listing.id
    from public.listings listing
    where p_after_listing_id is null or listing.id > p_after_listing_id
    order by listing.id
    limit requested_limit
  loop
    if processed = p_limit then
      return query select processed, next_cursor, true;
      return;
    end if;

    perform public.refresh_listing_recommendation_feature(listing_cursor);
    processed := processed + 1;
    next_cursor := listing_cursor;
  end loop;

  return query select processed, next_cursor, false;
end;
$$;

revoke all on function public.refresh_listing_recommendation_features_batch(uuid, integer) from public, anon, authenticated;
grant execute on function public.refresh_listing_recommendation_features_batch(uuid, integer) to service_role;

create or replace function public.recommendation_foundation_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'projection_version', 1,
    'projected_public_listings', (select count(*) from public.listing_recommendation_features),
    'active_taxonomy_nodes', (select count(*) from public.recommendation_taxonomy_nodes where is_active),
    'active_relationships', (
      select count(*)
      from public.recommendation_relationships
      where is_active
        and valid_from <= now()
        and (valid_until is null or valid_until > now())
    ),
    'active_weight_profiles', (select count(*) from public.recommendation_weight_profiles where is_active),
    'expired_cache_entries', (select count(*) from public.recommendation_cache where expires_at <= now()),
    'expired_events', (select count(*) from public.recommendation_events where expires_at <= now()),
    'oldest_unexpired_event_at', (
      select min(occurred_at)
      from public.recommendation_events
      where expires_at > now()
    ),
    'generated_at', now()
  );
$$;

revoke all on function public.recommendation_foundation_health() from public, anon, authenticated;
grant execute on function public.recommendation_foundation_health() to service_role;

insert into public.marketplace_operational_controls (control_key, enabled, state, configuration)
values (
  'recommendation_foundation',
  true,
  'phase_1_implemented',
  '{"schema_version":54,"projection_version":1,"services_enabled":false}'::jsonb
)
on conflict (control_key) do update set
  enabled = excluded.enabled,
  state = excluded.state,
  configuration = excluded.configuration,
  updated_at = now();

comment on function public.recommendation_foundation_health()
  is 'Service-role operational snapshot. It exposes counts and lag only, never behavioural event payloads or identities.';
