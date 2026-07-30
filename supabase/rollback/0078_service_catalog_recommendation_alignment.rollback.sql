-- Roll back migration 0078 by deactivating the added catalog relationships and
-- nodes. Historical recommendation attribution remains intact.

with relationship_values(source_key, target_key) as (
  values
    ('property', 'property-management'),
    ('property', 'custom-build-renovation'),
    ('property', 'general-contracting'),
    ('property', 'architectural-design'),
    ('property', 'structural-engineering'),
    ('property', 'quantity-surveying'),
    ('property', 'plumbing'),
    ('property', 'electrical-installation'),
    ('property', 'painting-finishing'),
    ('property', 'roofing'),
    ('property', 'land-surveying'),
    ('property', 'site-assessment'),
    ('car', 'pre-purchase-inspection'),
    ('car', 'maintenance-repair'),
    ('car', 'roadside-assistance'),
    ('car', 'customization-mods'),
    ('machinery', 'machinery-repair'),
    ('machinery', 'machinery-transport'),
    ('machinery', 'operator-hire'),
    ('machinery', 'plant-hire'),
    ('machinery', 'civil-works')
), resolved as (
  select relationship.id
  from relationship_values value
  join public.recommendation_taxonomy_nodes source
    on source.node_type = 'category'
   and source.stable_key = value.source_key
  join public.recommendation_taxonomy_nodes target
    on target.node_type = 'service'
   and target.stable_key = value.target_key
  join public.recommendation_relationships relationship
    on relationship.source_node_id = source.id
   and relationship.target_node_id = target.id
   and relationship.relationship_type = 'complements'
)
update public.recommendation_relationships relationship
set
  is_active = false,
  valid_until = greatest(now(), relationship.valid_from + interval '1 millisecond'),
  updated_at = now()
from resolved
where relationship.id = resolved.id;

update public.recommendation_taxonomy_nodes
set is_active = false, updated_at = now()
where node_type = 'service'
  and stable_key in (
    'property-management',
    'custom-build-renovation',
    'general-contracting',
    'architectural-design',
    'structural-engineering',
    'quantity-surveying',
    'plumbing',
    'electrical-installation',
    'painting-finishing',
    'roofing',
    'land-surveying',
    'site-assessment',
    'pre-purchase-inspection',
    'maintenance-repair',
    'roadside-assistance',
    'customization-mods',
    'plant-hire',
    'civil-works'
  )
  and attributes ->> 'catalog_source' = 'service_form_v1';

update public.marketplace_operational_controls
set
  state = 'phase_7_executable_service_recommendations',
  configuration = configuration - 'service_catalog' - 'related_services_keys_aligned',
  updated_at = now()
where control_key = 'recommendation_foundation';
