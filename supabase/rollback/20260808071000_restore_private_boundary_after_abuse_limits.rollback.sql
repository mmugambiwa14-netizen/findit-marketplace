-- 20260808071000_restore_private_boundary_after_abuse_limits.rollback.sql
-- Safety rollback: this correction restores a pre-existing private-schema
-- contract and closes an authorization NULL edge. Reversing either would
-- knowingly reintroduce a privilege regression, so rollback preserves both
-- safety properties while leaving all rate-limit data untouched.

begin;

grant usage on schema private to anon, authenticated;

create or replace function public.prune_abuse_rate_limit_buckets(
  p_limit integer default 5000
)
returns integer
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
  v_deleted integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 50000 then
    raise exception 'invalid prune limit' using errcode = '22023';
  end if;

  with doomed as (
    select b.scope, b.subject_hash
    from private.abuse_rate_limit_buckets b
    where b.expires_at < clock_timestamp()
    order by b.expires_at, b.scope, b.subject_hash
    limit p_limit
    for update skip locked
  )
  delete from private.abuse_rate_limit_buckets b
  using doomed d
  where b.scope = d.scope and b.subject_hash = d.subject_hash;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.prune_abuse_rate_limit_buckets(integer)
  from public, anon, authenticated;
grant execute on function public.prune_abuse_rate_limit_buckets(integer)
  to service_role;

revoke all on table private.abuse_rate_limit_buckets
  from public, anon, authenticated, service_role;
revoke all on function private.consume_abuse_rate_limit(text, text, integer, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.require_abuse_rate_limit(text, text, integer, integer, text, text, integer)
  from public, anon, authenticated, service_role;

commit;
