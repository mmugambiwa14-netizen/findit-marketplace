-- 0087_private_policy_helper_boundary.rollback.sql
-- Restore the six policy helpers to public and restore the exact pre-0087
-- policy expressions and execute grants. No table data is changed.

do $rollback$
declare
  private_count integer;
  exposed_count integer;
  policy_count integer;
begin
  select count(*)::integer into private_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'private'
    and function_record.prosecdef
    and (function_record.proname, pg_get_function_identity_arguments(function_record.oid)) in (
      ('can_read_listing_context', 'p_listing_id uuid, p_seller_id uuid, p_content_suspended_at timestamp with time zone'),
      ('has_active_tour_upload_intent', 'p_storage_path text'),
      ('has_valid_listing_upload_intent', 'p_storage_path text'),
      ('has_valid_marketplace_image_upload_intent', 'p_storage_path text'),
      ('is_attached_marketplace_image', 'p_storage_path text'),
      ('is_public_marketplace_image', 'p_storage_path text')
    );

  if private_count <> 6 then
    raise exception '0087 rollback expected six private policy helpers, found %', private_count;
  end if;

  select count(*)::integer into exposed_count
  from pg_proc function_record
  join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
  where function_schema.nspname = 'public'
    and (function_record.proname, pg_get_function_identity_arguments(function_record.oid)) in (
      ('can_read_listing_context', 'p_listing_id uuid, p_seller_id uuid, p_content_suspended_at timestamp with time zone'),
      ('has_active_tour_upload_intent', 'p_storage_path text'),
      ('has_valid_listing_upload_intent', 'p_storage_path text'),
      ('has_valid_marketplace_image_upload_intent', 'p_storage_path text'),
      ('is_attached_marketplace_image', 'p_storage_path text'),
      ('is_public_marketplace_image', 'p_storage_path text')
    );

  if exposed_count <> 0 then
    raise exception '0087 rollback refused because public helper identities already exist';
  end if;

  select count(*)::integer into policy_count
  from pg_policies
  where (schemaname, tablename, policyname) in (
    ('public', 'listings', 'listings_public_read_available'),
    ('storage', 'objects', 'listing_image_validated_insert'),
    ('storage', 'objects', 'marketplace_image_authorized_read'),
    ('storage', 'objects', 'marketplace_image_owner_delete_unattached'),
    ('storage', 'objects', 'marketplace_image_validated_insert'),
    ('storage', 'objects', 'tour_source_authorized_insert')
  )
  and (coalesce(qual, '') ~ 'private\.' or coalesce(with_check, '') ~ 'private\.');

  if policy_count <> 6 then
    raise exception '0087 rollback expected six private-helper policies, found %', policy_count;
  end if;

  alter function private.can_read_listing_context(uuid, uuid, timestamptz) set schema public;
  alter function private.has_active_tour_upload_intent(text) set schema public;
  alter function private.has_valid_listing_upload_intent(text) set schema public;
  alter function private.has_valid_marketplace_image_upload_intent(text) set schema public;
  alter function private.is_attached_marketplace_image(text) set schema public;
  alter function private.is_public_marketplace_image(text) set schema public;

  revoke all on function public.can_read_listing_context(uuid, uuid, timestamptz) from public, anon, authenticated, service_role;
  grant execute on function public.can_read_listing_context(uuid, uuid, timestamptz) to anon, authenticated, service_role;

  revoke all on function public.has_active_tour_upload_intent(text) from public, anon, authenticated, service_role;
  grant execute on function public.has_active_tour_upload_intent(text) to authenticated, service_role;

  revoke all on function public.has_valid_listing_upload_intent(text) from public, anon, authenticated, service_role;
  grant execute on function public.has_valid_listing_upload_intent(text) to authenticated, service_role;

  revoke all on function public.has_valid_marketplace_image_upload_intent(text) from public, anon, authenticated, service_role;
  grant execute on function public.has_valid_marketplace_image_upload_intent(text) to authenticated, service_role;

  revoke all on function public.is_attached_marketplace_image(text) from public, anon, authenticated, service_role;
  grant execute on function public.is_attached_marketplace_image(text) to authenticated, service_role;

  revoke all on function public.is_public_marketplace_image(text) from public, anon, authenticated, service_role;
  grant execute on function public.is_public_marketplace_image(text) to anon, authenticated, service_role;

  alter policy listings_public_read_available on public.listings
    using (
      (
        status = any (array['available'::listing_status, 'under_offer'::listing_status])
        and content_suspended_at is null
      )
      or can_read_listing_context(id, seller_id, content_suspended_at)
    );

  alter policy tour_source_authorized_insert on storage.objects
    with check (
      bucket_id = 'tour-sources'::text
      and owner_id = (auth.uid())::text
      and (storage.foldername(name))[1] = (auth.uid())::text
      and has_active_tour_upload_intent(name)
    );

  alter policy listing_image_validated_insert on storage.objects
    with check (
      bucket_id = 'listing-images'::text
      and owner_id = (auth.uid())::text
      and (storage.foldername(name))[1] = (auth.uid())::text
      and has_valid_listing_upload_intent(name)
    );

  alter policy marketplace_image_validated_insert on storage.objects
    with check (
      bucket_id = 'marketplace-images'::text
      and owner_id = (auth.uid())::text
      and (storage.foldername(name))[1] = (auth.uid())::text
      and has_valid_marketplace_image_upload_intent(name)
    );

  alter policy marketplace_image_owner_delete_unattached on storage.objects
    using (
      bucket_id = 'marketplace-images'::text
      and owner_id = (auth.uid())::text
      and not is_attached_marketplace_image(name)
    );

  alter policy marketplace_image_authorized_read on storage.objects
    using (
      bucket_id = 'marketplace-images'::text
      and (
        owner_id = (auth.uid())::text
        or is_admin()
        or is_public_marketplace_image(name)
      )
    );
end
$rollback$;
