-- 0056_recommendation_partition_and_configuration_integrity.sql
-- Final integrity and million-row operational corrections for Phase 1.

create or replace function public.ensure_recommendation_event_partition(p_month date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date;
  month_end date;
  partition_name text;
  existing_partition regclass;
begin
  if p_month is null then
    raise exception 'partition month is required' using errcode = '22023';
  end if;

  month_start := date_trunc('month', p_month)::date;
  month_end := (date_trunc('month', p_month) + interval '1 month')::date;
  partition_name := 'recommendation_events_' || to_char(month_start, 'YYYYMM');
  existing_partition := to_regclass(format('public.%I', partition_name));

  if existing_partition is not null then
    return partition_name;
  end if;

  lock table public.recommendation_events_default in access exclusive mode;

  existing_partition := to_regclass(format('public.%I', partition_name));
  if existing_partition is not null then
    return partition_name;
  end if;

  create temporary table if not exists recommendation_events_partition_buffer
    (like public.recommendation_events including defaults including constraints)
    on commit drop;
  truncate table pg_temp.recommendation_events_partition_buffer;

  insert into pg_temp.recommendation_events_partition_buffer (
    id, occurred_at, actor_id, anonymous_session_id, event_type, listing_id,
    seller_id, recommendation_request_id, recommendation_service, reason_code,
    context, expires_at
  )
  select
    id, occurred_at, actor_id, anonymous_session_id, event_type, listing_id,
    seller_id, recommendation_request_id, recommendation_service, reason_code,
    context, expires_at
  from public.recommendation_events_default
  where occurred_at >= month_start::timestamptz
    and occurred_at < month_end::timestamptz;

  delete from public.recommendation_events_default
  where occurred_at >= month_start::timestamptz
    and occurred_at < month_end::timestamptz;

  execute format(
    'create table public.%I partition of public.recommendation_events for values from (%L) to (%L)',
    partition_name,
    month_start,
    month_end
  );
  execute format('alter table public.%I enable row level security', partition_name);
  execute format('revoke all on table public.%I from public, anon, authenticated', partition_name);

  insert into public.recommendation_events (
    id, occurred_at, actor_id, anonymous_session_id, event_type, listing_id,
    seller_id, recommendation_request_id, recommendation_service, reason_code,
    context, expires_at
  )
  select
    id, occurred_at, actor_id, anonymous_session_id, event_type, listing_id,
    seller_id, recommendation_request_id, recommendation_service, reason_code,
    context, expires_at
  from pg_temp.recommendation_events_partition_buffer;

  return partition_name;
end;
$$;

revoke all on function public.ensure_recommendation_event_partition(date) from public, anon, authenticated;
grant execute on function public.ensure_recommendation_event_partition(date) to service_role;

drop policy if exists recommendation_relationships_public_read on public.recommendation_relationships;
create policy recommendation_relationships_public_read
  on public.recommendation_relationships
  for select
  using (
    is_active
    and valid_from <= now()
    and (valid_until is null or valid_until > now())
    and exists (
      select 1
      from public.recommendation_taxonomy_nodes source_node
      where source_node.id = source_node_id
        and source_node.is_active
    )
    and exists (
      select 1
      from public.recommendation_taxonomy_nodes target_node
      where target_node.id = target_node_id
        and target_node.is_active
    )
  );

create or replace function public.admin_upsert_recommendation_taxonomy_node(
  p_node_type text,
  p_stable_key text,
  p_label text,
  p_parent_id uuid default null,
  p_attributes jsonb default '{}'::jsonb,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_key text := public.normalize_recommendation_key(p_stable_key);
  normalized_type text := lower(trim(coalesce(p_node_type, '')));
  safe_attributes jsonb := coalesce(p_attributes, '{}'::jsonb);
  node_id uuid;
  before_value jsonb;
  after_value jsonb;
  audit_action text;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if normalized_type not in ('category', 'subcategory', 'product', 'service', 'tag', 'location')
    or normalized_key is null
    or length(trim(coalesce(p_label, ''))) not between 2 and 120
    or jsonb_typeof(safe_attributes) <> 'object'
    or octet_length(safe_attributes::text) > 8192
  then
    raise exception 'invalid recommendation taxonomy node' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(safe_attributes) attribute_key
    where attribute_key not in (
      'listing_kind', 'domain', 'aliases', 'unit', 'country_code',
      'display_order', 'icon_key', 'search_terms', 'metadata_version'
    )
  ) then
    raise exception 'taxonomy attributes contain an unsupported field' using errcode = '22023';
  end if;

  if p_parent_id is not null and not exists (
    select 1 from public.recommendation_taxonomy_nodes where id = p_parent_id
  ) then
    raise exception 'taxonomy parent does not exist' using errcode = '22023';
  end if;

  select node.id, to_jsonb(node)
  into node_id, before_value
  from public.recommendation_taxonomy_nodes node
  where node.node_type = normalized_type
    and node.stable_key = normalized_key;

  if node_id is not null and p_parent_id = node_id then
    raise exception 'taxonomy node cannot be its own parent' using errcode = '22023';
  end if;

  if node_id is not null and p_parent_id is not null and exists (
    with recursive ancestors as (
      select node.id, node.parent_id
      from public.recommendation_taxonomy_nodes node
      where node.id = p_parent_id
      union
      select parent.id, parent.parent_id
      from public.recommendation_taxonomy_nodes parent
      join ancestors child on parent.id = child.parent_id
    )
    select 1 from ancestors where id = node_id
  ) then
    raise exception 'taxonomy parent would create a cycle' using errcode = '22023';
  end if;

  audit_action := case when node_id is null then 'create' else 'update' end;

  insert into public.recommendation_taxonomy_nodes (
    node_type, stable_key, parent_id, label, attributes, is_active
  ) values (
    normalized_type, normalized_key, p_parent_id, trim(p_label), safe_attributes, p_is_active
  )
  on conflict (node_type, stable_key) do update set
    parent_id = excluded.parent_id,
    label = excluded.label,
    attributes = excluded.attributes,
    is_active = excluded.is_active
  returning id, to_jsonb(recommendation_taxonomy_nodes.*)
  into node_id, after_value;

  insert into public.recommendation_configuration_audit (
    actor_id, entity_type, entity_id, action, before_state, after_state
  ) values (
    auth.uid(), 'taxonomy_node', node_id,
    case
      when audit_action = 'update' and coalesce((before_value ->> 'is_active')::boolean, false) <> p_is_active
        then case when p_is_active then 'activate' else 'deactivate' end
      else audit_action
    end,
    before_value, after_value
  );

  perform public.write_audit_log('recommendation.taxonomy.upsert', node_id, 'recommendation_taxonomy_node');
  return node_id;
end;
$$;

create or replace function public.admin_upsert_recommendation_weight_profile(
  p_service_name text,
  p_contract_version integer,
  p_profile_key text,
  p_weights jsonb,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  service_key text := public.normalize_recommendation_key(p_service_name);
  profile_key_value text := public.normalize_recommendation_key(p_profile_key);
  profile_id uuid;
  before_value jsonb;
  after_value jsonb;
  audit_action text;
  deactivated record;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if service_key not in (
    'similar-listings-service', 'seller-recommendations-service',
    'related-services-service', 'related-products-service', 'nearby-service',
    'recently-listed-service', 'personalized-recommendation-service'
  )
    or p_contract_version < 1
    or profile_key_value is null
    or jsonb_typeof(coalesce(p_weights, 'null'::jsonb)) <> 'object'
  then
    raise exception 'invalid recommendation weight profile' using errcode = '22023';
  end if;

  select profile.id, to_jsonb(profile)
  into profile_id, before_value
  from public.recommendation_weight_profiles profile
  where profile.service_name = service_key
    and profile.contract_version = p_contract_version
    and profile.profile_key = profile_key_value;

  audit_action := case when profile_id is null then 'create' else 'update' end;

  if p_is_active then
    for deactivated in
      select profile.id, to_jsonb(profile) as before_state
      from public.recommendation_weight_profiles profile
      where profile.service_name = service_key
        and profile.contract_version = p_contract_version
        and profile.is_active
        and (profile_id is null or profile.id <> profile_id)
      for update
    loop
      update public.recommendation_weight_profiles profile
      set is_active = false
      where profile.id = deactivated.id
      returning to_jsonb(profile) into after_value;

      insert into public.recommendation_configuration_audit (
        actor_id, entity_type, entity_id, action, before_state, after_state
      ) values (
        auth.uid(), 'weight_profile', deactivated.id, 'deactivate',
        deactivated.before_state, after_value
      );
      perform public.write_audit_log('recommendation.weights.deactivate', deactivated.id, 'recommendation_weight_profile');
    end loop;
  end if;

  insert into public.recommendation_weight_profiles (
    service_name, contract_version, profile_key, weights, is_active, created_by
  ) values (
    service_key, p_contract_version, profile_key_value, p_weights, p_is_active, auth.uid()
  )
  on conflict (service_name, contract_version, profile_key) do update set
    weights = excluded.weights,
    is_active = excluded.is_active,
    created_by = excluded.created_by
  returning id, to_jsonb(recommendation_weight_profiles.*)
  into profile_id, after_value;

  insert into public.recommendation_configuration_audit (
    actor_id, entity_type, entity_id, action, before_state, after_state
  ) values (
    auth.uid(), 'weight_profile', profile_id,
    case
      when audit_action = 'update' and coalesce((before_value ->> 'is_active')::boolean, false) <> p_is_active
        then case when p_is_active then 'activate' else 'deactivate' end
      else audit_action
    end,
    before_value, after_value
  );

  perform public.write_audit_log('recommendation.weights.upsert', profile_id, 'recommendation_weight_profile');
  return profile_id;
end;
$$;

revoke all on function public.admin_upsert_recommendation_taxonomy_node(text, text, text, uuid, jsonb, boolean) from public, anon;
revoke all on function public.admin_upsert_recommendation_weight_profile(text, integer, text, jsonb, boolean) from public, anon;
grant execute on function public.admin_upsert_recommendation_taxonomy_node(text, text, text, uuid, jsonb, boolean) to authenticated;
grant execute on function public.admin_upsert_recommendation_weight_profile(text, integer, text, jsonb, boolean) to authenticated;

create or replace function public.recommendation_foundation_health()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'projection_version', 1,
    'counts_are_estimates', true,
    'projected_public_listings', coalesce((
      select greatest(relation.reltuples, 0)::bigint
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'listing_recommendation_features'
    ), 0),
    'active_taxonomy_nodes', (select count(*) from public.recommendation_taxonomy_nodes where is_active),
    'active_relationships', (
      select count(*)
      from public.recommendation_relationships
      where is_active
        and valid_from <= now()
        and (valid_until is null or valid_until > now())
    ),
    'active_weight_profiles', (select count(*) from public.recommendation_weight_profiles where is_active),
    'expired_cache_present', exists (
      select 1 from public.recommendation_cache where expires_at <= now() limit 1
    ),
    'expired_events_present', exists (
      select 1 from public.recommendation_events where expires_at <= now() limit 1
    ),
    'oldest_unexpired_event_at', (
      select occurred_at
      from public.recommendation_events
      where expires_at > now()
      order by occurred_at
      limit 1
    ),
    'generated_at', now()
  );
$$;

revoke all on function public.recommendation_foundation_health() from public, anon, authenticated;
grant execute on function public.recommendation_foundation_health() to service_role;

update public.marketplace_operational_controls
set
  state = 'phase_1_integrity_hardened',
  configuration = configuration || '{"schema_version":56,"default_partition_migration":true,"audited_weight_activation":true,"bounded_health":true}'::jsonb,
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.ensure_recommendation_event_partition(date)
  is 'Creates a monthly partition without losing late rows already routed to the default partition.';
