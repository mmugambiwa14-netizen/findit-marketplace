begin;

-- RLS policy helpers in private require schema USAGE in addition to explicit
-- per-function EXECUTE grants. CREATE remains revoked and private is not an
-- exposed PostgREST schema.
grant usage on schema private to anon, authenticated;

do $migration$
begin
  if has_function_privilege('anon', 'private.assert_contact_reveal_budget(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.assert_contact_reveal_budget(uuid)', 'EXECUTE') then
    raise exception 'restoring schema usage exposed the contact reveal budget helper';
  end if;
end;
$migration$;

commit;
