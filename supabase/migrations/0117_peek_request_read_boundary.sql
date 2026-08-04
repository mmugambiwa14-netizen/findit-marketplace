-- 0117_peek_request_read_boundary.sql
--
-- Repairs two defects introduced by 0116, found by probing staging rather than
-- by reading the migration back.
--
-- DEFECT 1 (functional, total): every browser read of public.peek_requests
-- fails with 42501 "permission denied for table listings".
--
--   The peek_requests_public_read policy contains
--     exists (select 1 from public.listings l where ... l.content_suspended_at is null)
--   RLS policy expressions are evaluated with the *caller's* privileges when
--   they reference a different table. Neither anon nor authenticated holds a
--   column grant on listings.content_suspended_at -- the listings projection is
--   an explicit 34-column allowlist and that column is not in it. So the policy
--   itself raises before any row is considered, and the entire Peek Thread read
--   path is dead for both browser roles.
--
--   (A same-table policy reference is fine: listings_public_read_available
--   filters on content_suspended_at without needing the grant, because the
--   privilege check applies to the columns the caller's own query names.)
--
--   The established remedy in this repository is migration 0087: move the
--   cross-table lookup into a SECURITY DEFINER helper in the private schema,
--   which runs as its owner and can see the column, and have the policy call
--   that instead.
--
-- DEFECT 2 (privacy): authenticated held a table-level SELECT on
-- peek_requests, so every logged-in user could read requester_id,
-- moderation_status, moderation_reason and decline_reason for every request.
--
--   The brief requires a request to be public while the buyer behind it is not,
--   and 0116 withheld requester_id from anon for exactly that reason -- but a
--   logged-in stranger is no less a stranger. This is the same shape as the
--   defects fixed in 0111 (services) and 0115 (owner contacts): a table-level
--   grant silently covering columns an allowlist was supposed to bound.
--
--   Defect 2 is not exploitable *today* only because defect 1 blocks all reads.
--   Repairing defect 1 alone would open it, so both are fixed together here.
--
-- Buyers still need to recognise their own requests in a thread. That is served
-- by public.my_peek_request_ids(), which answers only about the caller, instead
-- of by shipping every requester's identity to every browser.
--
-- No table is created or dropped and no row is modified. Policies, grants and
-- helper functions only.

-- 1. Parent visibility, evaluated as owner -----------------------------------

create or replace function private.is_peek_parent_public(
  p_listing_id uuid,
  p_service_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when p_listing_id is not null then exists (
      select 1
      from public.listings l
      where l.id = p_listing_id
        and l.status = any (array['available'::public.listing_status,
                                  'under_offer'::public.listing_status])
        and l.content_suspended_at is null
    )
    when p_service_id is not null then exists (
      select 1
      from public.services s
      where s.id = p_service_id
        and s.status = 'active'::public.service_status
        and s.category <> 'legal'::public.service_category
    )
    else false
  end;
$function$;

-- RLS evaluates this on behalf of both browser roles, so both need EXECUTE.
-- The revoke runs first and names anon and authenticated explicitly: this
-- project carries default privileges that grant EXECUTE to anon directly, and
-- "revoke ... from public" alone does not remove a direct grant.
revoke all on function private.is_peek_parent_public(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.is_peek_parent_public(uuid, uuid)
  to anon, authenticated, service_role;

-- 2. Support eligibility, evaluated as owner ---------------------------------
-- peek_request_supporters_create tests r.requester_id <> auth.uid(), a
-- cross-table reference to a column step 4 is about to revoke. Moving the test
-- into a helper keeps the rule ("you cannot support your own request") while
-- letting the column go.

create or replace function private.can_support_peek_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select auth.uid() is not null
    and exists (
      select 1
      from public.peek_requests r
      where r.id = p_request_id
        and r.status = 'pending'::public.peek_request_status
        and r.moderation_status = 'approved'
        -- Supporting your own request would be self-inflation.
        and r.requester_id <> auth.uid()
    );
$function$;

revoke all on function private.can_support_peek_request(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.can_support_peek_request(uuid)
  to authenticated, service_role;

-- 3. Rewrite the affected policies -------------------------------------------
-- Same predicates, same visibility. Only the evaluator changes.

drop policy if exists peek_requests_public_read on public.peek_requests;
create policy peek_requests_public_read
  on public.peek_requests
  for select
  using (
    moderation_status = 'approved'
    and status <> 'removed'
    and private.is_peek_parent_public(listing_id, service_id)
  );

drop policy if exists peek_request_supporters_create on public.peek_request_supporters;
create policy peek_request_supporters_create
  on public.peek_request_supporters
  for insert
  with check (
    public.is_active_user()
    and user_id = auth.uid()
    and private.can_support_peek_request(request_id)
  );

-- peek_requests_participant_read and peek_requests_create also reference other
-- tables, but only listings.seller_id and services.provider_id, both of which
-- are inside the existing column allowlists. They are left alone.

-- 4. Column allowlist for authenticated --------------------------------------
-- Deliberately identical to the anon allowlist from 0116. A column grant is not
-- row-scoped, so granting decline_reason "so the buyer can see why" would in
-- fact publish every seller's decline reason to every logged-in user. Anything
-- that must be scoped to one person is served by a function that checks who is
-- asking, not by a grant.

revoke select on public.peek_requests from authenticated;

grant select (
  id, listing_id, service_id, category, body, status, merged_into_id,
  supporter_count, current_response_id, answered_at, declined_at,
  created_at, updated_at
) on public.peek_requests to authenticated;

-- Insert is likewise bounded to the columns a client legitimately supplies.
-- The create policy already pins status, moderation_status, supporter_count and
-- the rest to safe values; this makes the surface match the intent instead of
-- relying on the policy alone.
revoke insert on public.peek_requests from authenticated;

grant insert (
  listing_id, service_id, requester_id, category, body
) on public.peek_requests to authenticated;

-- 5. "Which of these did I ask?" ---------------------------------------------
-- Returns only the caller's own ids, so a thread can mark "your request"
-- without any browser ever holding another buyer's identity. Mirrors the shape
-- of owner_listing_contacts() from 0115.

create or replace function public.my_peek_request_ids(p_request_ids uuid[])
returns table (id uuid)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_ids uuid[] := coalesce(p_request_ids, '{}'::uuid[]);
begin
  if auth.uid() is null then
    return;
  end if;

  -- A page of threads is bounded; an unbounded array is not a legitimate call.
  if array_length(v_ids, 1) > 200 then
    raise exception 'too many request ids' using errcode = '22023';
  end if;

  return query
    select r.id
    from public.peek_requests r
    where r.id = any (v_ids)
      and r.requester_id = auth.uid();
end;
$function$;

revoke all on function public.my_peek_request_ids(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.my_peek_request_ids(uuid[])
  to authenticated, service_role;

-- 6. Fail closed --------------------------------------------------------------
-- 0116 reported success while leaving the read path dead, and an earlier
-- storage-grant migration reported success while changing nothing at all.
-- Assert the intended end state rather than trusting the statements above.

do $verify$
declare
  v_missing text;
  v_leaked text;
begin
  -- The helpers exist, are SECURITY DEFINER, and have an empty search path.
  select string_agg(expected, ', ')
    into v_missing
  from (values
    ('private.is_peek_parent_public'),
    ('private.can_support_peek_request'),
    ('public.my_peek_request_ids')
  ) as t(expected)
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname || '.' || p.proname = t.expected
      and p.prosecdef
      -- "set search_path to ''" is stored with the quotes intact.
      and 'search_path=""' = any (p.proconfig)
  );

  if v_missing is not null then
    raise exception '0117 helper missing or not hardened: %', v_missing;
  end if;

  -- anon must not gain execute on the caller-scoped helper.
  if has_function_privilege('anon', 'public.my_peek_request_ids(uuid[])', 'EXECUTE') then
    raise exception '0117 left my_peek_request_ids executable by anon';
  end if;

  -- Both browser roles must be able to evaluate the read policy.
  if not has_function_privilege('anon', 'private.is_peek_parent_public(uuid, uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'private.is_peek_parent_public(uuid, uuid)', 'EXECUTE') then
    raise exception '0117 left the read policy helper unexecutable by a browser role';
  end if;

  -- Defect 2: no browser role may read requester identity or moderation notes.
  select string_agg(grantee || '.' || column_name, ', ' order by grantee, column_name)
    into v_leaked
  from information_schema.column_privileges
  where table_schema = 'public'
    and table_name = 'peek_requests'
    and privilege_type = 'SELECT'
    and grantee in ('anon', 'authenticated')
    and column_name in ('requester_id', 'moderation_status', 'moderation_reason', 'decline_reason');

  if v_leaked is not null then
    raise exception '0117 left buyer identity readable by a browser role: %', v_leaked;
  end if;

  -- Defect 1: the read policy must no longer name a table the caller cannot read.
  if exists (
    select 1 from pg_policy
    where polrelid = 'public.peek_requests'::regclass
      and polname = 'peek_requests_public_read'
      and pg_get_expr(polqual, polrelid) like '%content_suspended_at%'
  ) then
    raise exception '0117 left the public read policy depending on an ungranted column';
  end if;
end
$verify$;
