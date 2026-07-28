-- Targeted rollback for 0041_v1_public_search_and_notification_scale.sql.
-- Apply only after disabling the new Search/Notification frontend and stopping
-- essential-notification-fanout. User notifications, queued jobs, search indexes,
-- metric buckets and incident evidence are intentionally preserved.

-- Stop all writes and telemetry emitted by this milestone.
drop trigger if exists trg_notification_fanout_metrics on public.essential_notification_fanout_jobs;
drop trigger if exists trg_listing_saved_unavailable_fanout on public.listings;
drop trigger if exists trg_listing_tours_owner_notifications on public.listing_tours;

revoke all on function public.record_notification_fanout_metrics() from public, anon, authenticated, service_role;
revoke all on function public.claim_notification_fanout_jobs(integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.process_notification_fanout_job(uuid, uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.fail_notification_fanout_job(uuid, uuid, text) from public, anon, authenticated, service_role;

drop function if exists public.record_notification_fanout_metrics();
drop function if exists public.queue_saved_listing_unavailable();
drop function if exists public.notify_tour_owner_lifecycle();
drop function if exists public.claim_notification_fanout_jobs(integer, integer);
drop function if exists public.process_notification_fanout_job(uuid, uuid, integer);
drop function if exists public.fail_notification_fanout_job(uuid, uuid, text);

-- Remove only the new keyset read boundaries. The legacy offset RPC remains
-- available for an emergency frontend rollback and filters out event types that
-- the previous Notification Center cannot render.
revoke all on function public.notification_rows_page(text, boolean, timestamptz, uuid, integer) from public, anon, authenticated, service_role;
drop function if exists public.notification_rows_page(text, boolean, timestamptz, uuid, integer);

revoke all on function public.public_listing_search_page(text, text, text, text, numeric, numeric, integer, text, text, text, text, text, text, uuid, integer) from public, anon, authenticated, service_role;
drop function if exists public.public_listing_search_page(text, text, text, text, numeric, numeric, integer, text, text, text, text, text, text, uuid, integer);

-- essential_notification_fanout_jobs is intentionally preserved. The table contains no message
-- bodies or private media paths and is required for incident reconciliation.
-- Pending or claimed jobs must be reviewed before a separately approved purge.
-- Preserve the expanded event constraint and delivered notifications; deleting
-- those rows would destroy user-visible history. Older clients continue through
-- notification_rows(), which 0041 restricts to the five legacy event types.
-- Preserve generated search_document and all 0041 indexes. They are additive,
-- contain no private payload, and removing them during an incident would create
-- unnecessary table rewrites and lock risk.
