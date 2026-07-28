-- 0045_v1_trigger_function_grant_closure.sql
-- Closes a drift gap found by the hosted Supabase database linter after the
-- full migration chain was applied to a real project.
--
-- Migration 0027 established the invariant that trigger and nested helper
-- functions are never browser APIs, and revoked them from public/anon/
-- authenticated. Supabase's default privileges grant EXECUTE on every new
-- public-schema function to both browser roles, so each later migration that
-- adds a trigger function has to restate that revoke. 0035 and 0041 did for
-- their own triggers; 0040 and part of 0041 did not, leaving seven
-- SECURITY DEFINER trigger functions executable by anon and authenticated.
--
-- PostgREST cannot invoke a function returning `trigger`, so this was not
-- reachable through the REST API -- but it silently broke the repository's own
-- stated hardening boundary, and defence in depth should not depend on a
-- PostgREST implementation detail. Revoking EXECUTE does not affect trigger
-- firing: triggers execute their function as part of the table operation, not
-- via the calling role's EXECUTE privilege.

-- Added by 0040 (compact Tour lifecycle telemetry).
revoke execute on function public.record_tour_upload_intent_metrics() from public, anon, authenticated;
revoke execute on function public.record_tour_processing_metrics() from public, anon, authenticated;
revoke execute on function public.record_tour_cleanup_metrics() from public, anon, authenticated;
revoke execute on function public.record_tour_cache_metrics() from public, anon, authenticated;
revoke execute on function public.record_tour_report_metric() from public, anon, authenticated;

-- Added by 0041 (Tour owner notifications and saved-listing fan-out queue).
revoke execute on function public.notify_tour_owner_lifecycle() from public, anon, authenticated;
revoke execute on function public.queue_saved_listing_unavailable() from public, anon, authenticated;

-- These two predate the 0027 hardening pass and are the only remaining
-- public-schema functions with a role-mutable search_path. Neither is
-- SECURITY DEFINER, so they run with the invoker's privileges and were never a
-- privilege-escalation vector -- but pinning search_path removes the last
-- mutable-resolution surface and makes the invariant uniform across the schema.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function public.enforce_listing_kind()
returns trigger as $$
declare
  actual public.listing_kind;
  expected public.listing_kind;
begin
  -- PostgreSQL trigger functions cannot declare formal arguments. Values
  -- supplied by CREATE TRIGGER are exposed through TG_ARGV instead.
  if tg_nargs <> 1 then
    raise exception 'enforce_listing_kind requires exactly one trigger argument';
  end if;
  expected := tg_argv[0]::public.listing_kind;

  select kind into actual from public.listings where id = new.listing_id;
  if actual is null then
    raise exception 'listing % does not exist', new.listing_id;
  elsif actual <> expected then
    raise exception 'listing % has kind %, expected %', new.listing_id, actual, expected;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.enforce_listing_kind() from public, anon, authenticated;
