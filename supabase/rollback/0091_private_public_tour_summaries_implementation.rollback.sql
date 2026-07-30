-- Roll back migration 0091 by removing the public SECURITY INVOKER wrapper
-- and moving the canonical Tour-summary SECURITY DEFINER implementation back
-- to public with its original search path and execution grants.

begin;

do $rollback$
declare
  public_wrapper_count integer;
  private_implementation_count integer;
  restored_count integer;
begin
  select count(*)::integer into public_wrapper_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'public_tour_summaries'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
    and pg_get_function_result(function_record.oid) = 'TABLE(tour_id uuid, parent_type text, parent_id uuid, duration_seconds numeric, published_at timestamp with time zone)'
    and function_language.lanname = 'sql'
    and not function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.public_tour_summaries(p_listing_ids, p_service_ids)' in function_record.prosrc) > 0;

  if public_wrapper_count <> 1 then
    raise exception '0091 rollback expected one public Tour-summary wrapper, found %', public_wrapper_count;
  end if;

  select count(*)::integer into private_implementation_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'private'
    and function_record.proname = 'public_tour_summaries'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
    and pg_get_function_result(function_record.oid) = 'TABLE(tour_id uuid, parent_type text, parent_id uuid, duration_seconds numeric, published_at timestamp with time zone)'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[]
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '3e72ef0e86cc539ee9f87ba6173def30';

  if private_implementation_count <> 1 then
    raise exception '0091 rollback expected one private Tour-summary implementation, found %', private_implementation_count;
  end if;

  drop function public.public_tour_summaries(uuid[], uuid[]);

  alter function private.public_tour_summaries(uuid[], uuid[]) set search_path = public;
  alter function private.public_tour_summaries(uuid[], uuid[]) set schema public;

  revoke all on function public.public_tour_summaries(uuid[], uuid[])
    from public, anon, authenticated, service_role;
  grant execute on function public.public_tour_summaries(uuid[], uuid[])
    to postgres, anon, authenticated, service_role;

  select count(*)::integer into restored_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  join pg_language function_language on function_language.oid = function_record.prolang
  where function_schema.nspname = 'public'
    and function_record.proname = 'public_tour_summaries'
    and pg_get_function_identity_arguments(function_record.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
    and pg_get_function_result(function_record.oid) = 'TABLE(tour_id uuid, parent_type text, parent_id uuid, duration_seconds numeric, published_at timestamp with time zone)'
    and function_language.lanname = 'plpgsql'
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=public']::text[]
    and coalesce(function_record.proacl::text, '') = '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'
    and md5(replace(function_record.prosrc, E'\r\n', E'\n')) = '3e72ef0e86cc539ee9f87ba6173def30';

  if restored_count <> 1 then
    raise exception '0091 rollback did not restore the canonical public Tour-summary implementation';
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname = 'public_tour_summaries'
      and pg_get_function_identity_arguments(function_record.oid) = 'p_listing_ids uuid[], p_service_ids uuid[]'
  ) then
    raise exception '0091 rollback left the Tour-summary implementation in private';
  end if;
end
$rollback$;

commit;
