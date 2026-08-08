-- 20260808080000_canonical_taxonomy_foundation.sql
--
-- Evolves the existing categories table into the canonical listing-taxonomy
-- registry without rewriting historical listing/category identifiers.
--
-- Design rules:
--   * `slug` remains the immutable stable key already referenced by listings.
--   * `canonical_slug` is the current public/navigation slug and may evolve.
--   * tree depth no longer determines whether a node can receive listings.
--   * lifecycle/alias/supersession metadata lets taxonomy evolve safely.
--   * `schema_binding` bridges legacy mixed-axis leaves to the versioned
--     listingSchema registry while existing records remain untouched.
--   * arbitrary-depth taxonomy reads are exposed through one recursive RPC.

begin;

alter table public.categories
  add column if not exists canonical_slug text,
  add column if not exists node_type text not null default 'category',
  add column if not exists is_postable boolean not null default true,
  add column if not exists aliases text[] not null default '{}'::text[],
  add column if not exists synonyms text[] not null default '{}'::text[],
  add column if not exists superseded_by uuid references public.categories(id) on delete restrict,
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz,
  add column if not exists schema_binding jsonb not null default '{}'::jsonb,
  add column if not exists taxonomy_version integer not null default 1;

update public.categories
set canonical_slug = coalesce(canonical_slug, slug),
    valid_from = coalesce(valid_from, created_at);

alter table public.categories
  alter column canonical_slug set not null,
  alter column valid_from set not null;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_canonical_slug_shape'
  ) then
    alter table public.categories
      add constraint categories_canonical_slug_shape
      check (canonical_slug ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_node_type_valid'
  ) then
    alter table public.categories
      add constraint categories_node_type_valid
      check (node_type in ('group', 'category', 'facet'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_postability_matches_node_type'
  ) then
    alter table public.categories
      add constraint categories_postability_matches_node_type
      check (not is_postable or node_type = 'category');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_supersession_not_self'
  ) then
    alter table public.categories
      add constraint categories_supersession_not_self
      check (superseded_by is null or superseded_by <> id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_validity_window'
  ) then
    alter table public.categories
      add constraint categories_validity_window
      check (valid_to is null or valid_to > valid_from);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_schema_binding_object'
  ) then
    alter table public.categories
      add constraint categories_schema_binding_object
      check (jsonb_typeof(schema_binding) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_taxonomy_version_positive'
  ) then
    alter table public.categories
      add constraint categories_taxonomy_version_positive
      check (taxonomy_version >= 1);
  end if;
end;
$constraints$;

create index if not exists idx_categories_canonical_slug
  on public.categories(marketplace_kind, canonical_slug);
create index if not exists idx_categories_postable_tree
  on public.categories(marketplace_kind, parent_id, sort_order, display_label)
  where is_active and is_postable;
create index if not exists idx_categories_superseded_by
  on public.categories(superseded_by)
  where superseded_by is not null;

-- Roots are navigation groups, never listing destinations. Existing leaves
-- remain postable until explicitly superseded so this migration is additive.
update public.categories
set node_type = 'group',
    is_postable = false,
    schema_binding = jsonb_build_object('schema', marketplace_kind)
where parent_id is null;

update public.categories
set node_type = 'category',
    is_postable = true,
    schema_binding = case
      when schema_binding = '{}'::jsonb then jsonb_build_object('schema', marketplace_kind)
      else schema_binding
    end
where parent_id is not null;

-- Bridge the current mixed property vocabulary into independent dimensions.
-- These bindings do not rewrite historical category slugs; they describe what
-- each legacy leaf means so posting/search can migrate without data loss.
update public.categories
set schema_binding = jsonb_build_object(
  'schema', 'property', 'subtype', 'residential',
  'defaults', jsonb_build_object('property_type', 'house', 'offer_type', 'sale')
)
where marketplace_kind = 'property' and slug = 'house_sale';

update public.categories
set schema_binding = jsonb_build_object(
  'schema', 'property', 'subtype', 'residential',
  'defaults', jsonb_build_object('property_type', 'house', 'offer_type', 'rent')
)
where marketplace_kind = 'property' and slug = 'house_rent';

update public.categories
set schema_binding = jsonb_build_object(
  'schema', 'property', 'subtype', 'residential',
  'defaults', jsonb_build_object('property_type', 'apartment', 'offer_type', 'sale')
)
where marketplace_kind = 'property' and slug = 'apartment_sale';

update public.categories
set schema_binding = jsonb_build_object(
  'schema', 'property', 'subtype', 'residential',
  'defaults', jsonb_build_object('property_type', 'apartment', 'offer_type', 'rent')
)
where marketplace_kind = 'property' and slug = 'apartment_rent';

with property_types(slug, property_type, subtype) as (
  values
    ('townhouse', 'townhouse', 'residential'),
    ('duplex', 'duplex', 'residential'),
    ('cottage', 'cottage', 'residential'),
    ('cluster', 'cluster_home', 'residential'),
    ('bachelor', 'bachelor', 'residential'),
    ('penthouse', 'penthouse', 'residential'),
    ('studio_apartment', 'studio', 'residential'),
    ('granny_flat', 'granny_flat', 'residential'),
    ('office', 'office', 'commercial'),
    ('retail', 'retail', 'commercial'),
    ('warehouse', 'warehouse', 'industrial'),
    ('factory', 'factory', 'industrial'),
    ('workshop', 'workshop', 'industrial'),
    ('showroom', 'showroom', 'commercial'),
    ('farm', 'farm', 'agricultural'),
    ('agricultural', 'agricultural_land', 'agricultural'),
    ('game_farm', 'farm', 'agricultural'),
    ('smallholding', 'smallholding', 'agricultural'),
    ('commercial_plot', 'commercial_plot', 'land'),
    ('residential_stand', 'stand', 'land'),
    ('mining_claims', 'mining_claim', 'land')
)
update public.categories c
set schema_binding = jsonb_build_object(
  'schema', 'property',
  'subtype', property_types.subtype,
  'defaults', jsonb_build_object('property_type', property_types.property_type)
)
from property_types
where c.marketplace_kind = 'property' and c.slug = property_types.slug;

with land_regimes(slug, property_type, regime) as (
  values
    ('a1_farm', 'farm', 'a1'),
    ('a2_farm', 'farm', 'a2'),
    ('resettlement_farm', 'farm', 'resettlement'),
    ('communal_land', 'agricultural_land', 'communal'),
    ('old_commercial_farm', 'farm', 'legacy_commercial')
)
update public.categories c
set schema_binding = jsonb_build_object(
  'schema', 'property', 'subtype', 'agricultural',
  'defaults', jsonb_build_object('property_type', land_regimes.property_type, 'land_regime', land_regimes.regime)
)
from land_regimes
where c.marketplace_kind = 'property' and c.slug = land_regimes.slug;

update public.categories
set schema_binding = jsonb_build_object(
  'schema', 'property', 'subtype', 'land',
  'defaults', jsonb_build_object('property_type', 'stand', 'land_state', jsonb_build_array('surveyed'))
)
where marketplace_kind = 'property' and slug = 'surveyed_stands';

update public.categories
set schema_binding = jsonb_build_object(
  'schema', 'property', 'subtype', 'agricultural',
  'defaults', jsonb_build_object('property_type', 'agricultural_land', 'infrastructure', jsonb_build_array('irrigated'))
)
where marketplace_kind = 'property' and slug = 'irrigation_land';

-- Vehicle leaves describe entity families; transaction/segment data is kept in
-- defaults/tags instead of being treated as a different physical asset type.
with vehicle_bindings(slug, subtype, extra) as (
  values
    ('cars_sale', 'car', '{"offer_type":"sale"}'::jsonb),
    ('cars_rent', 'car', '{"offer_type":"rent"}'::jsonb),
    ('minibus_kombi', 'van', '{"body_type":"minibus"}'::jsonb),
    ('motorbike', 'motorcycle', '{}'::jsonb),
    ('scooter', 'motorcycle', '{"vehicle_style":"scooter"}'::jsonb),
    ('bicycle', 'bicycle', '{}'::jsonb),
    ('caravan_trailer', 'trailer', '{"vehicle_style":"caravan_or_trailer"}'::jsonb),
    ('utility', 'bakkie', '{"body_type":"bakkie"}'::jsonb),
    ('van', 'van', '{"body_type":"panel_van"}'::jsonb),
    ('luxury_classic', 'car', '{"segments":["luxury","classic"]}'::jsonb),
    ('spare_parts', 'parts', '{}'::jsonb),
    ('tyres_rims', 'parts', '{"parts_family":"tyres_wheels"}'::jsonb),
    ('truck_lorry', 'truck', '{}'::jsonb),
    ('bus_coach', 'bus', '{}'::jsonb),
    ('car_other', 'other', '{}'::jsonb)
)
update public.categories c
set schema_binding = jsonb_build_object('schema', 'car', 'subtype', vehicle_bindings.subtype, 'defaults', vehicle_bindings.extra)
from vehicle_bindings
where c.marketplace_kind = 'car' and c.slug = vehicle_bindings.slug;

-- Machinery category leaves are currently application/industry axes. Preserve
-- that meaning explicitly so equipment type can evolve independently.
with machinery_bindings(slug, application, machinery_type) as (
  values
    ('heavy_vehicles', 'haulage', null::text),
    ('construction', 'construction', null::text),
    ('agricultural', 'agriculture', null::text),
    ('mining', 'mining', null::text),
    ('material_handling', 'material_handling', null::text),
    ('generators', 'power', 'generator'),
    ('compaction', 'construction', 'compactor'),
    ('lifting', 'lifting', null::text),
    ('surface_prep', 'surface_preparation', null::text),
    ('welding', 'fabrication', null::text),
    ('boats', 'marine', null::text),
    ('machinery_other', 'other', null::text)
)
update public.categories c
set schema_binding = jsonb_build_object(
  'schema', 'machinery',
  'defaults', jsonb_strip_nulls(jsonb_build_object(
    'applications', jsonb_build_array(machinery_bindings.application),
    'machinery_type', machinery_bindings.machinery_type
  ))
)
from machinery_bindings
where c.marketplace_kind = 'machinery' and c.slug = machinery_bindings.slug;

update public.categories
set schema_binding = jsonb_build_object(
  'schema', 'service', 'subtype', slug,
  'defaults', jsonb_build_object('service_domain', slug)
)
where marketplace_kind = 'service' and parent_id is not null;

-- Recursive public read contract. It deliberately returns inactive/superseded
-- nodes only to admins through the underlying RLS policy; ordinary clients see
-- the active current tree. Any depth is supported.
create or replace function public.public_category_taxonomy(
  p_marketplace_kind text default null
)
returns table (
  category_id uuid,
  stable_slug text,
  canonical_slug text,
  parent_id uuid,
  marketplace_kind text,
  display_label text,
  description text,
  sort_order integer,
  node_type text,
  is_postable boolean,
  aliases text[],
  synonyms text[],
  superseded_by uuid,
  valid_from timestamptz,
  valid_to timestamptz,
  schema_binding jsonb,
  taxonomy_version integer,
  depth integer,
  path_slugs text[],
  path_labels text[]
)
language sql
stable
set search_path to ''
as $function$
  with recursive tree as (
    select
      c.id,
      c.slug,
      c.canonical_slug,
      c.parent_id,
      c.marketplace_kind,
      c.display_label,
      c.description,
      c.sort_order,
      c.node_type,
      c.is_postable,
      c.aliases,
      c.synonyms,
      c.superseded_by,
      c.valid_from,
      c.valid_to,
      c.schema_binding,
      c.taxonomy_version,
      0 as depth,
      array[c.canonical_slug]::text[] as path_slugs,
      array[c.display_label]::text[] as path_labels
    from public.categories c
    where c.parent_id is null
      and c.is_active
      and c.valid_from <= now()
      and (c.valid_to is null or c.valid_to > now())
      and (p_marketplace_kind is null or c.marketplace_kind = p_marketplace_kind)

    union all

    select
      child.id,
      child.slug,
      child.canonical_slug,
      child.parent_id,
      child.marketplace_kind,
      child.display_label,
      child.description,
      child.sort_order,
      child.node_type,
      child.is_postable,
      child.aliases,
      child.synonyms,
      child.superseded_by,
      child.valid_from,
      child.valid_to,
      child.schema_binding,
      child.taxonomy_version,
      parent.depth + 1,
      parent.path_slugs || child.canonical_slug,
      parent.path_labels || child.display_label
    from public.categories child
    join tree parent on parent.id = child.parent_id
    where child.is_active
      and child.valid_from <= now()
      and (child.valid_to is null or child.valid_to > now())
  )
  select
    tree.id,
    tree.slug,
    tree.canonical_slug,
    tree.parent_id,
    tree.marketplace_kind,
    tree.display_label,
    tree.description,
    tree.sort_order,
    tree.node_type,
    tree.is_postable,
    tree.aliases,
    tree.synonyms,
    tree.superseded_by,
    tree.valid_from,
    tree.valid_to,
    tree.schema_binding,
    tree.taxonomy_version,
    tree.depth,
    tree.path_slugs,
    tree.path_labels
  from tree
  order by tree.path_labels, tree.sort_order, tree.display_label;
$function$;

revoke all on function public.public_category_taxonomy(text) from public;
grant execute on function public.public_category_taxonomy(text) to anon, authenticated;

-- Alias/canonical resolver used by links/imports. Search synonyms are not used
-- as identifiers; only stable/canonical slugs and explicit aliases resolve.
create or replace function public.resolve_category_taxonomy(
  p_marketplace_kind text,
  p_slug text
)
returns table (
  category_id uuid,
  stable_slug text,
  canonical_slug text,
  is_postable boolean,
  superseded_by uuid,
  schema_binding jsonb
)
language sql
stable
set search_path to ''
as $function$
  select
    c.id,
    c.slug,
    c.canonical_slug,
    c.is_postable,
    c.superseded_by,
    c.schema_binding
  from public.categories c
  where c.marketplace_kind = p_marketplace_kind
    and c.is_active
    and c.valid_from <= now()
    and (c.valid_to is null or c.valid_to > now())
    and (
      c.slug = p_slug
      or c.canonical_slug = p_slug
      or p_slug = any(c.aliases)
    )
  order by (c.canonical_slug = p_slug) desc, (c.slug = p_slug) desc
  limit 1;
$function$;

revoke all on function public.resolve_category_taxonomy(text, text) from public;
grant execute on function public.resolve_category_taxonomy(text, text) to anon, authenticated;

-- Postability is explicit. Tree depth is not an authorization rule anymore.
create or replace function public.enforce_listing_taxonomy_category()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE'
     and new.kind is not distinct from old.kind
     and new.category is not distinct from old.category then
    return new;
  end if;

  if not exists (
    select 1
    from public.categories c
    where c.marketplace_kind = new.kind::text
      and c.slug = new.category
      and c.is_active
      and c.is_postable
      and c.node_type = 'category'
      and c.superseded_by is null
      and c.valid_from <= now()
      and (c.valid_to is null or c.valid_to > now())
  ) then
    raise exception 'listing category is not an active postable taxonomy node'
      using errcode = '22023';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_listings_taxonomy_category on public.listings;
create trigger trg_listings_taxonomy_category
  before insert or update of kind, category on public.listings
  for each row execute function public.enforce_listing_taxonomy_category();

-- Admin read model with arbitrary depth and taxonomy lifecycle metadata.
create or replace function public.admin_taxonomy_rows()
returns table (
  category_id uuid,
  stable_slug text,
  canonical_slug text,
  parent_id uuid,
  parent_slug text,
  marketplace_kind text,
  display_label text,
  description text,
  sort_order integer,
  is_active boolean,
  is_protected boolean,
  node_type text,
  is_postable boolean,
  aliases text[],
  synonyms text[],
  superseded_by uuid,
  valid_from timestamptz,
  valid_to timestamptz,
  schema_binding jsonb,
  taxonomy_version integer,
  depth integer,
  path_labels text[],
  listing_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  return query
  with recursive tree as (
    select c.id, c.parent_id, 0 as depth, array[c.display_label]::text[] as path_labels
    from public.categories c
    where c.parent_id is null
    union all
    select c.id, c.parent_id, tree.depth + 1, tree.path_labels || c.display_label
    from public.categories c
    join tree on tree.id = c.parent_id
  )
  select
    c.id,
    c.slug,
    c.canonical_slug,
    c.parent_id,
    parent.slug,
    c.marketplace_kind,
    c.display_label,
    c.description,
    c.sort_order,
    c.is_active,
    c.is_protected,
    c.node_type,
    c.is_postable,
    c.aliases,
    c.synonyms,
    c.superseded_by,
    c.valid_from,
    c.valid_to,
    c.schema_binding,
    c.taxonomy_version,
    tree.depth,
    tree.path_labels,
    case
      when c.marketplace_kind = 'service' then
        (select count(*) from public.services s where s.category::text = c.slug)
      else
        (select count(*) from public.listings l where l.kind::text = c.marketplace_kind and l.category = c.slug)
    end
  from public.categories c
  join tree on tree.id = c.id
  left join public.categories parent on parent.id = c.parent_id
  order by tree.path_labels, c.sort_order, c.display_label;
end;
$function$;

revoke all on function public.admin_taxonomy_rows() from public;
grant execute on function public.admin_taxonomy_rows() to authenticated;

create or replace function public.admin_add_taxonomy_node(
  p_parent_id uuid,
  p_slug text,
  p_canonical_slug text,
  p_display_label text,
  p_node_type text,
  p_is_postable boolean,
  p_sort_order integer,
  p_schema_binding jsonb default '{}'::jsonb,
  p_aliases text[] default '{}'::text[],
  p_synonyms text[] default '{}'::text[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  parent_row public.categories%rowtype;
  inserted_row public.categories%rowtype;
begin
  if p_slug !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
     or p_canonical_slug !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
     or length(trim(p_display_label)) not between 2 and 80
     or p_node_type not in ('group', 'category', 'facet')
     or (p_is_postable and p_node_type <> 'category')
     or p_sort_order not between 0 and 10000
     or jsonb_typeof(coalesce(p_schema_binding, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid taxonomy node values' using errcode = '22023';
  end if;

  select * into parent_row
  from public.categories
  where id = p_parent_id and is_active and node_type <> 'facet'
  for update;
  if not found then
    raise exception 'active parent taxonomy node not found' using errcode = 'P0002';
  end if;

  insert into public.categories (
    slug, canonical_slug, parent_id, marketplace_kind, display_label,
    sort_order, node_type, is_postable, aliases, synonyms, schema_binding,
    valid_from
  ) values (
    p_slug, p_canonical_slug, parent_row.id, parent_row.marketplace_kind,
    trim(p_display_label), p_sort_order, p_node_type, p_is_postable,
    coalesce(p_aliases, '{}'::text[]), coalesce(p_synonyms, '{}'::text[]),
    coalesce(p_schema_binding, '{}'::jsonb), now()
  ) returning * into inserted_row;

  perform public.record_admin_action(
    'taxonomy.node_created', inserted_row.id::text, 'taxonomy', normalized_reason,
    null, to_jsonb(inserted_row)
  );
  return to_jsonb(inserted_row);
end;
$function$;

revoke all on function public.admin_add_taxonomy_node(uuid, text, text, text, text, boolean, integer, jsonb, text[], text[], text) from public;
grant execute on function public.admin_add_taxonomy_node(uuid, text, text, text, text, boolean, integer, jsonb, text[], text[], text) to authenticated;

create or replace function public.admin_update_taxonomy_node(
  p_category_id uuid,
  p_canonical_slug text,
  p_display_label text,
  p_sort_order integer,
  p_is_active boolean,
  p_is_postable boolean,
  p_aliases text[],
  p_synonyms text[],
  p_superseded_by uuid,
  p_valid_to timestamptz,
  p_schema_binding jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  before_row public.categories%rowtype;
  after_row public.categories%rowtype;
begin
  if p_canonical_slug !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
     or length(trim(p_display_label)) not between 2 and 80
     or p_sort_order not between 0 and 10000
     or jsonb_typeof(coalesce(p_schema_binding, '{}'::jsonb)) <> 'object' then
    raise exception 'invalid taxonomy node values' using errcode = '22023';
  end if;

  select * into before_row
  from public.categories
  where id = p_category_id
  for update;
  if not found then
    raise exception 'taxonomy node not found' using errcode = 'P0002';
  end if;

  if before_row.is_protected and not p_is_active then
    raise exception 'protected marketplace roots cannot be deactivated' using errcode = '42501';
  end if;
  if p_is_postable and before_row.node_type <> 'category' then
    raise exception 'only category nodes can be postable' using errcode = '22023';
  end if;
  if p_superseded_by = p_category_id then
    raise exception 'taxonomy node cannot supersede itself' using errcode = '22023';
  end if;
  if p_superseded_by is not null and not exists (
    select 1 from public.categories replacement
    where replacement.id = p_superseded_by
      and replacement.marketplace_kind = before_row.marketplace_kind
      and replacement.node_type = 'category'
      and replacement.is_active
  ) then
    raise exception 'replacement taxonomy node is invalid' using errcode = '22023';
  end if;

  update public.categories
  set canonical_slug = p_canonical_slug,
      display_label = trim(p_display_label),
      sort_order = p_sort_order,
      is_active = p_is_active,
      is_postable = case when p_superseded_by is null then p_is_postable else false end,
      aliases = coalesce(p_aliases, '{}'::text[]),
      synonyms = coalesce(p_synonyms, '{}'::text[]),
      superseded_by = p_superseded_by,
      valid_to = p_valid_to,
      schema_binding = coalesce(p_schema_binding, '{}'::jsonb),
      taxonomy_version = taxonomy_version + 1
  where id = p_category_id
  returning * into after_row;

  perform public.record_admin_action(
    'taxonomy.node_updated', p_category_id::text, 'taxonomy', normalized_reason,
    to_jsonb(before_row), to_jsonb(after_row)
  );
  return to_jsonb(after_row);
end;
$function$;

revoke all on function public.admin_update_taxonomy_node(uuid, text, text, integer, boolean, boolean, text[], text[], uuid, timestamptz, jsonb, text) from public;
grant execute on function public.admin_update_taxonomy_node(uuid, text, text, integer, boolean, boolean, text[], text[], uuid, timestamptz, jsonb, text) to authenticated;

commit;
