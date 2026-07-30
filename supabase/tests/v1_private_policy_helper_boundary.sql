begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  (
    select count(*)::bigint
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
      )
  ),
  6::bigint,
  'all six policy helpers are SECURITY DEFINER functions in private'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'public'
      and function_record.proname in (
        'can_read_listing_context',
        'has_active_tour_upload_intent',
        'has_valid_listing_upload_intent',
        'has_valid_marketplace_image_upload_intent',
        'is_attached_marketplace_image',
        'is_public_marketplace_image'
      )
  ),
  0::bigint,
  'no policy helper remains in the exposed public schema'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_policies
    where (schemaname, tablename, policyname) in (
      ('public', 'listings', 'listings_public_read_available'),
      ('storage', 'objects', 'listing_image_validated_insert'),
      ('storage', 'objects', 'marketplace_image_authorized_read'),
      ('storage', 'objects', 'marketplace_image_owner_delete_unattached'),
      ('storage', 'objects', 'marketplace_image_validated_insert'),
      ('storage', 'objects', 'tour_source_authorized_insert')
    )
      and (coalesce(qual, '') ~ 'private\.' or coalesce(with_check, '') ~ 'private\.')
  ),
  6::bigint,
  'all six dependent policies explicitly reference private helpers'
);

select extensions.ok(
  has_function_privilege(
    'anon',
    'private.can_read_listing_context(uuid,uuid,timestamptz)',
    'EXECUTE'
  ),
  'anon can execute the private listing visibility helper through RLS'
);

select extensions.ok(
  has_function_privilege(
    'anon',
    'private.is_public_marketplace_image(text)',
    'EXECUTE'
  ),
  'anon can execute the private public-media helper through RLS'
);

select extensions.is(
  (
    select count(*)::bigint
    from pg_proc function_record
    join pg_namespace function_schema on function_schema.oid = function_record.pronamespace
    where function_schema.nspname = 'private'
      and function_record.proname in (
        'can_read_listing_context',
        'has_active_tour_upload_intent',
        'has_valid_listing_upload_intent',
        'has_valid_marketplace_image_upload_intent',
        'is_attached_marketplace_image',
        'is_public_marketplace_image'
      )
      and has_function_privilege('authenticated', function_record.oid, 'EXECUTE')
  ),
  6::bigint,
  'authenticated can execute all six helpers only through their private identities'
);

set local role anon;
select count(*) from public.listings;
select count(*) from storage.objects where bucket_id = 'marketplace-images';
reset role;

select extensions.pass('anonymous listing and marketplace-media reads execute through private helpers');

set local role authenticated;
select private.has_active_tour_upload_intent('00000000-0000-0000-0000-000000000000/missing');
select private.has_valid_listing_upload_intent('00000000-0000-0000-0000-000000000000/missing');
select private.has_valid_marketplace_image_upload_intent('00000000-0000-0000-0000-000000000000/missing');
reset role;

select extensions.pass('authenticated upload policies retain executable private helpers');

select extensions.finish();
rollback;
