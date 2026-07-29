-- 0052_recommendation_taxonomy_weights_and_admin.sql
-- Audited administration, deterministic ranking profiles and initial taxonomy.

create table if not exists public.recommendation_weight_profiles (
  id uuid primary key default gen_random_uuid(),
  service_name text not null check (service_name in (
    'similar-listings-service',
    'seller-recommendations-service',
    'related-services-service',
    'related-products-service',
    'nearby-service',
    'recently-listed-service',
    'personalized-recommendation-service'
  )),
  contract_version integer not null default 1 check (contract_version > 0),
  profile_key text not null,
  weights jsonb not null check (jsonb_typeof(weights) = 'object'),
  is_active boolean not null default false,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_name, contract_version, profile_key)
);

create unique index if not exists idx_recommendation_weight_profiles_one_active
  on public.recommendation_weight_profiles(service_name, contract_version)
  where is_active;
create index if not exists idx_recommendation_weight_profiles_lookup
  on public.recommendation_weight_profiles(service_name, contract_version, is_active, profile_key);

create table if not exists public.recommendation_configuration_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references public.users(id),
  entity_type text not null check (entity_type in ('taxonomy_node', 'relationship', 'weight_profile')),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'activate', 'deactivate')),
  before_state jsonb,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_recommendation_configuration_audit_entity
  on public.recommendation_configuration_audit(entity_type, entity_id, created_at desc, id desc);
create index if not exists idx_recommendation_configuration_audit_actor
  on public.recommendation_configuration_audit(actor_id, created_at desc, id desc)
  where actor_id is not null;

alter table public.recommendation_weight_profiles enable row level security;
alter table public.recommendation_configuration_audit enable row level security;

revoke all on table public.recommendation_weight_profiles from anon, authenticated;
revoke all on table public.recommendation_configuration_audit from anon, authenticated;

create or replace function public.validate_recommendation_weight_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  weight_entry record;
  total_weight numeric := 0;
begin
  if jsonb_typeof(new.weights) <> 'object' or new.weights = '{}'::jsonb then
    raise exception 'recommendation weights must be a non-empty JSON object'
      using errcode = '22023';
  end if;

  for weight_entry in
    select key, value from jsonb_each(new.weights)
  loop
    if weight_entry.key !~ '^[a-z][a-z0-9_]{1,63}$'
      or jsonb_typeof(weight_entry.value) <> 'number'
    then
      raise exception 'recommendation weight keys and values are invalid'
        using errcode = '22023';
    end if;

    if (weight_entry.value #>> '{}')::numeric < 0
      or (weight_entry.value #>> '{}')::numeric > 1
    then
      raise exception 'recommendation weights must be between zero and one'
        using errcode = '22023';
    end if;

    total_weight := total_weight + (weight_entry.value #>> '{}')::numeric;
  end loop;

  if abs(total_weight - 1) > 0.000001 then
    raise exception 'recommendation weights must total one'
      using errcode = '22023';
  end if;

  new.profile_key := public.normalize_recommendation_key(new.profile_key);
  if new.profile_key is null then
    raise exception 'weight profile key is required' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_recommendation_weight_profile() from public, anon, authenticated;

drop trigger if exists trg_recommendation_weight_profiles_validate on public.recommendation_weight_profiles;
create trigger trg_recommendation_weight_profiles_validate
  before insert or update on public.recommendation_weight_profiles
  for each row execute function public.validate_recommendation_weight_profile();

drop trigger if exists trg_recommendation_taxonomy_nodes_updated_at on public.recommendation_taxonomy_nodes;
create trigger trg_recommendation_taxonomy_nodes_updated_at
  before update on public.recommendation_taxonomy_nodes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_recommendation_relationships_updated_at on public.recommendation_relationships;
create trigger trg_recommendation_relationships_updated_at
  before update on public.recommendation_relationships
  for each row execute function public.set_updated_at();

drop trigger if exists trg_recommendation_weight_profiles_updated_at on public.recommendation_weight_profiles;
create trigger trg_recommendation_weight_profiles_updated_at
  before update on public.recommendation_weight_profiles
  for each row execute function public.set_updated_at();

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
    node_type,
    stable_key,
    parent_id,
    label,
    attributes,
    is_active
  ) values (
    normalized_type,
    normalized_key,
    p_parent_id,
    trim(p_label),
    coalesce(p_attributes, '{}'::jsonb),
    p_is_active
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
    auth.uid(),
    'taxonomy_node',
    node_id,
    case
      when audit_action = 'update' and coalesce((before_value ->> 'is_active')::boolean, false) <> p_is_active
        then case when p_is_active then 'activate' else 'deactivate' end
      else audit_action
    end,
    before_value,
    after_value
  );

  perform public.write_audit_log('recommendation.taxonomy.upsert', node_id, 'recommendation_taxonomy_node');
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
    source_node_id,
    target_node_id,
    relationship_type,
    weight,
    reason_code,
    is_active,
    valid_from,
    valid_until
  ) values (
    p_source_node_id,
    p_target_node_id,
    relationship_kind,
    p_weight,
    reason,
    p_is_active,
    p_valid_from,
    p_valid_until
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
    auth.uid(),
    'relationship',
    relationship_id,
    case
      when audit_action = 'update' and coalesce((before_value ->> 'is_active')::boolean, false) <> p_is_active
        then case when p_is_active then 'activate' else 'deactivate' end
      else audit_action
    end,
    before_value,
    after_value
  );

  perform public.write_audit_log('recommendation.relationship.upsert', relationship_id, 'recommendation_relationship');
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
    update public.recommendation_weight_profiles
    set is_active = false
    where service_name = service_key
      and contract_version = p_contract_version
      and is_active
      and (profile_id is null or id <> profile_id);
  end if;

  insert into public.recommendation_weight_profiles (
    service_name,
    contract_version,
    profile_key,
    weights,
    is_active,
    created_by
  ) values (
    service_key,
    p_contract_version,
    profile_key_value,
    p_weights,
    p_is_active,
    auth.uid()
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
    auth.uid(),
    'weight_profile',
    profile_id,
    case
      when audit_action = 'update' and coalesce((before_value ->> 'is_active')::boolean, false) <> p_is_active
        then case when p_is_active then 'activate' else 'deactivate' end
      else audit_action
    end,
    before_value,
    after_value
  );

  perform public.write_audit_log('recommendation.weights.upsert', profile_id, 'recommendation_weight_profile');
  return profile_id;
end;
$$;

create or replace function public.admin_recommendation_configuration_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'taxonomy_nodes', coalesce((
      select jsonb_agg(to_jsonb(node) order by node.node_type, node.stable_key)
      from public.recommendation_taxonomy_nodes node
    ), '[]'::jsonb),
    'relationships', coalesce((
      select jsonb_agg(to_jsonb(relationship) order by relationship.source_node_id, relationship.relationship_type, relationship.target_node_id)
      from public.recommendation_relationships relationship
    ), '[]'::jsonb),
    'weight_profiles', coalesce((
      select jsonb_agg(to_jsonb(profile) order by profile.service_name, profile.contract_version, profile.profile_key)
      from public.recommendation_weight_profiles profile
    ), '[]'::jsonb),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.admin_upsert_recommendation_taxonomy_node(text, text, text, uuid, jsonb, boolean) from public, anon;
revoke all on function public.admin_upsert_recommendation_relationship(uuid, uuid, text, numeric, text, boolean, timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_upsert_recommendation_weight_profile(text, integer, text, jsonb, boolean) from public, anon;
revoke all on function public.admin_recommendation_configuration_snapshot() from public, anon;
grant execute on function public.admin_upsert_recommendation_taxonomy_node(text, text, text, uuid, jsonb, boolean) to authenticated;
grant execute on function public.admin_upsert_recommendation_relationship(uuid, uuid, text, numeric, text, boolean, timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_upsert_recommendation_weight_profile(text, integer, text, jsonb, boolean) to authenticated;
grant execute on function public.admin_recommendation_configuration_snapshot() to authenticated;

insert into public.recommendation_taxonomy_nodes (node_type, stable_key, label, attributes)
values
  ('category', 'car', 'Vehicles', '{"listing_kind":"car"}'::jsonb),
  ('category', 'property', 'Property', '{"listing_kind":"property"}'::jsonb),
  ('category', 'machinery', 'Heavy vehicles and machinery', '{"listing_kind":"machinery"}'::jsonb),
  ('category', 'service', 'Services', '{"listing_kind":"service"}'::jsonb),
  ('service', 'vehicle-inspection', 'Vehicle inspection', '{"domain":"car"}'::jsonb),
  ('service', 'vehicle-repair', 'Vehicle repair', '{"domain":"car"}'::jsonb),
  ('service', 'vehicle-insurance', 'Vehicle insurance', '{"domain":"car"}'::jsonb),
  ('service', 'property-inspection', 'Property inspection', '{"domain":"property"}'::jsonb),
  ('service', 'property-conveyancing', 'Property conveyancing', '{"domain":"property"}'::jsonb),
  ('service', 'moving-services', 'Moving services', '{"domain":"property"}'::jsonb),
  ('service', 'machinery-transport', 'Machinery transport', '{"domain":"machinery"}'::jsonb),
  ('service', 'machinery-repair', 'Machinery repair', '{"domain":"machinery"}'::jsonb),
  ('service', 'operator-hire', 'Operator hire', '{"domain":"machinery"}'::jsonb),
  ('product', 'vehicle-tyres', 'Vehicle tyres', '{"domain":"car"}'::jsonb),
  ('product', 'vehicle-battery', 'Vehicle battery', '{"domain":"car"}'::jsonb),
  ('product', 'machinery-filters', 'Machinery filters', '{"domain":"machinery"}'::jsonb),
  ('product', 'safety-equipment', 'Safety equipment', '{"domain":"machinery"}'::jsonb)
on conflict (node_type, stable_key) do update set
  label = excluded.label,
  attributes = excluded.attributes,
  is_active = true;

with node as (
  select id, stable_key from public.recommendation_taxonomy_nodes where is_active
), relationship_seed as (
  select * from (values
    ('car', 'vehicle-inspection', 'complements', 1.00::numeric, 'CATEGORY_RELATED_SERVICE'),
    ('car', 'vehicle-repair', 'complements', 0.95::numeric, 'CATEGORY_RELATED_SERVICE'),
    ('car', 'vehicle-insurance', 'complements', 0.85::numeric, 'CATEGORY_RELATED_SERVICE'),
    ('car', 'vehicle-tyres', 'accessory', 0.80::numeric, 'CATEGORY_RELATED_PRODUCT'),
    ('car', 'vehicle-battery', 'accessory', 0.75::numeric, 'CATEGORY_RELATED_PRODUCT'),
    ('property', 'property-inspection', 'complements', 1.00::numeric, 'CATEGORY_RELATED_SERVICE'),
    ('property', 'property-conveyancing', 'complements', 0.95::numeric, 'CATEGORY_RELATED_SERVICE'),
    ('property', 'moving-services', 'complements', 0.75::numeric, 'CATEGORY_RELATED_SERVICE'),
    ('machinery', 'machinery-transport', 'complements', 1.00::numeric, 'CATEGORY_RELATED_SERVICE'),
    ('machinery', 'machinery-repair', 'complements', 0.95::numeric, 'CATEGORY_RELATED_SERVICE'),
    ('machinery', 'operator-hire', 'complements', 0.85::numeric, 'CATEGORY_RELATED_SERVICE'),
    ('machinery', 'machinery-filters', 'accessory', 0.80::numeric, 'CATEGORY_RELATED_PRODUCT'),
    ('machinery', 'safety-equipment', 'accessory', 0.75::numeric, 'CATEGORY_RELATED_PRODUCT')
  ) as seed(source_key, target_key, relationship_type, weight, reason_code)
)
insert into public.recommendation_relationships (
  source_node_id,
  target_node_id,
  relationship_type,
  weight,
  reason_code,
  is_active
)
select source.id, target.id, seed.relationship_type, seed.weight, seed.reason_code, true
from relationship_seed seed
join node source on source.stable_key = seed.source_key
join node target on target.stable_key = seed.target_key
on conflict (source_node_id, target_node_id, relationship_type) do update set
  weight = excluded.weight,
  reason_code = excluded.reason_code,
  is_active = true,
  valid_from = now(),
  valid_until = null;

insert into public.recommendation_weight_profiles (
  service_name, contract_version, profile_key, weights, is_active
)
values
  ('similar-listings-service', 1, 'organic-v1', '{"category":0.25,"subcategory":0.15,"specifications":0.20,"price_band":0.12,"location":0.08,"quality":0.08,"freshness":0.07,"popularity":0.05}'::jsonb, true),
  ('seller-recommendations-service', 1, 'organic-v1', '{"seller_match":0.45,"quality":0.20,"freshness":0.15,"popularity":0.10,"category_diversity":0.10}'::jsonb, true),
  ('related-services-service', 1, 'organic-v1', '{"relationship":0.45,"location":0.15,"quality":0.20,"freshness":0.10,"popularity":0.10}'::jsonb, true),
  ('related-products-service', 1, 'organic-v1', '{"relationship":0.50,"specifications":0.20,"location":0.10,"quality":0.10,"freshness":0.05,"popularity":0.05}'::jsonb, true),
  ('nearby-service', 1, 'organic-v1', '{"distance":0.55,"category":0.15,"quality":0.10,"freshness":0.10,"popularity":0.10}'::jsonb, true),
  ('recently-listed-service', 1, 'organic-v1', '{"freshness":0.70,"quality":0.15,"location":0.10,"popularity":0.05}'::jsonb, true),
  ('personalized-recommendation-service', 1, 'organic-v1', '{"category_affinity":0.25,"specification_affinity":0.20,"location_affinity":0.15,"price_affinity":0.15,"quality":0.10,"freshness":0.10,"popularity":0.05}'::jsonb, true)
on conflict (service_name, contract_version, profile_key) do update set
  weights = excluded.weights,
  is_active = true;

comment on table public.recommendation_weight_profiles
  is 'Versioned deterministic organic ranking configuration. Paid placement is not represented here.';
comment on table public.recommendation_configuration_audit
  is 'Immutable before/after history for recommendation taxonomy, relationship and weight changes.';
