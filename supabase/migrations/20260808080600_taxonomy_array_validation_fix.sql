-- 20260808080600_taxonomy_array_validation_fix.sql
-- Corrects the pure array validators introduced by the taxonomy metadata
-- integrity migration. The original definitions omitted the unnest source.

begin;

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

commit;
