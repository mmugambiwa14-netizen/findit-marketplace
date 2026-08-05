begin;

-- Close a contact-detail harvesting hole on public.services for `authenticated`.
--
-- Any signed-in user could read the raw contact_phone, contact_whatsapp and
-- contact_email of every service directly from public.services:
--
--   set role authenticated;
--   select contact_phone, contact_email from public.services;  -- returned data
--
-- That bypasses the entire reveal boundary built for these columns: the
-- has_contact_* flags (0109), the rate-limited reveal_service_contact RPC and
-- its contact_reveal_events audit log (0109/0115). A single query harvests every
-- provider's personal contact details with no rate limit and no audit trail.
--
-- Root cause -- the same no-op revoke that 0111 fixed for anon, left in place for
-- authenticated:
--
--   * 0047 granted a TABLE-level SELECT on public.services to anon AND
--     authenticated.
--   * 0111 removed anon's table-level grant and replaced it with a column
--     allowlist, and documented why the column revoke alone was a no-op: "a
--     TABLE-level SELECT grant covers every column and cannot be narrowed by
--     revoking individual columns". It only did this for anon.
--   * 0115 then ran `revoke select (contact_phone, contact_whatsapp,
--     contact_email) on public.services from authenticated`. Because
--     authenticated still held the 0047 table-level grant, that column revoke was
--     the very no-op 0111 had just described, so the columns stayed readable.
--
-- public.listings was never exposed this way: 0049 removed its table-level grant
-- from both roles and replaced it with a column allowlist, so 0115's column
-- revoke took effect there. This brings services into line for authenticated,
-- exactly as 0111 did for anon.
--
-- The allowlist is rebuilt from the live column list minus the three contact
-- columns, so a column added later is NOT silently exposed -- it stays excluded
-- until someone deliberately grants it.

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

-- Fail closed if the boundary is not what this migration intends.
do $migration$
begin
  -- The three contact columns must be unreadable by authenticated.
  if has_column_privilege('authenticated', 'public.services', 'contact_phone', 'SELECT')
    or has_column_privilege('authenticated', 'public.services', 'contact_whatsapp', 'SELECT')
    or has_column_privilege('authenticated', 'public.services', 'contact_email', 'SELECT') then
    raise exception 'services contact columns are still readable by authenticated';
  end if;

  -- The no-op table-level grant must be gone (otherwise the column revoke is
  -- meaningless, which is the whole bug this migration fixes).
  if has_table_privilege('authenticated', 'public.services', 'SELECT') then
    raise exception 'authenticated still holds a table-level SELECT grant on services';
  end if;

  -- Marketplace browsing must still work: a representative non-contact column
  -- stays readable, and the has_contact_* flags remain available for the UI.
  if not has_column_privilege('authenticated', 'public.services', 'title', 'SELECT')
    or not has_column_privilege('authenticated', 'public.services', 'has_contact_phone', 'SELECT') then
    raise exception 'services fix is over-broad: authenticated lost access to a safe column';
  end if;
end
$migration$;

commit;
