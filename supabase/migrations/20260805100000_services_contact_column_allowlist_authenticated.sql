begin;

-- Close a contact-detail harvesting hole on public.services for authenticated users.
-- Replace the table-level SELECT grant with a safe column allowlist that excludes
-- contact_phone, contact_whatsapp and contact_email. Contact details remain
-- available only through the audited reveal boundary.

revoke select on public.services from authenticated;

do $$
declare
  allowed text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into allowed
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'services'
    and column_name not in ('contact_phone', 'contact_whatsapp', 'contact_email');

  execute format('grant select (%s) on public.services to authenticated', allowed);
end
$$;

do $migration$
begin
  if has_column_privilege('authenticated', 'public.services', 'contact_phone', 'SELECT')
    or has_column_privilege('authenticated', 'public.services', 'contact_whatsapp', 'SELECT')
    or has_column_privilege('authenticated', 'public.services', 'contact_email', 'SELECT') then
    raise exception 'services contact columns are still readable by authenticated';
  end if;

  if has_table_privilege('authenticated', 'public.services', 'SELECT') then
    raise exception 'authenticated still holds a table-level SELECT grant on services';
  end if;

  if not has_column_privilege('authenticated', 'public.services', 'title', 'SELECT')
    or not has_column_privilege('authenticated', 'public.services', 'has_contact_phone', 'SELECT') then
    raise exception 'services fix is over-broad: authenticated lost access to a safe column';
  end if;
end
$migration$;

commit;
