-- Roll back migration 0078 without removing the legacy conceptual service nodes.

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
)
delete from public.recommendation_relationships relationship
using relationship_values value,
      public.recommendation_taxonomy_nodes source,
      public.recommendation_taxonomy_nodes target
where source.node_type = 'category'
  and source.stable_key = value.source_key
  and target.node_type = 'service'
  and target.stable_key = value.target_key
  and relationship.source_node_id = source.id
  and relationship.target_node_id = target.id
  and relationship.relationship_type = 'complements';

delete from public.recommendation_taxonomy_nodes
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

delete from public.recommendation_cache
where service_name = 'related_services_service';

update public.marketplace_operational_controls
set
  state = 'phase_7_executable_service_recommendations',
  configuration = configuration - 'service_catalog' - 'related_services_keys_aligned',
  updated_at = now()
where control_key = 'recommendation_foundation';
