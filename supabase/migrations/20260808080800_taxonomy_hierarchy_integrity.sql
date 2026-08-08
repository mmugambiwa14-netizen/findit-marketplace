-- 20260808080800_taxonomy_hierarchy_integrity.sql
-- Cross-row integrity for arbitrary-depth taxonomy trees. Child nodes may not
-- escape a parent market scope, switch marketplace family, or sit under a facet.

begin;

create or replace function public.is_valid_localized_taxonomy_labels(p_labels jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select jsonb_typeof(coalesce(p_labels, '{}'::jsonb)) = 'object'
     and not exists (
       select 1
       from jsonb_each(coalesce(p_labels, '{}'::jsonb)) entry(locale, label)
       where locale !~ '^[a-z]{2,3}(?:-[A-Z]{2})?$'
          or jsonb_typeof(label) <> 'string'
          or length(trim(label #>> '{}')) not between 2 and 80
     );
$function$;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_localized_labels_valid'
  ) then
    alter table public.categories
      add constraint categories_localized_labels_valid
      check (public.is_valid_localized_taxonomy_labels(localized_labels));
  end if;
end;
$constraints$;

create or replace function public.enforce_taxonomy_hierarchy_integrity()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  parent_row public.categories%rowtype;
begin
  if new.parent_id is null then
    if new.node_type <> 'group' or new.is_postable then
      raise exception 'marketplace roots must be non-postable group nodes'
        using errcode = '22023';
    end if;
  else
    select * into parent_row
    from public.categories
    where id = new.parent_id;

    if not found then
      raise exception 'taxonomy parent does not exist' using errcode = '23503';
    end if;
    if parent_row.marketplace_kind <> new.marketplace_kind then
      raise exception 'taxonomy child must remain in its parent marketplace'
        using errcode = '22023';
    end if;
    if parent_row.node_type = 'facet' then
      raise exception 'facet nodes cannot contain taxonomy children'
        using errcode = '22023';
    end if;
    if cardinality(parent_row.market_availability) > 0 and (
      cardinality(new.market_availability) = 0
      or exists (
        select 1
        from unnest(new.market_availability) child_market(code)
        where not child_market.code = any(parent_row.market_availability)
      )
    ) then
      raise exception 'taxonomy child market scope cannot exceed its parent'
        using errcode = '22023';
    end if;
  end if;

  -- A parent cannot be narrowed beneath any existing direct child. This keeps
  -- edits atomic: admins must narrow descendants first, then the parent.
  if tg_op = 'UPDATE'
     and new.market_availability is distinct from old.market_availability
     and cardinality(new.market_availability) > 0
     and exists (
       select 1
       from public.categories child
       where child.parent_id = new.id
         and (
           cardinality(child.market_availability) = 0
           or exists (
             select 1
             from unnest(child.market_availability) child_market(code)
             where not child_market.code = any(new.market_availability)
           )
         )
     ) then
    raise exception 'taxonomy parent market scope would exclude an existing child'
      using errcode = '22023';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_categories_hierarchy_integrity on public.categories;
create trigger trg_categories_hierarchy_integrity
  before insert or update of parent_id, marketplace_kind, node_type, is_postable, market_availability
  on public.categories
  for each row execute function public.enforce_taxonomy_hierarchy_integrity();

commit;
