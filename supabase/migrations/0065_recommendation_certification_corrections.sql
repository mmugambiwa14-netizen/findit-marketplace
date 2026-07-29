-- 0065_recommendation_certification_corrections.sql
-- Corrects certification-discovered audit integration and anonymous event visibility.

revoke select on table public.recommendation_events from anon;

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
    or jsonb_typeof(coalesce(p_attributes, '{}'::jsonb)) <> 'object'
    or octet_length(coalesce(p_attributes, '{}'::jsonb)::text) > 8192
  then
    raise exception 'invalid recommendation taxonomy node' using errcode = '22023';
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

  audit_action := case when node_id is null then 'create' else 'update' end;

  insert into public.recommendation_taxonomy_nodes (
    node_type, stable_key, parent_id, label, attributes, is_active
  ) values (
    normalized_type, normalized_key, p_parent_id, trim(p_label),
    coalesce(p_attributes, '{}'::jsonb), p_is_active
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

  return node_id;
end;
$$;

create or replace function public.admin_upsert_recommendation_relationship(
  p_source_node_id uuid,
  p_target_node_id uuid,
  p_relationship_type text,
  p_weight numeric,
  p_reason_code text,
  p_is_active boolean default true,
  p_valid_from timestamptz default now(),
  p_valid_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  relationship_kind text := lower(trim(coalesce(p_relationship_type, '')));
  reason text := upper(trim(coalesce(p_reason_code, '')));
  relationship_id uuid;
  before_value jsonb;
  after_value jsonb;
  audit_action text;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_source_node_id is null
    or p_target_node_id is null
    or p_source_node_id = p_target_node_id
    or relationship_kind not in ('similar', 'complements', 'requires', 'nearby', 'alternative', 'accessory')
    or p_weight < 0
    or p_weight > 100
    or reason !~ '^[A-Z0-9_]{3,64}$'
    or p_valid_from is null
    or (p_valid_until is not null and p_valid_until <= p_valid_from)
    or not exists (select 1 from public.recommendation_taxonomy_nodes where id = p_source_node_id)
    or not exists (select 1 from public.recommendation_taxonomy_nodes where id = p_target_node_id)
  then
    raise exception 'invalid recommendation relationship' using errcode = '22023';
  end if;

  select relationship.id, to_jsonb(relationship)
  into relationship_id, before_value
  from public.recommendation_relationships relationship
  where relationship.source_node_id = p_source_node_id
    and relationship.target_node_id = p_target_node_id
    and relationship.relationship_type = relationship_kind;

  audit_action := case when relationship_id is null then 'create' else 'update' end;

  insert into public.recommendation_relationships (
    source_node_id, target_node_id, relationship_type, weight,
    reason_code, is_active, valid_from, valid_until
  ) values (
    p_source_node_id, p_target_node_id, relationship_kind, p_weight,
    reason, p_is_active, p_valid_from, p_valid_until
  )
  on conflict (source_node_id, target_node_id, relationship_type) do update set
    weight = excluded.weight,
    reason_code = excluded.reason_code,
    is_active = excluded.is_active,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until
  returning id, to_jsonb(recommendation_relationships.*)
  into relationship_id, after_value;

  insert into public.recommendation_configuration_audit (
    actor_id, entity_type, entity_id, action, before_state, after_state
  ) values (
    auth.uid(), 'relationship', relationship_id,
    case
      when audit_action = 'update' and coalesce((before_value ->> 'is_active')::boolean, false) <> p_is_active
        then case when p_is_active then 'activate' else 'deactivate' end
      else audit_action
    end,
    before_value, after_value
  );

  return relationship_id;
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
  displaced_profile record;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if service_key not in (
    'similar-listings-service',
    'seller-recommendations-service',
    'related-services-service',
    'related-products-service',
    'nearby-service',
    'recently-listed-service',
    'personalized-recommendation-service'
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
    for displaced_profile in
      update public.recommendation_weight_profiles
      set is_active = false
      where service_name = service_key
        and contract_version = p_contract_version
        and is_active
        and (profile_id is null or id <> profile_id)
      returning id, to_jsonb(recommendation_weight_profiles.*) as prior_state
    loop
      insert into public.recommendation_configuration_audit (
        actor_id, entity_type, entity_id, action, before_state, after_state
      ) values (
        auth.uid(), 'weight_profile', displaced_profile.id, 'deactivate',
        displaced_profile.prior_state,
        jsonb_set(displaced_profile.prior_state, '{is_active}', 'false'::jsonb)
      );
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

  return profile_id;
end;
$$;

revoke all on function public.admin_upsert_recommendation_taxonomy_node(text, text, text, uuid, jsonb, boolean) from public, anon;
revoke all on function public.admin_upsert_recommendation_relationship(uuid, uuid, text, numeric, text, boolean, timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_upsert_recommendation_weight_profile(text, integer, text, jsonb, boolean) from public, anon;
grant execute on function public.admin_upsert_recommendation_taxonomy_node(text, text, text, uuid, jsonb, boolean) to authenticated;
grant execute on function public.admin_upsert_recommendation_relationship(uuid, uuid, text, numeric, text, boolean, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_upsert_recommendation_weight_profile(text, integer, text, jsonb, boolean) to authenticated;

update public.marketplace_operational_controls
set
  state = 'phase_3_contextual_ecosystem_certification_corrected',
  configuration = configuration || jsonb_build_object(
    'schema_version', 65,
    'anonymous_raw_event_select', false,
    'recommendation_admin_audit_contract', 'recommendation_configuration_audit'
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';