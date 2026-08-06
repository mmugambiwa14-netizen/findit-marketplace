begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

select extensions.ok(
  not has_table_privilege('authenticated', 'public.services', 'SELECT'),
  'authenticated holds no table-level SELECT grant on services'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.services', 'SELECT'),
  'anon holds no table-level SELECT grant on services'
);
select extensions.ok(
  not has_column_privilege('authenticated', 'public.services', 'contact_phone', 'SELECT'),
  'authenticated cannot read services.contact_phone'
);
select extensions.ok(
  not has_column_privilege('authenticated', 'public.services', 'contact_whatsapp', 'SELECT'),
  'authenticated cannot read services.contact_whatsapp'
);
select extensions.ok(
  not has_column_privilege('authenticated', 'public.services', 'contact_email', 'SELECT'),
  'authenticated cannot read services.contact_email'
);
select extensions.ok(
  has_column_privilege('authenticated', 'public.services', 'title', 'SELECT'),
  'authenticated can still read services.title'
);
select extensions.ok(
  has_column_privilege('authenticated', 'public.services', 'has_contact_phone', 'SELECT'),
  'authenticated can still read the contact-availability flag'
);

select * from extensions.finish();
rollback;
