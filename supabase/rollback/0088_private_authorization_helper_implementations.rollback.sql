-- Roll back migration 0088 by removing the public invoker wrappers and moving
-- the original SECURITY DEFINER implementations back to public with their
-- previous search paths and execution grants.

begin;

do $rollback$
declare
  public_wrapper_count integer;
  private_implementation_count integer;
  restored_policy_count integer;
begin
  select count(*)::integer into public_wrapper_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'public'
    and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
    and pg_get_function_identity_arguments(function_record.oid) = ''
    and not function_record.prosecdef
    and function_record.proconfig = array['search_path=']::text[]
    and position(
      'private.' || function_record.proname || '()'
      in function_record.prosrc
    ) > 0;

  if public_wrapper_count <> 3 then
    raise exception '0088 rollback expected three public invoker wrappers, found %', public_wrapper_count;
  end if;

  select count(*)::integer into private_implementation_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'private'
    and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
    and pg_get_function_identity_arguments(function_record.oid) = ''
    and function_record.prosecdef
    and function_record.proconfig = array['search_path=']::text[];

  if private_implementation_count <> 3 then
    raise exception '0088 rollback expected three private implementations, found %', private_implementation_count;
  end if;

  drop function public.is_super_admin();
  drop function public.is_admin();
  drop function public.is_active_user();

  alter function private.is_active_user() set search_path = public;
  alter function private.is_admin() set search_path = public, extensions;
  alter function private.is_super_admin() set search_path = public, extensions;

  alter function private.is_active_user() set schema public;
  alter function private.is_admin() set schema public;
  alter function private.is_super_admin() set schema public;

  revoke all on function public.is_active_user() from public, anon, authenticated, service_role;
  grant execute on function public.is_active_user() to postgres, anon, authenticated, service_role;

  revoke all on function public.is_admin() from public, anon, authenticated, service_role;
  grant execute on function public.is_admin() to public, postgres, anon, authenticated, service_role;

  revoke all on function public.is_super_admin() from public, anon, authenticated, service_role;
  grant execute on function public.is_super_admin() to public, postgres, anon, authenticated, service_role;

  select count(*)::integer into restored_policy_count
  from pg_policies policy
  where position('public.is_active_user()' in coalesce(policy.qual, '')) > 0
     or position('public.is_active_user()' in coalesce(policy.with_check, '')) > 0
     or position('public.is_admin()' in coalesce(policy.qual, '')) > 0
     or position('public.is_admin()' in coalesce(policy.with_check, '')) > 0;

  if restored_policy_count <> 102 then
    raise exception '0088 rollback restored only % of 102 public policy dependencies', restored_policy_count;
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname in ('is_active_user', 'is_admin', 'is_super_admin')
      and pg_get_function_identity_arguments(function_record.oid) = ''
  ) then
    raise exception '0088 rollback left an authorization implementation in private';
  end if;
end
$rollback$;

commit;
