-- 20260808081100_service_specialization_taxonomy.sql
--
-- Moves the active V1 service specialization vocabulary out of client-side
-- constants and into the canonical taxonomy tree. Existing services.category
-- values remain unchanged: the four historical service-domain nodes become
-- non-postable groups, while their existing specialization slugs become
-- postable descendants. This preserves stored records while making posting,
-- search and admin consume one evolvable authority.

begin;

-- Existing service-domain values remain stable because services.category is a
-- legacy enum. They now describe the provider/service domain, not a postable
-- leaf in the taxonomy tree.
update public.categories
set node_type = 'group',
    is_postable = false,
    schema_binding = jsonb_build_object(
      'schema', 'service',
      'subtype', slug,
      'defaults', jsonb_build_object('service_domain', slug)
    ),
    taxonomy_version = taxonomy_version + 1
where marketplace_kind = 'service'
  and slug in ('property_developer', 'mechanic', 'construction', 'geological');

-- Construction is large enough to benefit from internal grouping. These are
-- navigation/grouping nodes only; the durable specialization keys remain the
-- existing service slugs below them.
with construction_parent as (
  select id
  from public.categories
  where marketplace_kind = 'service' and slug = 'construction'
), groups(slug, label, sort_order, description) as (
  values
    ('construction_design_professional', 'Design & Professional', 10, 'Architecture, engineering, surveying and project professional services.'),
    ('construction_delivery', 'Construction', 20, 'General building, civil works and site delivery.'),
    ('construction_trades', 'Trades', 30, 'Specialist building and finishing trades.'),
    ('construction_infrastructure', 'Property Infrastructure', 40, 'Power, water, fencing, paving and external property infrastructure.'),
    ('construction_plant_services', 'Plant & Machinery Services', 50, 'Plant hire, operators, machinery repair and machinery transport.')
)
insert into public.categories (
  slug, canonical_slug, parent_id, marketplace_kind, display_label, description,
  sort_order, node_type, is_postable, schema_binding, valid_from
)
select
  groups.slug,
  groups.slug,
  construction_parent.id,
  'service',
  groups.label,
  groups.description,
  groups.sort_order,
  'group',
  false,
  jsonb_build_object('schema', 'service', 'subtype', 'construction'),
  now()
from construction_parent cross join groups
on conflict (marketplace_kind, slug) do nothing;

-- Direct-domain specializations: Property Developer, Mechanic and Geological.
with specializations(parent_slug, slug, label, sort_order, synonyms) as (
  values
    ('property_developer', 'new_developments', 'New Development Listings & Marketing', 10, array['new development marketing','development listings']::text[]),
    ('property_developer', 'property_management', 'Property Management Services', 20, array['property management']::text[]),
    ('property_developer', 'consultation_advisory', 'Consultation & Advisory', 30, array['property advisory','developer consultation']::text[]),
    ('property_developer', 'custom_build_renovation', 'Custom Build & Renovation', 40, array['custom build','renovation']::text[]),

    ('mechanic', 'pre_purchase_inspection', 'Pre-Purchase Inspections', 10, array['vehicle inspection','pre purchase check']::text[]),
    ('mechanic', 'maintenance_repair', 'Maintenance & Repair', 20, array['vehicle repair','vehicle maintenance']::text[]),
    ('mechanic', 'customization_mods', 'Customization & Modifications', 30, array['vehicle modifications','customisation']::text[]),
    ('mechanic', 'roadside_assistance', 'Roadside Assistance', 40, array['mobile mechanic','breakdown assistance']::text[]),

    ('geological', 'land_surveying', 'Land Surveying & Mapping', 10, array['land survey','surveying']::text[]),
    ('geological', 'topographical_survey', 'Topographical Surveys', 20, array['topographic survey']::text[]),
    ('geological', 'geotechnical_investigation', 'Geotechnical Investigation', 30, array['geotechnical survey']::text[]),
    ('geological', 'soil_testing', 'Soil Testing & Analysis', 40, array['soil analysis']::text[]),
    ('geological', 'site_assessment', 'Site Assessment & Suitability', 50, array['site suitability']::text[]),
    ('geological', 'mineral_exploration', 'Mineral Exploration & Prospecting', 60, array['prospecting','mineral exploration']::text[]),
    ('geological', 'mining_consultancy', 'Mining Consultancy', 70, array['mining consulting']::text[]),
    ('geological', 'hydrogeology', 'Hydrogeology & Groundwater', 80, array['groundwater','hydrogeology']::text[]),
    ('geological', 'borehole_siting', 'Borehole Siting & Water Surveys', 90, array['borehole siting','water survey']::text[]),
    ('geological', 'geophysical_survey', 'Geophysical Surveys', 100, array['geophysical survey']::text[]),
    ('geological', 'environmental_impact', 'Environmental Impact Assessment', 110, array['environmental impact assessment','eia']::text[]),
    ('geological', 'rock_aggregate_testing', 'Rock & Aggregate Testing', 120, array['aggregate testing','rock testing']::text[]),
    ('geological', 'cadastral_survey', 'Cadastral & Boundary Surveys', 130, array['boundary survey','cadastral survey']::text[]),
    ('geological', 'gis_mapping', 'GIS & Remote Sensing', 140, array['gis','remote sensing']::text[]),
    ('geological', 'geological_consultancy', 'General Geological Consultancy', 150, array['geological consulting']::text[])
), parents as (
  select id, slug
  from public.categories
  where marketplace_kind = 'service'
    and slug in ('property_developer', 'mechanic', 'geological')
)
insert into public.categories (
  slug, canonical_slug, parent_id, marketplace_kind, display_label,
  sort_order, node_type, is_postable, synonyms, schema_binding, valid_from
)
select
  specializations.slug,
  specializations.slug,
  parents.id,
  'service',
  specializations.label,
  specializations.sort_order,
  'category',
  true,
  specializations.synonyms,
  jsonb_build_object(
    'schema', 'service',
    'subtype', specializations.parent_slug,
    'defaults', jsonb_build_object(
      'service_domain', specializations.parent_slug,
      'service_specialization', specializations.slug
    )
  ),
  now()
from specializations
join parents on parents.slug = specializations.parent_slug
on conflict (marketplace_kind, slug) do nothing;

-- Construction specializations are attached beneath coherent groups while
-- retaining every current V1 specialization stable slug.
with specializations(group_slug, slug, label, sort_order, synonyms) as (
  values
    ('construction_design_professional', 'architectural_design', 'Architectural Design & Drawings', 10, array['architecture','architectural drawings']::text[]),
    ('construction_design_professional', 'structural_engineering', 'Structural Engineering', 20, array['structural engineer']::text[]),
    ('construction_design_professional', 'quantity_surveying', 'Quantity Surveying & Costing', 30, array['quantity surveyor','costing']::text[]),
    ('construction_design_professional', 'project_management', 'Construction Project Management', 40, array['construction project management']::text[]),

    ('construction_delivery', 'general_contracting', 'General Contracting & Building', 10, array['general contractor','building contractor']::text[]),
    ('construction_delivery', 'civil_works', 'Civil & Earthworks', 20, array['civil works','earthworks']::text[]),
    ('construction_delivery', 'demolition', 'Demolition & Site Clearance', 30, array['site clearing','demolition']::text[]),

    ('construction_trades', 'roofing', 'Roofing & Waterproofing', 10, array['roofing','waterproofing']::text[]),
    ('construction_trades', 'plumbing', 'Plumbing & Drainage', 20, array['plumber','drainage']::text[]),
    ('construction_trades', 'electrical_installation', 'Electrical Installation', 30, array['electrician','electrical']::text[]),
    ('construction_trades', 'painting_finishing', 'Painting & Finishing', 40, array['painting','finishing']::text[]),
    ('construction_trades', 'tiling_flooring', 'Tiling & Flooring', 50, array['tiling','flooring']::text[]),
    ('construction_trades', 'carpentry_joinery', 'Carpentry & Joinery', 60, array['carpentry','joinery']::text[]),
    ('construction_trades', 'welding_steelwork', 'Welding & Steelwork', 70, array['welding','steelwork']::text[]),
    ('construction_trades', 'hvac', 'HVAC & Air Conditioning', 80, array['air conditioning','hvac']::text[]),

    ('construction_infrastructure', 'borehole_drilling', 'Borehole Drilling & Pumps', 10, array['borehole drilling','water pumps']::text[]),
    ('construction_infrastructure', 'solar_installation', 'Solar & Backup Power Installation', 20, array['solar installation','backup power']::text[]),
    ('construction_infrastructure', 'fencing_walling', 'Fencing, Walling & Gates', 30, array['fencing','walling','gates']::text[]),
    ('construction_infrastructure', 'paving_landscaping', 'Paving & Landscaping', 40, array['paving','landscaping']::text[]),

    ('construction_plant_services', 'plant_hire', 'Plant & Equipment Hire', 10, array['plant hire','equipment hire']::text[]),
    ('construction_plant_services', 'machinery_repair', 'Machinery Maintenance & Repair', 20, array['machinery repair','equipment repair']::text[]),
    ('construction_plant_services', 'machinery_transport', 'Machinery Transport', 30, array['equipment transport','plant transport']::text[]),
    ('construction_plant_services', 'operator_hire', 'Equipment Operator Hire', 40, array['operator hire','machine operator']::text[])
), groups as (
  select id, slug
  from public.categories
  where marketplace_kind = 'service'
    and slug in (
      'construction_design_professional',
      'construction_delivery',
      'construction_trades',
      'construction_infrastructure',
      'construction_plant_services'
    )
)
insert into public.categories (
  slug, canonical_slug, parent_id, marketplace_kind, display_label,
  sort_order, node_type, is_postable, synonyms, schema_binding, valid_from
)
select
  specializations.slug,
  specializations.slug,
  groups.id,
  'service',
  specializations.label,
  specializations.sort_order,
  'category',
  true,
  specializations.synonyms,
  jsonb_build_object(
    'schema', 'service',
    'subtype', 'construction',
    'defaults', jsonb_build_object(
      'service_domain', 'construction',
      'service_specialization', specializations.slug
    )
  ),
  now()
from specializations
join groups on groups.slug = specializations.group_slug
on conflict (marketplace_kind, slug) do nothing;

-- Ensure every active service domain has at least one selectable specialization.
do $verify$
begin
  if exists (
    select 1
    from public.categories domain
    where domain.marketplace_kind = 'service'
      and domain.slug in ('property_developer', 'mechanic', 'construction', 'geological')
      and not exists (
        with recursive descendants as (
          select child.id, child.node_type, child.is_postable
          from public.categories child
          where child.parent_id = domain.id
          union all
          select child.id, child.node_type, child.is_postable
          from public.categories child
          join descendants parent on parent.id = child.parent_id
        )
        select 1 from descendants
        where node_type = 'category' and is_postable
      )
  ) then
    raise exception 'an active service domain has no postable specialization';
  end if;
end;
$verify$;

commit;
