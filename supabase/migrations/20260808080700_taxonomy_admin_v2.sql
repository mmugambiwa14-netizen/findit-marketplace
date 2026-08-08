-- 20260808080700_taxonomy_admin_v2.sql
-- Makes the canonical taxonomy lifecycle operational from admin tooling rather
-- than leaving aliases, localization, markets and supersession as migration-only
-- metadata.

begin;

-- A stable slug must resolve unambiguously inside one marketplace family even
-- after arbitrary hierarchy depth is introduced.
create unique index if not exists uq_categories_marketplace_stable_slug
  on public.categories(marketplace_kind, slug);

-- Current public taxonomy excludes superseded nodes. Old stable/canonical/alias
-- terms remain resolvable through resolve_category_taxonomy() for redirects and
-- historical records.
create or replace function public.public_category_taxonomy_v2(
  p_marketplace_kind text default null,
  p_country_code text default null
)
returns table (
  category_id uuid,
  stable_slug text,
  canonical_slug text,
  parent_id uuid,
  marketplace_kind text,
  display_label text,
  localized_labels jsonb,
  description text,
  sort_order integer,
  node_type text,
  is_postable boolean,
  aliases text[],
  synonyms text[],
  market_availability text[],
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
      c.id, c.slug, c.canonical_slug, c.parent_id, c.marketplace_kind,
      c.display_label, c.localized_labels, c.description, c.sort_order,
      c.node_type, c.is_postable, c.aliases, c.synonyms,
      c.market_availability, c.superseded_by, c.valid_from, c.valid_to,
      c.schema_binding, c.taxonomy_version,
      0 as depth,
      array[c.canonical_slug]::text[] as path_slugs,
      array[c.display_label]::text[] as path_labels
    from public.categories c
    where c.parent_id is null
      and c.is_active
      and c.superseded_by is null
      and c.valid_from <= now()
      and (c.valid_to is null or c.valid_to > now())
      and (p_marketplace_kind is null or c.marketplace_kind = p_marketplace_kind)
      and (
        p_country_code is null
        or cardinality(c.market_availability) = 0
        or upper(p_country_code) = any(c.market_availability)
      )

    union all

    select
      child.id, child.slug, child.canonical_slug, child.parent_id,
      child.marketplace_kind, child.display_label, child.localized_labels,
      child.description, child.sort_order, child.node_type, child.is_postable,
      child.aliases, child.synonyms, child.market_availability,
      child.superseded_by, child.valid_from, child.valid_to,
      child.schema_binding, child.taxonomy_version,
      parent.depth + 1,
      parent.path_slugs || child.canonical_slug,
      parent.path_labels || child.display_label
    from public.categories child
    join tree parent on parent.id = child.parent_id
    where child.is_active
      and child.superseded_by is null
      and child.valid_from <= now()
      and (child.valid_to is null or child.valid_to > now())
      and (
        p_country_code is null
        or cardinality(child.market_availability) = 0
        or upper(p_country_code) = any(child.market_availability)
      )
  )
  select * from tree
  order by path_labels, sort_order, display_label;
$function$;

revoke all on function public.public_category_taxonomy_v2(text, text) from public;
grant execute on function public.public_category_taxonomy_v2(text, text) to anon, authenticated;

create or replace function public.taxonomy_terms_collide(
  p_marketplace_kind text,
  p_exclude_id uuid,
  p_stable_slug text,
  p_canonical_slug text,
  p_aliases text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.categories c
    where c.marketplace_kind = p_marketplace_kind
      and (p_exclude_id is null or c.id <> p_exclude_id)
      and (
        c.slug = p_stable_slug
        or c.canonical_slug = p_stable_slug
        or p_stable_slug = any(c.aliases)
        or c.slug = p_canonical_slug
        or c.canonical_slug = p_canonical_slug
        or p_canonical_slug = any(c.aliases)
        or c.slug = any(coalesce(p_aliases, '{}'::text[]))
        or c.canonical_slug = any(coalesce(p_aliases, '{}'::text[]))
        or c.aliases && coalesce(p_aliases, '{}'::text[])
      )
  );
$function$;

revoke all on function public.taxonomy_terms_collide(text, uuid, text, text, text[]) from public;

create or replace function public.admin_taxonomy_rows_v2()
returns table (
  category_id uuid,
  stable_slug text,
  canonical_slug text,
  parent_id uuid,
  parent_slug text,
  marketplace_kind text,
  display_label text,
  localized_labels jsonb,
  description text,
  sort_order integer,
  is_active boolean,
  is_protected boolean,
  node_type text,
  is_postable boolean,
  aliases text[],
  synonyms text[],
  market_availability text[],
  superseded_by uuid,
  valid_from timestamptz,
  valid_to timestamptz,
  schema_binding jsonb,
  taxonomy_version integer,
  depth integer,
  path_labels text[],
  direct_listing_count bigint,
  descendant_listing_count bigint
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
    select
      c.id,
      0 as depth,
      array[c.display_label]::text[] as path_labels,
      array[c.id]::uuid[] as path_ids
    from public.categories c
    where c.parent_id is null

    union all

    select
      c.id,
      tree.depth + 1,
      tree.path_labels || c.display_label,
      tree.path_ids || c.id
    from public.categories c
    join tree on tree.id = c.parent_id
  ), listing_counts as (
    select l.kind::text as marketplace_kind, l.category as slug, count(*)::bigint as listing_count
    from public.listings l
    group by l.kind::text, l.category
  ), service_counts as (
    select 'service'::text as marketplace_kind, s.category::text as slug, count(*)::bigint as listing_count
    from public.services s
    group by s.category::text
  ), counts as (
    select * from listing_counts
    union all
    select * from service_counts
  )
  select
    c.id,
    c.slug,
    c.canonical_slug,
    c.parent_id,
    parent.slug,
    c.marketplace_kind,
    c.display_label,
    c.localized_labels,
    c.description,
    c.sort_order,
    c.is_active,
    c.is_protected,
    c.node_type,
    c.is_postable,
    c.aliases,
    c.synonyms,
    c.market_availability,
    c.superseded_by,
    c.valid_from,
    c.valid_to,
    c.schema_binding,
    c.taxonomy_version,
    tree.depth,
    tree.path_labels,
    coalesce(direct_count.listing_count, 0)::bigint,
    coalesce((
      select sum(coalesce(desc_count.listing_count, 0))::bigint
      from tree descendant
      join public.categories desc_node on desc_node.id = descendant.id
      left join counts desc_count
        on desc_count.marketplace_kind = desc_node.marketplace_kind
       and desc_count.slug = desc_node.slug
      where c.id = any(descendant.path_ids)
    ), 0)::bigint
  from public.categories c
  join tree on tree.id = c.id
  left join public.categories parent on parent.id = c.parent_id
  left join counts direct_count
    on direct_count.marketplace_kind = c.marketplace_kind
   and direct_count.slug = c.slug
  order by tree.path_labels, c.sort_order, c.display_label;
end;
$function$;

revoke all on function public.admin_taxonomy_rows_v2() from public, anon;
grant execute on function public.admin_taxonomy_rows_v2() to authenticated;

create or replace function public.admin_add_taxonomy_node_v2(
  p_parent_id uuid,
  p_slug text,
  p_canonical_slug text,
  p_display_label text,
  p_description text,
  p_node_type text,
  p_is_postable boolean,
  p_sort_order integer,
  p_schema_binding jsonb default '{}'::jsonb,
  p_aliases text[] default '{}'::text[],
  p_synonyms text[] default '{}'::text[],
  p_localized_labels jsonb default '{}'::jsonb,
  p_market_availability text[] default '{}'::text[],
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
  normalized_slug text := lower(trim(coalesce(p_slug, '')));
  normalized_canonical text := lower(trim(coalesce(p_canonical_slug, '')));
  normalized_aliases text[] := coalesce(p_aliases, '{}'::text[]);
  normalized_synonyms text[] := coalesce(p_synonyms, '{}'::text[]);
  normalized_markets text[] := coalesce(p_market_availability, '{}'::text[]);
begin
  if normalized_slug !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
     or normalized_canonical !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
     or length(trim(coalesce(p_display_label, ''))) not between 2 and 80
     or length(coalesce(p_description, '')) > 1000
     or p_node_type not in ('group', 'category', 'facet')
     or (p_is_postable and p_node_type <> 'category')
     or p_sort_order not between 0 and 10000
     or jsonb_typeof(coalesce(p_schema_binding, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_localized_labels, '{}'::jsonb)) <> 'object'
     or not public.is_valid_taxonomy_aliases(normalized_aliases)
     or not public.is_valid_taxonomy_synonyms(normalized_synonyms)
     or not public.is_valid_taxonomy_markets(normalized_markets)
  then
    raise exception 'invalid taxonomy node values' using errcode = '22023';
  end if;

  select * into parent_row
  from public.categories
  where id = p_parent_id
    and is_active
    and superseded_by is null
    and node_type <> 'facet'
  for update;
  if not found then
    raise exception 'active parent taxonomy node not found' using errcode = 'P0002';
  end if;

  if cardinality(parent_row.market_availability) > 0
     and exists (
       select 1
       from unnest(normalized_markets) market(code)
       where not code = any(parent_row.market_availability)
     ) then
    raise exception 'child market availability must fit within its parent' using errcode = '22023';
  end if;

  if public.taxonomy_terms_collide(
    parent_row.marketplace_kind,
    null,
    normalized_slug,
    normalized_canonical,
    normalized_aliases
  ) then
    raise exception 'taxonomy slug or alias already exists in this marketplace' using errcode = '23505';
  end if;

  insert into public.categories (
    slug, canonical_slug, parent_id, marketplace_kind, display_label,
    localized_labels, description, sort_order, node_type, is_postable,
    aliases, synonyms, market_availability, schema_binding, valid_from
  ) values (
    normalized_slug, normalized_canonical, parent_row.id,
    parent_row.marketplace_kind, trim(p_display_label),
    coalesce(p_localized_labels, '{}'::jsonb), nullif(trim(coalesce(p_description, '')), ''),
    p_sort_order, p_node_type, p_is_postable,
    normalized_aliases, normalized_synonyms, normalized_markets,
    coalesce(p_schema_binding, '{}'::jsonb), now()
  ) returning * into inserted_row;

  perform public.record_admin_action(
    'taxonomy.node_created', inserted_row.id::text, 'taxonomy', normalized_reason,
    null, to_jsonb(inserted_row)
  );
  return to_jsonb(inserted_row);
end;
$function$;

revoke all on function public.admin_add_taxonomy_node_v2(uuid, text, text, text, text, text, boolean, integer, jsonb, text[], text[], jsonb, text[], text)
  from public, anon;
grant execute on function public.admin_add_taxonomy_node_v2(uuid, text, text, text, text, text, boolean, integer, jsonb, text[], text[], jsonb, text[], text)
  to authenticated;

create or replace function public.admin_update_taxonomy_node_v2(
  p_category_id uuid,
  p_canonical_slug text,
  p_display_label text,
  p_description text,
  p_sort_order integer,
  p_is_active boolean,
  p_is_postable boolean,
  p_aliases text[],
  p_synonyms text[],
  p_localized_labels jsonb,
  p_market_availability text[],
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
  parent_row public.categories%rowtype;
  replacement_row public.categories%rowtype;
  after_row public.categories%rowtype;
  normalized_canonical text := lower(trim(coalesce(p_canonical_slug, '')));
  normalized_aliases text[] := coalesce(p_aliases, '{}'::text[]);
  normalized_synonyms text[] := coalesce(p_synonyms, '{}'::text[]);
  normalized_markets text[] := coalesce(p_market_availability, '{}'::text[]);
begin
  if normalized_canonical !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
     or length(trim(coalesce(p_display_label, ''))) not between 2 and 80
     or length(coalesce(p_description, '')) > 1000
     or p_sort_order not between 0 and 10000
     or jsonb_typeof(coalesce(p_schema_binding, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_localized_labels, '{}'::jsonb)) <> 'object'
     or not public.is_valid_taxonomy_aliases(normalized_aliases)
     or not public.is_valid_taxonomy_synonyms(normalized_synonyms)
     or not public.is_valid_taxonomy_markets(normalized_markets)
  then
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

  if before_row.parent_id is not null then
    select * into parent_row from public.categories where id = before_row.parent_id;
    if cardinality(parent_row.market_availability) > 0
       and exists (
         select 1
         from unnest(normalized_markets) market(code)
         where not code = any(parent_row.market_availability)
       ) then
      raise exception 'node market availability must fit within its parent' using errcode = '22023';
    end if;
  end if;

  if public.taxonomy_terms_collide(
    before_row.marketplace_kind,
    p_category_id,
    before_row.slug,
    normalized_canonical,
    normalized_aliases
  ) then
    raise exception 'taxonomy canonical slug or alias already exists in this marketplace' using errcode = '23505';
  end if;

  if p_superseded_by is not null then
    select * into replacement_row
    from public.categories replacement
    where replacement.id = p_superseded_by
      and replacement.marketplace_kind = before_row.marketplace_kind
      and replacement.node_type = 'category'
      and replacement.is_active
      and replacement.superseded_by is null;
    if not found then
      raise exception 'replacement taxonomy node is invalid' using errcode = '22023';
    end if;
  end if;

  update public.categories
  set canonical_slug = normalized_canonical,
      display_label = trim(p_display_label),
      localized_labels = coalesce(p_localized_labels, '{}'::jsonb),
      description = nullif(trim(coalesce(p_description, '')), ''),
      sort_order = p_sort_order,
      is_active = p_is_active,
      is_postable = case when p_superseded_by is null then p_is_postable else false end,
      aliases = normalized_aliases,
      synonyms = normalized_synonyms,
      market_availability = normalized_markets,
      superseded_by = p_superseded_by,
      valid_to = p_valid_to,
      schema_binding = coalesce(p_schema_binding, '{}'::jsonb),
      taxonomy_version = taxonomy_version + 1
  where id = p_category_id
  returning * into after_row;

  perform public.record_admin_action(
    case when p_superseded_by is null then 'taxonomy.node_updated' else 'taxonomy.node_superseded' end,
    p_category_id::text,
    'taxonomy',
    normalized_reason,
    to_jsonb(before_row),
    to_jsonb(after_row)
  );
  return to_jsonb(after_row);
end;
$function$;

revoke all on function public.admin_update_taxonomy_node_v2(uuid, text, text, text, integer, boolean, boolean, text[], text[], jsonb, text[], uuid, timestamptz, jsonb, text)
  from public, anon;
grant execute on function public.admin_update_taxonomy_node_v2(uuid, text, text, text, integer, boolean, boolean, text[], text[], jsonb, text[], uuid, timestamptz, jsonb, text)
  to authenticated;

commit;
