-- Roll back migration 0089 by removing the public invoker wrappers and moving
-- the original country SECURITY DEFINER implementations back to public with
-- their previous search paths and execution grants.

begin;

do $rollback$
declare
  public_wrapper_count integer;
  private_implementation_count integer;
  restored_caller_count integer;
begin
  select count(*)::integer into public_wrapper_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'public'
    and function_record.proname in (
      'is_country_browsable',
      'is_country_publishable',
      'is_supported_listing_currency'
    )
    and not function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[]
    and position('private.' || function_record.proname || '(' in function_record.prosrc) > 0;

  if public_wrapper_count <> 3 then
    raise exception '0089 rollback expected three public invoker wrappers, found %', public_wrapper_count;
  end if;

  select count(*)::integer into private_implementation_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'private'
    and function_record.proname in (
      'is_country_browsable',
      'is_country_publishable',
      'is_supported_listing_currency'
    )
    and function_record.prosecdef
    and function_record.provolatile = 's'
    and function_record.proconfig = array['search_path=""']::text[];

  if private_implementation_count <> 3 then
    raise exception '0089 rollback expected three private implementations, found %', private_implementation_count;
  end if;

  drop function public.is_supported_listing_currency(text, text);
  drop function public.is_country_publishable(text);
  drop function public.is_country_browsable(text);

  alter function private.is_country_browsable(text) set search_path = public;
  alter function private.is_country_publishable(text) set search_path = public;
  alter function private.is_supported_listing_currency(text, text) set search_path = public;

  alter function private.is_country_browsable(text) set schema public;
  alter function private.is_country_publishable(text) set schema public;
  alter function private.is_supported_listing_currency(text, text) set schema public;

  revoke all on function public.is_country_browsable(text) from public, anon, authenticated, service_role;
  grant execute on function public.is_country_browsable(text) to public, postgres, anon, authenticated, service_role;

  revoke all on function public.is_country_publishable(text) from public, anon, authenticated, service_role;
  grant execute on function public.is_country_publishable(text) to public, postgres, anon, authenticated, service_role;

  revoke all on function public.is_supported_listing_currency(text, text) from public, anon, authenticated, service_role;
  grant execute on function public.is_supported_listing_currency(text, text) to public, postgres, anon, authenticated, service_role;

  select count(*)::integer into restored_caller_count
  from (
    select 1
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where caller_schema.nspname = 'public'
      and caller.proname = 'public_listing_search_page'
      and position('public.is_country_browsable(' in caller.prosrc) > 0

    union all

    select 1
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where caller_schema.nspname = 'public'
      and caller.proname = 'create_v1_listing_submission'
      and position('public.is_country_publishable(' in caller.prosrc) > 0

    union all

    select 1
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where caller_schema.nspname = 'public'
      and caller.proname = 'create_v1_listing_submission'
      and position('public.is_supported_listing_currency(' in caller.prosrc) > 0

    union all

    select 1
    from pg_proc caller
    join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
    where caller_schema.nspname = 'public'
      and caller.proname = 'owner_transition_listing'
      and position('public.is_country_publishable(' in caller.prosrc) > 0
  ) restored_callers;

  if restored_caller_count <> 4 then
    raise exception '0089 rollback restored only % of four public country helper call paths', restored_caller_count;
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname in (
        'is_country_browsable',
        'is_country_publishable',
        'is_supported_listing_currency'
      )
  ) then
    raise exception '0089 rollback left a country implementation in private';
  end if;
end
$rollback$;

commit;
