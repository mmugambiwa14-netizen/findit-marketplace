begin;

-- 0087 routed the storage upload policies and listings_public_read_available
-- through private policy helpers, granting anon and authenticated EXECUTE on
-- exactly the helpers those policies call. 0109 then revoked every privilege on
-- schema private from anon and authenticated while hardening the seller contact
-- reveal boundary. Its stated reasoning -- "the SECURITY DEFINER callers below
-- run as owner" -- holds for its own functions, but an RLS policy expression is
-- evaluated with the privileges of the querying role, and calling private.f()
-- needs USAGE on the schema as well as EXECUTE on the function.
--
-- Every policy 0087 rewrote therefore fails with "permission denied for schema
-- private" as soon as the private call is actually reached: tour, listing and
-- marketplace image uploads, unattached marketplace image deletes, and owner
-- reads of any listing that is not both available and unsuspended. Browsing
-- hides the fault because listings_public_read_available short-circuits on the
-- available-and-unsuspended branch before it evaluates the private helper.
--
-- Restoring USAGE is safe. Default privileges are declared `in schema public`
-- only, so a routine created in private never receives an implicit anon or
-- authenticated grant, and every private routine carries an explicit
-- per-function revoke. Schema USAGE confers nothing on its own: only the
-- helpers that 0087 and its successors deliberately granted stay reachable.

grant usage on schema private to anon, authenticated;

do $migration$
begin
  -- The boundary 0109 set out to protect must stay closed.
  if has_function_privilege('anon', 'private.assert_contact_reveal_budget(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.assert_contact_reveal_budget(uuid)', 'EXECUTE') then
    raise exception
      '20260806120000 restored schema usage would expose the contact reveal budget helper';
  end if;
end;
$migration$;

commit;
