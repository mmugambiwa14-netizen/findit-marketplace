-- 0060_recommendation_global_service_isolation.sql
-- Remove direct access to the shared dispatcher and give global services dedicated query paths.

revoke execute on function public.recommendation_service_v1(text, uuid, uuid, text, integer, integer)
  from service_role;

create or replace function public.recently_listed_service_v1(
  p_cursor text default null,
  p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_row public.recommendation_service_policies%rowtype;
  cursor_value jsonb;
  cursor_score numeric;
  cursor_published_at timestamptz;
  cursor_listing_id uuid;
  bounded_limit integer;
  request_id uuid := gen_random_uuid();
  result_items jsonb;
  has_more boolean;
  next_cursor text;
begin
  select * into policy_row
  from public.recommendation_service_policies
  where service_name = 'recently_listed_service';

  bounded_limit := greatest(1, least(coalesce(p_limit, 12), policy_row.maximum_page_size));
  if not policy_row.enabled then
    return jsonb_build_object(
      'contractVersion', policy_row.contract_version,
      'service', policy_row.service_name,
      'requestId', request_id,
      'items', '[]'::jsonb,
      'nextCursor', null,
      'degraded', true,
      'reason', 'service_disabled'
    );
  end if;

  if p_cursor is not null then
    cursor_value := public.decode_recommendation_cursor_v1(p_cursor);
    cursor_score := (cursor_value ->> 'score')::numeric;
    cursor_published_at := (cursor_value ->> 'published_at')::timestamptz;
    cursor_listing_id := (cursor_value ->> 'listing_id')::uuid;
  end if;

  with ranked as (
    select
      feature.*,
      (feature.freshness_score + feature.quality_score)::numeric as rank_score
    from public.eligible_listing_recommendation_features feature
  ),
  page as (
    select *
    from ranked
    where p_cursor is null
       or (rank_score, published_at, listing_id) <
          (cursor_score, cursor_published_at, cursor_listing_id)
    order by rank_score desc, published_at desc nulls last, listing_id desc
    limit bounded_limit + 1
  ),
  visible_page as (
    select * from page
    order by rank_score desc, published_at desc nulls last, listing_id desc
    limit bounded_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'listingId', listing_id,
      'sellerId', seller_id,
      'categoryKey', category_key,
      'subcategoryKey', subcategory_key,
      'countryCode', country_code,
      'locationKey', location_key,
      'priceAmount', price_amount,
      'currency', currency,
      'publishedAt', published_at,
      'score', round(rank_score, 6),
      'reasonCode', 'recently_published'
    ) order by rank_score desc, published_at desc nulls last, listing_id desc), '[]'::jsonb),
    (select count(*) > bounded_limit from page),
    (select public.encode_recommendation_cursor_v1(rank_score, published_at, listing_id)
       from visible_page
       order by rank_score asc, published_at asc nulls first, listing_id asc
       limit 1)
  into result_items, has_more, next_cursor
  from visible_page;

  if not has_more then next_cursor := null; end if;
  return jsonb_build_object(
    'contractVersion', policy_row.contract_version,
    'service', policy_row.service_name,
    'requestId', request_id,
    'items', result_items,
    'nextCursor', next_cursor,
    'degraded', false
  );
end;
$$;

create or replace function public.personalized_recommendation_service_v1(
  p_viewer_id uuid,
  p_cursor text default null,
  p_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  policy_row public.recommendation_service_policies%rowtype;
  cursor_value jsonb;
  cursor_score numeric;
  cursor_published_at timestamptz;
  cursor_listing_id uuid;
  bounded_limit integer;
  request_id uuid := gen_random_uuid();
  result_items jsonb;
  has_more boolean;
  next_cursor text;
begin
  if p_viewer_id is null then
    raise exception 'viewer is required' using errcode = '22023';
  end if;

  select * into policy_row
  from public.recommendation_service_policies
  where service_name = 'personalized_recommendation_service';

  bounded_limit := greatest(1, least(coalesce(p_limit, 12), policy_row.maximum_page_size));
  if not policy_row.enabled then
    return jsonb_build_object(
      'contractVersion', policy_row.contract_version,
      'service', policy_row.service_name,
      'requestId', request_id,
      'items', '[]'::jsonb,
      'nextCursor', null,
      'degraded', true,
      'reason', 'service_disabled'
    );
  end if;

  if p_cursor is not null then
    cursor_value := public.decode_recommendation_cursor_v1(p_cursor);
    cursor_score := (cursor_value ->> 'score')::numeric;
    cursor_published_at := (cursor_value ->> 'published_at')::timestamptz;
    cursor_listing_id := (cursor_value ->> 'listing_id')::uuid;
  end if;

  with affinity as (
    select feature.category_key, count(*)::numeric as interactions
    from public.recommendation_events event
    join public.eligible_listing_recommendation_features feature
      on feature.listing_id = event.listing_id
    where event.actor_id = p_viewer_id
      and event.occurred_at >= now() - interval '90 days'
      and event.event_type in ('view', 'save', 'tour_watch', 'chat_start', 'recommendation_click')
    group by feature.category_key
  ),
  ranked as (
    select
      feature.*,
      (affinity.interactions + feature.quality_score + feature.freshness_score +
        least(feature.popularity_score, 10) / 10)::numeric as rank_score
    from public.eligible_listing_recommendation_features feature
    join affinity on affinity.category_key = feature.category_key
  ),
  page as (
    select *
    from ranked
    where p_cursor is null
       or (rank_score, published_at, listing_id) <
          (cursor_score, cursor_published_at, cursor_listing_id)
    order by rank_score desc, published_at desc nulls last, listing_id desc
    limit bounded_limit + 1
  ),
  visible_page as (
    select * from page
    order by rank_score desc, published_at desc nulls last, listing_id desc
    limit bounded_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'listingId', listing_id,
      'sellerId', seller_id,
      'categoryKey', category_key,
      'subcategoryKey', subcategory_key,
      'countryCode', country_code,
      'locationKey', location_key,
      'priceAmount', price_amount,
      'currency', currency,
      'publishedAt', published_at,
      'score', round(rank_score, 6),
      'reasonCode', 'category_affinity'
    ) order by rank_score desc, published_at desc nulls last, listing_id desc), '[]'::jsonb),
    (select count(*) > bounded_limit from page),
    (select public.encode_recommendation_cursor_v1(rank_score, published_at, listing_id)
       from visible_page
       order by rank_score asc, published_at asc nulls first, listing_id asc
       limit 1)
  into result_items, has_more, next_cursor
  from visible_page;

  if not has_more then next_cursor := null; end if;
  return jsonb_build_object(
    'contractVersion', policy_row.contract_version,
    'service', policy_row.service_name,
    'requestId', request_id,
    'items', result_items,
    'nextCursor', next_cursor,
    'degraded', false
  );
end;
$$;

revoke all on function public.recently_listed_service_v1(text, integer) from public, anon, authenticated;
revoke all on function public.personalized_recommendation_service_v1(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.recently_listed_service_v1(text, integer) to service_role;
grant execute on function public.personalized_recommendation_service_v1(uuid, text, integer) to service_role;

update public.marketplace_operational_controls
set
  state = 'phase_2_independent_services_installed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 60,
    'direct_shared_dispatcher_access', false,
    'global_services_isolated', true,
    'services_enabled', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
