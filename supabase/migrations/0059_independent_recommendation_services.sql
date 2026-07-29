-- 0059_independent_recommendation_services.sql
-- Phase 2 service boundary: deterministic, versioned, cursor-only recommendation APIs.
-- These functions are service-role only and are never invoked by listing delivery paths.

create table if not exists public.recommendation_service_policies (
  service_name text primary key check (service_name in (
    'similar_listings_service',
    'seller_recommendations_service',
    'related_services_service',
    'related_products_service',
    'nearby_service',
    'recently_listed_service',
    'personalized_recommendation_service'
  )),
  contract_version integer not null default 1 check (contract_version > 0),
  enabled boolean not null default false,
  timeout_ms integer not null default 250 check (timeout_ms between 50 and 5000),
  cache_fresh_seconds integer not null default 30 check (cache_fresh_seconds between 0 and 3600),
  cache_stale_seconds integer not null default 300 check (cache_stale_seconds between 1 and 86400),
  maximum_page_size integer not null default 24 check (maximum_page_size between 1 and 100),
  configuration jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (cache_stale_seconds >= cache_fresh_seconds),
  check (jsonb_typeof(configuration) = 'object')
);

alter table public.recommendation_service_policies enable row level security;
revoke all on public.recommendation_service_policies from public, anon, authenticated;
grant select, insert, update on public.recommendation_service_policies to service_role;

insert into public.recommendation_service_policies (service_name)
values
  ('similar_listings_service'),
  ('seller_recommendations_service'),
  ('related_services_service'),
  ('related_products_service'),
  ('nearby_service'),
  ('recently_listed_service'),
  ('personalized_recommendation_service')
on conflict (service_name) do nothing;

create index if not exists idx_recommendation_features_recent_cursor
  on public.listing_recommendation_features (published_at desc, listing_id desc)
  where published_at is not null;

create index if not exists idx_recommendation_features_category_recent_cursor
  on public.listing_recommendation_features
  (category_key, subcategory_key, published_at desc, listing_id desc)
  where published_at is not null;

create index if not exists idx_recommendation_features_seller_recent_cursor
  on public.listing_recommendation_features
  (seller_id, published_at desc, listing_id desc)
  where published_at is not null;

create or replace function public.decode_recommendation_cursor_v1(p_cursor text)
returns jsonb
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  decoded jsonb;
begin
  if length(p_cursor) > 1024 then
    raise exception 'invalid recommendation cursor' using errcode = '22023';
  end if;

  begin
    decoded := convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb;
  exception when others then
    raise exception 'invalid recommendation cursor' using errcode = '22023';
  end;

  if jsonb_typeof(decoded) <> 'object'
    or not (decoded ? 'score')
    or not (decoded ? 'published_at')
    or not (decoded ? 'listing_id')
  then
    raise exception 'invalid recommendation cursor' using errcode = '22023';
  end if;

  return decoded;
end;
$$;

create or replace function public.encode_recommendation_cursor_v1(
  p_score numeric,
  p_published_at timestamptz,
  p_listing_id uuid
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(
    convert_to(
      jsonb_build_object(
        'score', round(coalesce(p_score, 0), 6),
        'published_at', p_published_at,
        'listing_id', p_listing_id
      )::text,
      'utf8'
    ),
    'base64'
  );
$$;

create or replace function public.recommendation_service_v1(
  p_service_name text,
  p_subject_listing_id uuid default null,
  p_viewer_id uuid default null,
  p_cursor text default null,
  p_limit integer default 12,
  p_max_distance_meters integer default 50000
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  policy_row public.recommendation_service_policies%rowtype;
  subject_row record;
  cursor_value jsonb;
  cursor_score numeric;
  cursor_published_at timestamptz;
  cursor_listing_id uuid;
  bounded_limit integer;
  request_id uuid := gen_random_uuid();
  result_items jsonb := '[]'::jsonb;
  next_cursor text;
  has_more boolean := false;
begin
  select * into policy_row
  from public.recommendation_service_policies
  where service_name = p_service_name;

  if not found then
    raise exception 'unknown recommendation service' using errcode = '22023';
  end if;

  bounded_limit := greatest(1, least(coalesce(p_limit, 12), policy_row.maximum_page_size));

  if not policy_row.enabled then
    return jsonb_build_object(
      'contractVersion', policy_row.contract_version,
      'service', p_service_name,
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

  if p_service_name not in ('recently_listed_service', 'personalized_recommendation_service') then
    if p_subject_listing_id is null then
      raise exception 'subject listing is required' using errcode = '22023';
    end if;

    select * into subject_row
    from public.eligible_listing_recommendation_features
    where listing_id = p_subject_listing_id;

    if not found then
      return jsonb_build_object(
        'contractVersion', policy_row.contract_version,
        'service', p_service_name,
        'requestId', request_id,
        'items', '[]'::jsonb,
        'nextCursor', null,
        'degraded', false,
        'reason', 'subject_not_eligible'
      );
    end if;
  end if;

  with viewer_affinity as (
    select
      feature.category_key,
      count(*)::numeric as interactions
    from public.recommendation_events event
    join public.eligible_listing_recommendation_features feature
      on feature.listing_id = event.listing_id
    where p_viewer_id is not null
      and event.actor_id = p_viewer_id
      and event.occurred_at >= now() - interval '90 days'
      and event.event_type in ('view', 'save', 'tour_watch', 'chat_start', 'recommendation_click')
    group by feature.category_key
  ),
  candidates as (
    select
      candidate.listing_id,
      candidate.seller_id,
      candidate.category_key,
      candidate.subcategory_key,
      candidate.country_code,
      candidate.location_key,
      candidate.price_amount,
      candidate.currency,
      candidate.quality_score,
      candidate.popularity_score,
      candidate.freshness_score,
      candidate.published_at,
      case p_service_name
        when 'similar_listings_service' then
          (case when candidate.category_key = subject_row.category_key then 3 else 0 end) +
          (case when candidate.subcategory_key is not distinct from subject_row.subcategory_key then 2 else 0 end) +
          (case when candidate.currency is not distinct from subject_row.currency then 0.25 else 0 end) +
          (case
            when subject_row.price_amount is null or candidate.price_amount is null then 0
            else greatest(0, 2 - abs(candidate.price_amount - subject_row.price_amount) /
              greatest(abs(subject_row.price_amount), 1))
          end) + candidate.quality_score + candidate.freshness_score + least(candidate.popularity_score, 10) / 10
        when 'seller_recommendations_service' then
          4 + candidate.quality_score + candidate.freshness_score + least(candidate.popularity_score, 10) / 10
        when 'related_services_service' then
          3 + candidate.quality_score + candidate.freshness_score
        when 'related_products_service' then
          3 + candidate.quality_score + candidate.freshness_score
        when 'nearby_service' then
          3 + candidate.quality_score + candidate.freshness_score
        when 'recently_listed_service' then
          candidate.freshness_score + candidate.quality_score
        when 'personalized_recommendation_service' then
          coalesce(affinity.interactions, 0) + candidate.quality_score + candidate.freshness_score + least(candidate.popularity_score, 10) / 10
        else 0
      end::numeric as rank_score,
      case p_service_name
        when 'similar_listings_service' then
          case when candidate.subcategory_key is not distinct from subject_row.subcategory_key
            then 'same_subcategory' else 'same_category' end
        when 'seller_recommendations_service' then 'same_seller'
        when 'related_services_service' then 'complementary_service'
        when 'related_products_service' then 'related_product'
        when 'nearby_service' then 'nearby_public_location'
        when 'recently_listed_service' then 'recently_published'
        when 'personalized_recommendation_service' then 'category_affinity'
      end as reason_code
    from public.eligible_listing_recommendation_features candidate
    left join viewer_affinity affinity on affinity.category_key = candidate.category_key
    where candidate.listing_id is distinct from p_subject_listing_id
      and (
        (p_service_name = 'similar_listings_service'
          and candidate.category_key = subject_row.category_key)
        or (p_service_name = 'seller_recommendations_service'
          and candidate.seller_id = subject_row.seller_id)
        or (p_service_name = 'related_services_service'
          and candidate.category_key = 'services'
          and exists (
            select 1
            from public.recommendation_taxonomy_nodes source_node
            join public.recommendation_relationships relationship
              on relationship.source_node_id = source_node.id
             and relationship.relationship_type in ('complements', 'requires')
             and relationship.is_active
             and relationship.valid_from <= now()
             and (relationship.valid_until is null or relationship.valid_until > now())
            join public.recommendation_taxonomy_nodes target_node
              on target_node.id = relationship.target_node_id
             and target_node.is_active
            where source_node.is_active
              and source_node.stable_key in (subject_row.category_key, subject_row.subcategory_key)
              and target_node.stable_key in (candidate.category_key, candidate.subcategory_key)
          ))
        or (p_service_name = 'related_products_service'
          and exists (
            select 1
            from public.recommendation_taxonomy_nodes source_node
            join public.recommendation_relationships relationship
              on relationship.source_node_id = source_node.id
             and relationship.relationship_type in ('accessory', 'complements', 'alternative')
             and relationship.is_active
             and relationship.valid_from <= now()
             and (relationship.valid_until is null or relationship.valid_until > now())
            join public.recommendation_taxonomy_nodes target_node
              on target_node.id = relationship.target_node_id
             and target_node.is_active
            where source_node.is_active
              and source_node.stable_key in (subject_row.category_key, subject_row.subcategory_key)
              and target_node.stable_key in (candidate.category_key, candidate.subcategory_key)
          ))
        or (p_service_name = 'nearby_service'
          and subject_row.public_location is not null
          and candidate.public_location is not null
          and extensions.st_dwithin(
            candidate.public_location,
            subject_row.public_location,
            greatest(100, least(coalesce(p_max_distance_meters, 50000), 500000))
          ))
        or (p_service_name = 'recently_listed_service')
        or (p_service_name = 'personalized_recommendation_service'
          and p_viewer_id is not null
          and affinity.interactions is not null)
      )
  ),
  page as (
    select *
    from candidates
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
    coalesce(jsonb_agg(
      jsonb_build_object(
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
        'reasonCode', reason_code
      ) order by rank_score desc, published_at desc nulls last, listing_id desc
    ), '[]'::jsonb),
    (select count(*) > bounded_limit from page),
    (select public.encode_recommendation_cursor_v1(rank_score, published_at, listing_id)
       from visible_page
       order by rank_score asc, published_at asc nulls first, listing_id asc
       limit 1)
  into result_items, has_more, next_cursor
  from visible_page;

  if not has_more then
    next_cursor := null;
  end if;

  return jsonb_build_object(
    'contractVersion', policy_row.contract_version,
    'service', p_service_name,
    'requestId', request_id,
    'items', result_items,
    'nextCursor', next_cursor,
    'degraded', false
  );
exception when query_canceled then
  return jsonb_build_object(
    'contractVersion', coalesce(policy_row.contract_version, 1),
    'service', p_service_name,
    'requestId', request_id,
    'items', '[]'::jsonb,
    'nextCursor', null,
    'degraded', true,
    'reason', 'timeout'
  );
end;
$$;

revoke all on function public.decode_recommendation_cursor_v1(text) from public, anon, authenticated;
revoke all on function public.encode_recommendation_cursor_v1(numeric, timestamptz, uuid) from public, anon, authenticated;
revoke all on function public.recommendation_service_v1(text, uuid, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.recommendation_service_v1(text, uuid, uuid, text, integer, integer) to service_role;

create or replace function public.similar_listings_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('similar_listings_service', $1, null, $2, $3, 50000); $$;

create or replace function public.seller_recommendations_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('seller_recommendations_service', $1, null, $2, $3, 50000); $$;

create or replace function public.related_services_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('related_services_service', $1, null, $2, $3, 50000); $$;

create or replace function public.related_products_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('related_products_service', $1, null, $2, $3, 50000); $$;

create or replace function public.nearby_service_v1(uuid, text default null, integer default 12, integer default 50000)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('nearby_service', $1, null, $2, $3, $4); $$;

create or replace function public.recently_listed_service_v1(text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('recently_listed_service', null, null, $1, $2, 50000); $$;

create or replace function public.personalized_recommendation_service_v1(uuid, text default null, integer default 12)
returns jsonb language sql security definer set search_path = public
as $$ select public.recommendation_service_v1('personalized_recommendation_service', null, $1, $2, $3, 50000); $$;

revoke all on function public.similar_listings_service_v1(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.seller_recommendations_service_v1(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.related_services_service_v1(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.related_products_service_v1(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.nearby_service_v1(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.recently_listed_service_v1(text, integer) from public, anon, authenticated;
revoke all on function public.personalized_recommendation_service_v1(uuid, text, integer) from public, anon, authenticated;

grant execute on function public.similar_listings_service_v1(uuid, text, integer) to service_role;
grant execute on function public.seller_recommendations_service_v1(uuid, text, integer) to service_role;
grant execute on function public.related_services_service_v1(uuid, text, integer) to service_role;
grant execute on function public.related_products_service_v1(uuid, text, integer) to service_role;
grant execute on function public.nearby_service_v1(uuid, text, integer, integer) to service_role;
grant execute on function public.recently_listed_service_v1(text, integer) to service_role;
grant execute on function public.personalized_recommendation_service_v1(uuid, text, integer) to service_role;

update public.marketplace_operational_controls
set
  state = 'phase_2_service_contracts_installed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 59,
    'service_contract_version', 1,
    'cursor_only', true,
    'reason_codes_only', true,
    'services_enabled', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.recommendation_service_v1(text, uuid, uuid, text, integer, integer)
  is 'Shared deterministic V1 ranker behind seven independently deployable recommendation services. Service-role only, cursor-only and fail-closed to empty output.';
