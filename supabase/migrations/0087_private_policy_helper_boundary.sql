-- 0087_private_policy_helper_boundary.sql
--
-- Move six policy-only SECURITY DEFINER helpers out of the exposed public
-- schema. Their dependent public/storage policies are rewritten with explicit
-- private schema references, while the existing anon/authenticated/service-role
-- execution grants required by RLS remain unchanged.
--
-- The migration fails closed on exact function definitions, ACLs and policy
-- expressions, and refuses to move a helper that has any stored-function caller.

create temporary table findit_0087_expected_functions (
  function_name text not null,
  identity_arguments text not null,
  definition_md5 text not null,
  acl_text text not null,
  primary key (function_name, identity_arguments)
) on commit drop;

insert into findit_0087_expected_functions values
  ('can_read_listing_context', 'p_listing_id uuid, p_seller_id uuid, p_content_suspended_at timestamp with time zone', '031ae72f1bfa97c9329f0d9a86d271dd', '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
  ('has_active_tour_upload_intent', 'p_storage_path text', 'e11ae4a7bf2a9b89f3be0f496d4fdde1', '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
  ('has_valid_listing_upload_intent', 'p_storage_path text', '5a2915db612c79e6c459e175751c9ec2', '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
  ('has_valid_marketplace_image_upload_intent', 'p_storage_path text', 'f7bc4c7d9f686f7197726886b2050548', '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
  ('is_attached_marketplace_image', 'p_storage_path text', '8939d5306f09bf76943236071a663f10', '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'),
  ('is_public_marketplace_image', 'p_storage_path text', '49347c71cf0c59741c25849c291474f0', '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}');

create temporary table findit_0087_expected_policies (
  schema_name text not null,
  table_name text not null,
  policy_name text not null,
  command_name text not null,
  roles_text text not null,
  qual_md5 text not null,
  with_check_md5 text not null,
  primary key (schema_name, table_name, policy_name)
) on commit drop;

insert into findit_0087_expected_policies values
  ('public', 'listings', 'listings_public_read_available', 'SELECT', '{anon,authenticated}', 'bffe084707fc7459fa2c65bb1b848646', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('storage', 'objects', 'listing_image_validated_insert', 'INSERT', '{authenticated}', 'd41d8cd98f00b204e9800998ecf8427e', '97a2ba9c9357ea302ba381a03085fcaf'),
  ('storage', 'objects', 'marketplace_image_authorized_read', 'SELECT', '{public}', 'd52908fb8d5fb9fdc81890eeba7a1879', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('storage', 'objects', 'marketplace_image_owner_delete_unattached', 'DELETE', '{authenticated}', '17b07521e5026fceb0563f47d178352d', 'd41d8cd98f00b204e9800998ecf8427e'),
  ('storage', 'objects', 'marketplace_image_validated_insert', 'INSERT', '{authenticated}', 'd41d8cd98f00b204e9800998ecf8427e', 'aebf681a059e2b23cbe674830dfe44a6'),
  ('storage', 'objects', 'tour_source_authorized_insert', 'INSERT', '{authenticated}', 'd41d8cd98f00b204e9800998ecf8427e', '68c1e168334a04e8c35bac087411682c');

do $migration$
declare
  mismatch_count integer;
  caller_count integer;
  moved_count integer;
begin
  if (select count(*) from findit_0087_expected_functions) <> 6 then
    raise exception '0087 expected six policy helper fingerprints';
  end if;

  select count(*)::integer into mismatch_count
  from findit_0087_expected_functions expected
  left join pg_proc function_record
    on function_record.proname = expected.function_name
   and pg_get_function_identity_arguments(function_record.oid) = expected.identity_arguments
  left join pg_namespace function_schema
    on function_schema.oid = function_record.pronamespace
  where function_record.oid is null
     or function_schema.nspname <> 'public'
     or not function_record.prosecdef
     or pg_get_userbyid(function_record.proowner) <> 'postgres'
     or function_record.proconfig::text <> '{search_path=public}'
     or coalesce(function_record.proacl::text, '') <> expected.acl_text
     or md5(pg_get_functiondef(function_record.oid)) <> expected.definition_md5;

  if mismatch_count <> 0 then
    raise exception '0087 refused because % helper fingerprints drifted', mismatch_count;
  end if;

  select count(*)::integer into mismatch_count
  from findit_0087_expected_policies expected
  left join pg_policies policy
    on policy.schemaname = expected.schema_name
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where policy.policyname is null
     or policy.permissive <> 'PERMISSIVE'
     or policy.cmd <> expected.command_name
     or policy.roles::text <> expected.roles_text
     or md5(coalesce(policy.qual, '')) <> expected.qual_md5
     or md5(coalesce(policy.with_check, '')) <> expected.with_check_md5;

  if mismatch_count <> 0 then
    raise exception '0087 refused because % dependent policy fingerprints drifted', mismatch_count;
  end if;

  select count(*)::integer into caller_count
  from findit_0087_expected_functions expected
  join pg_proc target on target.proname = expected.function_name
  join pg_namespace target_schema on target_schema.oid = target.pronamespace
  join pg_proc caller on caller.oid <> target.oid
  join pg_namespace caller_schema on caller_schema.oid = caller.pronamespace
  where target_schema.nspname = 'public'
    and caller_schema.nspname = 'public'
    and pg_get_functiondef(caller.oid) ~ (
      '(^|[^A-Za-z0-9_])' || expected.function_name || '\s*\('
    );

  if caller_count <> 0 then
    raise exception '0087 refused because % stored-function helper callers exist', caller_count;
  end if;

  alter function public.can_read_listing_context(uuid, uuid, timestamptz) set schema private;
  alter function public.has_active_tour_upload_intent(text) set schema private;
  alter function public.has_valid_listing_upload_intent(text) set schema private;
  alter function public.has_valid_marketplace_image_upload_intent(text) set schema private;
  alter function public.is_attached_marketplace_image(text) set schema private;
  alter function public.is_public_marketplace_image(text) set schema private;

  revoke all on function private.can_read_listing_context(uuid, uuid, timestamptz) from public, anon, authenticated, service_role;
  grant execute on function private.can_read_listing_context(uuid, uuid, timestamptz) to anon, authenticated, service_role;

  revoke all on function private.has_active_tour_upload_intent(text) from public, anon, authenticated, service_role;
  grant execute on function private.has_active_tour_upload_intent(text) to authenticated, service_role;

  revoke all on function private.has_valid_listing_upload_intent(text) from public, anon, authenticated, service_role;
  grant execute on function private.has_valid_listing_upload_intent(text) to authenticated, service_role;

  revoke all on function private.has_valid_marketplace_image_upload_intent(text) from public, anon, authenticated, service_role;
  grant execute on function private.has_valid_marketplace_image_upload_intent(text) to authenticated, service_role;

  revoke all on function private.is_attached_marketplace_image(text) from public, anon, authenticated, service_role;
  grant execute on function private.is_attached_marketplace_image(text) to authenticated, service_role;

  revoke all on function private.is_public_marketplace_image(text) from public, anon, authenticated, service_role;
  grant execute on function private.is_public_marketplace_image(text) to anon, authenticated, service_role;

  alter policy listings_public_read_available on public.listings
    using (
      (
        status = any (array['available'::listing_status, 'under_offer'::listing_status])
        and content_suspended_at is null
      )
      or private.can_read_listing_context(id, seller_id, content_suspended_at)
    );

  alter policy tour_source_authorized_insert on storage.objects
    with check (
      bucket_id = 'tour-sources'::text
      and owner_id = (auth.uid())::text
      and (storage.foldername(name))[1] = (auth.uid())::text
      and private.has_active_tour_upload_intent(name)
    );

  alter policy listing_image_validated_insert on storage.objects
    with check (
      bucket_id = 'listing-images'::text
      and owner_id = (auth.uid())::text
      and (storage.foldername(name))[1] = (auth.uid())::text
      and private.has_valid_listing_upload_intent(name)
    );

  alter policy marketplace_image_validated_insert on storage.objects
    with check (
      bucket_id = 'marketplace-images'::text
      and owner_id = (auth.uid())::text
      and (storage.foldername(name))[1] = (auth.uid())::text
      and private.has_valid_marketplace_image_upload_intent(name)
    );

  alter policy marketplace_image_owner_delete_unattached on storage.objects
    using (
      bucket_id = 'marketplace-images'::text
      and owner_id = (auth.uid())::text
      and not private.is_attached_marketplace_image(name)
    );

  alter policy marketplace_image_authorized_read on storage.objects
    using (
      bucket_id = 'marketplace-images'::text
      and (
        owner_id = (auth.uid())::text
        or is_admin()
        or private.is_public_marketplace_image(name)
      )
    );

  select count(*)::integer into moved_count
  from findit_0087_expected_functions expected
  join pg_proc function_record
    on function_record.proname = expected.function_name
   and pg_get_function_identity_arguments(function_record.oid) = expected.identity_arguments
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'private'
    and function_record.prosecdef;

  if moved_count <> 6 then
    raise exception '0087 moved only % of six helpers', moved_count;
  end if;

  if exists (
    select 1
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    join findit_0087_expected_functions expected
      on expected.function_name = function_record.proname
     and expected.identity_arguments = pg_get_function_identity_arguments(function_record.oid)
    where function_schema.nspname = 'public'
  ) then
    raise exception '0087 left a policy helper in the exposed public schema';
  end if;

  select count(*)::integer into mismatch_count
  from pg_policies policy
  join findit_0087_expected_policies expected
    on expected.schema_name = policy.schemaname
   and expected.table_name = policy.tablename
   and expected.policy_name = policy.policyname
  where coalesce(policy.qual, '') !~ 'private\.'
    and coalesce(policy.with_check, '') !~ 'private\.';

  if mismatch_count <> 0 then
    raise exception '0087 left % dependent policies without explicit private helpers', mismatch_count;
  end if;
end
$migration$;
