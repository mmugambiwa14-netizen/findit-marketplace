-- 20260808080500_taxonomy_metadata_integrity.sql
-- Adds market/localization metadata and collision guardrails to the canonical
-- taxonomy registry. Empty market_availability means globally available; a
-- non-empty array limits exposure to those ISO 3166-1 alpha-2 country codes.

begin;

alter table public.categories
  add column if not exists localized_labels jsonb not null default '{}'::jsonb,
  add column if not exists market_availability text[] not null default '{}'::text[];

create or replace function public.is_valid_taxonomy_aliases(p_values text[])
returns boolean
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select
    coalesce((
      select bool_and(value ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')
      from unnest(coalesce(p_values, '{}'::text[])) as values(value)
    ), true)
    and cardinality(coalesce(p_values, '{}'::text[])) = cardinality(array(
      select distinct value
      from unnest(coalesce(p_values, '{}'::text[])) as values(value)
    ));
$function$;

create or replace function public.is_valid_taxonomy_synonyms(p_values text[])
returns boolean
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select
    coalesce((
      select bool_and(length(trim(value)) between 1 and 80)
      from unnest(coalesce(p_values, '{}'::text[])) as values(value)
    ), true)
    and cardinality(coalesce(p_values, '{}'::text[])) = cardinality(array(
      select distinct lower(trim(value))
      from unnest(coalesce(p_values, '{}'::text[])) as values(value)
    ));
$function$;

create or replace function public.is_valid_taxonomy_markets(p_values text[])
returns boolean
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select
    coalesce((
      select bool_and(value ~ '^[A-Z]{2}$')
      from unnest(coalesce(p_values, '{}'::text[])) as values(value)
    ), true)
    and cardinality(coalesce(p_values, '{}'::text[])) = cardinality(array(
      select distinct value
      from unnest(coalesce(p_values, '{}'::text[])) as values(value)
    ));
$function$;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_aliases_valid'
  ) then
    alter table public.categories
      add constraint categories_aliases_valid
      check (public.is_valid_taxonomy_aliases(aliases));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_synonyms_valid'
  ) then
    alter table public.categories
      add constraint categories_synonyms_valid
      check (public.is_valid_taxonomy_synonyms(synonyms));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_localized_labels_object'
  ) then
    alter table public.categories
      add constraint categories_localized_labels_object
      check (jsonb_typeof(localized_labels) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_market_availability_valid'
  ) then
    alter table public.categories
      add constraint categories_market_availability_valid
      check (public.is_valid_taxonomy_markets(market_availability));
  end if;
end;
$constraints$;

-- One current navigation slug per marketplace family. Historical/superseded
-- rows can retain their stable identity without preventing a replacement from
-- taking over the canonical slug.
create unique index if not exists uq_categories_current_canonical_slug
  on public.categories(marketplace_kind, canonical_slug)
  where is_active and superseded_by is null and valid_to is null;

-- Explicit resolver with optional market scope. Stable slug and aliases remain
-- accepted for old links/imports while the canonical slug is used for current
-- navigation.
create or replace function public.resolve_category_taxonomy(
  p_marketplace_kind text,
  p_slug text,
  p_country_code text default null
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
      p_country_code is null
      or cardinality(c.market_availability) = 0
      or upper(p_country_code) = any(c.market_availability)
    )
    and (
      c.slug = p_slug
      or c.canonical_slug = p_slug
      or p_slug = any(c.aliases)
    )
  order by (c.canonical_slug = p_slug) desc, (c.slug = p_slug) desc
  limit 1;
$function$;

revoke all on function public.resolve_category_taxonomy(text, text, text) from public;
grant execute on function public.resolve_category_taxonomy(text, text, text) to anon, authenticated;

-- Keep the two-argument compatibility signature while new callers may scope by
-- market. It delegates to the canonical implementation rather than duplicating
-- resolution logic.
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
  select * from public.resolve_category_taxonomy(p_marketplace_kind, p_slug, null);
$function$;

revoke all on function public.resolve_category_taxonomy(text, text) from public;
grant execute on function public.resolve_category_taxonomy(text, text) to anon, authenticated;

-- Public taxonomy also accepts an optional market scope. Existing one-argument
-- callers retain their contract through a delegating compatibility function.
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
      c.id,
      c.slug,
      c.canonical_slug,
      c.parent_id,
      c.marketplace_kind,
      c.display_label,
      c.localized_labels,
      c.description,
      c.sort_order,
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
      0 as depth,
      array[c.canonical_slug]::text[] as path_slugs,
      array[c.display_label]::text[] as path_labels
    from public.categories c
    where c.parent_id is null
      and c.is_active
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
      child.id,
      child.slug,
      child.canonical_slug,
      child.parent_id,
      child.marketplace_kind,
      child.display_label,
      child.localized_labels,
      child.description,
      child.sort_order,
      child.node_type,
      child.is_postable,
      child.aliases,
      child.synonyms,
      child.market_availability,
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

commit;
