begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.is(
  public.before_user_created_hook('{"user":{"email":"bob@mailinator.com"}}'::jsonb) #>> '{error,http_code}',
  '400',
  'a disposable domain is rejected with http_code 400'
);
select extensions.ok(
  public.before_user_created_hook('{"user":{"email":"bob@mailinator.com"}}'::jsonb) ? 'error',
  'mailinator.com is rejected'
);
select extensions.ok(
  public.before_user_created_hook('{"user":{"email":"a@x.guerrillamail.com"}}'::jsonb) ? 'error',
  'a subdomain of a disposable domain is rejected'
);
select extensions.ok(
  public.before_user_created_hook('{"record":{"email":"x@tempmail.com"}}'::jsonb) ? 'error',
  'the record-shaped payload is inspected'
);
select extensions.ok(
  not (public.before_user_created_hook('{"user":{"email":"real@gmail.com"}}'::jsonb) ? 'error'),
  'a real domain is accepted'
);
select extensions.ok(
  not (public.before_user_created_hook('{"user":{"email":"sales@company.co.zw"}}'::jsonb) ? 'error'),
  'a real multi-label TLD is accepted'
);
select extensions.ok(
  not (public.before_user_created_hook('{"user":{"phone":"+263771234567"}}'::jsonb) ? 'error'),
  'a phone-only signup is not blocked by the email hook'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.disposable_email_domains', 'SELECT'),
  'anon cannot read the disposable-domain blocklist'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.disposable_email_domains', 'SELECT'),
  'authenticated cannot read the disposable-domain blocklist'
);
select extensions.ok(
  has_function_privilege('supabase_auth_admin', 'public.before_user_created_hook(jsonb)', 'EXECUTE'),
  'supabase_auth_admin can execute the hook'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.before_user_created_hook(jsonb)', 'EXECUTE'),
  'anon cannot execute the hook'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.before_user_created_hook(jsonb)', 'EXECUTE'),
  'authenticated cannot execute the hook'
);

select * from extensions.finish();
rollback;
