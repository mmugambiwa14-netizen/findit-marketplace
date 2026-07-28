-- Non-destructive rollback for the trigger-function grant closure.
--
-- Read this before applying it. Migration 0045 only *removes* privileges and
-- pins two search_paths; it adds no table, column, policy or behaviour. Nothing
-- in the frontend, the Edge Functions or the workers calls any of these
-- functions directly -- they are invoked by triggers, which do not consult the
-- calling role's EXECUTE privilege. There is therefore no application failure
-- mode that this rollback repairs.
--
-- Applying it re-opens F-15 (see docs/audit/AUDIT_SUMMARY.md): seven
-- SECURITY DEFINER trigger functions become executable by anon and
-- authenticated again. It exists only for strict state parity during an
-- incident that requires the schema to match the pre-0045 grant map exactly.
-- Prefer leaving 0045 in place and rolling back the migration that actually
-- caused the incident.
--
-- It drops no table, deletes no row and truncates nothing.

grant execute on function public.record_tour_upload_intent_metrics() to anon, authenticated;
grant execute on function public.record_tour_processing_metrics() to anon, authenticated;
grant execute on function public.record_tour_cleanup_metrics() to anon, authenticated;
grant execute on function public.record_tour_cache_metrics() to anon, authenticated;
grant execute on function public.record_tour_report_metric() to anon, authenticated;
grant execute on function public.notify_tour_owner_lifecycle() to anon, authenticated;
grant execute on function public.queue_saved_listing_unavailable() to anon, authenticated;

-- Restore the pre-0045 definitions, which carried a role-mutable search_path.
-- Both are plain (non-SECURITY DEFINER) trigger functions, so they run with the
-- invoker's privileges either way.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.enforce_listing_kind()
returns trigger as $$
declare
  actual listing_kind;
  expected listing_kind;
begin
  -- PostgreSQL trigger functions cannot declare formal arguments. Values
  -- supplied by CREATE TRIGGER are exposed through TG_ARGV instead.
  if tg_nargs <> 1 then
    raise exception 'enforce_listing_kind requires exactly one trigger argument';
  end if;
  expected := tg_argv[0]::listing_kind;

  select kind into actual from public.listings where id = new.listing_id;
  if actual is null then
    raise exception 'listing % does not exist', new.listing_id;
  elsif actual <> expected then
    raise exception 'listing % has kind %, expected %', new.listing_id, actual, expected;
  end if;
  return new;
end;
$$ language plpgsql;

grant execute on function public.set_updated_at() to anon, authenticated;
grant execute on function public.enforce_listing_kind() to anon, authenticated;
