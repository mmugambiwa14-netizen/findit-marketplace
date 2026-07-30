-- 0078_service_catalog_recommendation_alignment.sql
-- Align the executable related-services taxonomy with the keys emitted by the
-- customer-facing service creation form. The former taxonomy used conceptual
-- labels (for example vehicle-repair) that no valid service listing could emit.

with service_nodes(stable_key, label) as (
  values
    ('property-management', 'Property management'),
    ('custom-build-renovation', 'Custom build and renovation'),
    ('general-contracting', 'General contracting and building'),
    ('architectural-design', 'Architectural design'),
    ('structural-engineering', 'Structural engineering'),
    ('quantity-surveying', 'Quantity surveying'),
    ('plumbing', 'Plumbing and drainage'),
    ('electrical-installation', 'Electrical installation'),
    ('painting-finishing', 'Painting and finishing'),
    ('roofing', 'Roofing and waterproofing'),
    ('land-surveying', 'Land surveying and mapping'),
    ('site-assessment', 'Site assessment and suitability'),
    ('pre-purchase-inspection', 'Pre-purchase vehicle inspection'),
    ('maintenance-repair', 'Vehicle maintenance and repair'),
    ('roadside-assistance', 'Roadside assistance'),
    ('customization-mods', 'Vehicle customization and modifications'),
    ('plant-hire', 'Plant and equipment hire'),
    ('civil-works', 'Civil works and earthworks')
)
insert into public.recommendation_taxonomy_nodes (
  node_type,
  stable_key,
  label,
  attributes,
  is_active
)
select
  'service',
  stable_key,
  label,
  jsonb_build_object('catalog_source', 'service_form_v1', 'schema_version', 78),
  true
from service_nodes
on conflict (node_type, stable_key) do update set
  label = excluded.label,
  attributes = public.recommendation_taxonomy_nodes.attributes || excluded.attributes,
  is_active = true,
  updated_at = now();

with relationship_values(source_key, target_key, weight) as (
  values
    ('property', 'property-management', 1.00::numeric),
    ('property', 'custom-build-renovation', 0.98::numeric),
    ('property', 'general-contracting', 0.95::numeric),
    ('property', 'architectural-design', 0.90::numeric),
    ('property', 'structural-engineering', 0.88::numeric),
    ('property', 'quantity-surveying', 0.86::numeric),
    ('property', 'plumbing', 0.84::numeric),
    ('property', 'electrical-installation', 0.84::numeric),
    ('property', 'painting-finishing', 0.78::numeric),
    ('property', 'roofing', 0.82::numeric),
    ('property', 'land-surveying', 0.92::numeric),
    ('property', 'site-assessment', 0.90::numeric),
    ('car', 'pre-purchase-inspection', 1.00::numeric),
    ('car', 'maintenance-repair', 0.98::numeric),
    ('car', 'roadside-assistance', 0.88::numeric),
    ('car', 'customization-mods', 0.70::numeric),
    ('machinery', 'machinery-repair', 1.00::numeric),
    ('machinery', 'machinery-transport', 0.98::numeric),
    ('machinery', 'operator-hire', 0.92::numeric),
    ('machinery', 'plant-hire', 0.84::numeric),
    ('machinery', 'civil-works', 0.70::numeric)
), resolved as (
  select
    source.id as source_node_id,
    target.id as target_node_id,
    value.weight
  from relationship_values value
  join public.recommendation_taxonomy_nodes source
    on source.node_type = 'category'
   and source.stable_key = value.source_key
  join public.recommendation_taxonomy_nodes target
    on target.node_type = 'service'
   and target.stable_key = value.target_key
)
insert into public.recommendation_relationships (
  source_node_id,
  target_node_id,
  relationship_type,
  weight,
  reason_code,
  is_active,
  valid_from,
  valid_until
)
select
  source_node_id,
  target_node_id,
  'complements',
  weight,
  'CATEGORY_RELATED_SERVICE',
  true,
  now(),
  null
from resolved
on conflict (source_node_id, target_node_id, relationship_type) do update set
  weight = excluded.weight,
  reason_code = excluded.reason_code,
  is_active = true,
  valid_from = least(public.recommendation_relationships.valid_from, excluded.valid_from),
  valid_until = null,
  updated_at = now();

-- Cached empty responses created before the catalog alignment must not survive
-- the correction.
delete from public.recommendation_cache
where service_name = 'related_services_service';

insert into public.marketplace_operational_controls (
  control_key,
  enabled,
  state,
  configuration
)
values (
  'recommendation_foundation',
  true,
  'service_catalog_aligned',
  '{"schema_version":78,"service_catalog":"v1","related_services_keys_aligned":true}'::jsonb
)
on conflict (control_key) do update set
  enabled = excluded.enabled,
  state = excluded.state,
  configuration = public.marketplace_operational_controls.configuration || excluded.configuration,
  updated_at = now();
