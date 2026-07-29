-- 0073_executable_related_services.sql
-- Phase 7 correctness closure: related services rank the actual services
-- marketplace instead of searching the listing-only projection.

create index if not exists idx_services_recommendation_active_cursor
  on public.services (created_at desc, id desc)
  where status = 'active' and category <> 'legal';

create index if not exists idx_services_recommendation_subcategory
  on public.services (lower(trim(subcategory)), created_at desc, id desc)
  where status = 'active' and category <> 'legal' and subcategory is not null;

alter table public.recommendation_events
  drop constraint recommendation_events_subject_boundary;
alter table public.recommendation_events
  add constraint recommendation_events_subject_boundary
  check (
    (event_type = 'search' and listing_id is null)
    or (event_type = 'seller_follow' and listing_id is null and seller_id is not null)
    or (
      event_type in (
        'view',
        'save',
        'tour_watch',
        'chat_start',
        'recommendation_impression',
        'recommendation_click'
      )
      and listing_id is not null
    )
    or (
      event_type in ('recommendation_impression', 'recommendation_click')
      and listing_id is null
      and seller_id is not null
      and recommendation_service = 'related-services-service'
    )
  ) not valid;
alter table public.recommendation_events
  validate constraint recommendation_events_subject_boundary;

create or replace function public.related_services_service_v1(
  p_subject_listing_id uuid,
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
  subject_row record;
  cursor_value jsonb;
  cursor_score numeric;
  cursor_published_at timestamptz;
  cursor_service_id uuid;
  bounded_limit integer;
  request_id uuid := gen_random_uuid();
  result_items jsonb := '[]'::jsonb;
  next_cursor text;
  has_more boolean := false;
begin
  select * into policy_row
  from public.recommendation_service_policies
  where service_name = 'related_services_service';

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

  if p_subject_listing_id is null then
    raise exception 'subject listing is required' using errcode = '22023';
  end if;

  select * into subject_row
  from public.eligible_listing_recommendation_features
  where listing_id = p_subject_listing_id;

  if not found then
    return jsonb_build_object(
      'contractVersion', policy_row.contract_version,
      'service', policy_row.service_name,
      'requestId', request_id,
      'items', '[]'::jsonb,
      'nextCursor', null,
      'degraded', false,
      'reason', 'subject_not_eligible'
    );
  end if;

  if p_cursor is not null then
    cursor_value := public.decode_recommendation_cursor_v1(p_cursor);
    cursor_score := (cursor_value ->> 'score')::numeric;
    cursor_published_at := (cursor_value ->> 'published_at')::timestamptz;
    cursor_service_id := (cursor_value ->> 'listing_id')::uuid;
  end if;

  with matched as (
    select
      service.id as service_id,
      service.provider_id,
      service.category::text as category_key,
      public.normalize_recommendation_key(service.subcategory) as subcategory_key,
      service.location_id,
      service.location_name,
      service.price as price_amount,
      service.currency,
      service.created_at as published_at,
      max(relationship.weight) + case when service.verified then 0.25 else 0 end
        + greatest(0, 1 - extract(epoch from (now() - service.created_at)) / 2592000)
        as rank_score,
      (array_agg(
        lower(relationship.reason_code)
        order by relationship.weight desc, relationship.id
      ))[1] as reason_code
    from public.services service
    join public.users provider
      on provider.id = service.provider_id
     and provider.status = 'active'
    join public.recommendation_taxonomy_nodes source_node
      on source_node.is_active
     and source_node.stable_key in (
       subject_row.category_key,
       subject_row.subcategory_key
     )
    join public.recommendation_relationships relationship
      on relationship.source_node_id = source_node.id
     and relationship.relationship_type in ('complements', 'requires')
     and relationship.is_active
     and relationship.valid_from <= now()
     and (relationship.valid_until is null or relationship.valid_until > now())
    join public.recommendation_taxonomy_nodes target_node
      on target_node.id = relationship.target_node_id
     and target_node.node_type = 'service'
     and target_node.is_active
    where service.status = 'active'
      and service.category <> 'legal'
      and (
        target_node.stable_key = public.normalize_recommendation_key(service.subcategory)
        or exists (
          select 1
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(service.subcategories) = 'array' then service.subcategories
              else '[]'::jsonb
            end
          ) value
          where target_node.stable_key = public.normalize_recommendation_key(value)
        )
      )
    group by
      service.id,
      service.provider_id,
      service.category,
      service.subcategory,
      service.location_id,
      service.location_name,
      service.price,
      service.currency,
      service.created_at,
      service.verified
  ),
  page as (
    select *
    from matched
    where p_cursor is null
       or (rank_score, published_at, service_id) <
          (cursor_score, cursor_published_at, cursor_service_id)
    order by rank_score desc, published_at desc, service_id desc
    limit bounded_limit + 1
  ),
  visible_page as (
    select *
    from page
    order by rank_score desc, published_at desc, service_id desc
    limit bounded_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'entityType', 'service',
      'serviceId', service_id,
      'providerId', provider_id,
      'categoryKey', category_key,
      'subcategoryKey', subcategory_key,
      'locationKey', location_id,
      'locationLabel', location_name,
      'priceAmount', price_amount,
      'currency', currency,
      'publishedAt', published_at,
      'score', round(rank_score, 6),
      'reasonCode', reason_code
    ) order by rank_score desc, published_at desc, service_id desc), '[]'::jsonb),
    (select count(*) > bounded_limit from page),
    (select public.encode_recommendation_cursor_v1(rank_score, published_at, service_id)
       from visible_page
       order by rank_score asc, published_at asc, service_id asc
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
exception when query_canceled then
  return jsonb_build_object(
    'contractVersion', coalesce(policy_row.contract_version, 1),
    'service', 'related_services_service',
    'requestId', request_id,
    'items', '[]'::jsonb,
    'nextCursor', null,
    'degraded', true,
    'reason', 'timeout'
  );
end;
$$;

revoke all on function public.related_services_service_v1(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.related_services_service_v1(uuid, text, integer)
  to service_role;

create or replace function public.record_recommended_service_event_v1(
  p_event_type text,
  p_service_id uuid,
  p_anonymous_session_id uuid,
  p_recommendation_request_id uuid,
  p_recommendation_service text,
  p_reason_code text,
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
  recommendation_name text := public.normalize_recommendation_key(p_recommendation_service);
  reason text := upper(trim(coalesce(p_reason_code, '')));
  safe_context jsonb := coalesce(p_context, '{}'::jsonb);
  event_id uuid := gen_random_uuid();
  event_time timestamptz := now();
  provider_id uuid;
begin
  if event_name not in ('recommendation_impression', 'recommendation_click')
    or recommendation_name <> 'related-services-service'
    or p_service_id is null
    or p_recommendation_request_id is null
    or reason !~ '^[A-Z0-9_]{3,64}$'
  then
    raise exception 'recommended service attribution is incomplete'
      using errcode = '22023';
  end if;

  if actor is not null and not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if actor is null and p_anonymous_session_id is null then
    raise exception 'anonymous session is required' using errcode = '22023';
  end if;
  if jsonb_typeof(safe_context) <> 'object'
    or octet_length(safe_context::text) > 2048
  then
    raise exception 'event context must be a small JSON object'
      using errcode = '22023';
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
    raise exception 'event context contains an unsupported field'
      using errcode = '22023';
  end if;

  select service.provider_id into provider_id
  from public.services service
  join public.users provider
    on provider.id = service.provider_id
   and provider.status = 'active'
  where service.id = p_service_id
    and service.status = 'active'
    and service.category <> 'legal';

  if not found then
    raise exception 'service is not publicly available'
      using errcode = '22023';
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
  )
  values (
    event_id,
    event_time,
    actor,
    case when actor is null then p_anonymous_session_id else null end,
    event_name,
    null,
    provider_id,
    p_recommendation_request_id,
    recommendation_name,
    reason,
    safe_context,
    event_time + case when actor is null then interval '30 days' else interval '180 days' end
  );

  return event_id;
end;
$$;

revoke all on function public.record_recommended_service_event_v1(
  text, uuid, uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_recommended_service_event_v1(
  text, uuid, uuid, uuid, text, text, jsonb
) to anon, authenticated;

create or replace function public.validate_recommendation_event_subject_state()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  eligible_seller_id uuid;
begin
  if new.actor_id is not null and not exists (
    select 1
    from public.users actor
    where actor.id = new.actor_id
      and actor.status = 'active'
  ) then
    raise exception 'event actor is not active'
      using errcode = '42501';
  end if;

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
  elsif new.event_type in ('recommendation_impression', 'recommendation_click') then
    if new.recommendation_service <> 'related-services-service'
      or new.seller_id is null
      or not exists (
        select 1
        from public.services service
        join public.users provider
          on provider.id = service.provider_id
         and provider.status = 'active'
        where service.provider_id = new.seller_id
          and service.status = 'active'
          and service.category <> 'legal'
      )
    then
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

update public.marketplace_operational_controls
set
  state = 'phase_7_executable_service_recommendations',
  configuration = configuration || jsonb_build_object(
    'schema_version', 73,
    'related_services_entity_type', 'service',
    'related_services_listing_projection_dependency', false,
    'recommended_service_aggregate_events', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.related_services_service_v1(uuid, text, integer)
  is 'Ranks active non-legal marketplace services through taxonomy relationships and returns typed service entities.';
comment on function public.record_recommended_service_event_v1(text, uuid, uuid, uuid, text, text, jsonb)
  is 'Records aggregate-safe impression or click attribution for a currently public recommended marketplace service.';
