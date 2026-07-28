-- Targeted rollback for 0042. Apply after disabling tour-observability-monitor.
-- Notification jobs, compact metrics, alerts and dead-letter evidence remain.

revoke all on function public.admin_notification_fanout_health() from public, anon, authenticated, service_role;
revoke all on function public.evaluate_notification_fanout_alerts(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.prune_notification_fanout_jobs(timestamptz) from public, anon, authenticated, service_role;
drop function if exists public.admin_notification_fanout_health();
drop function if exists public.evaluate_notification_fanout_alerts(timestamptz);
drop function if exists public.prune_notification_fanout_jobs(timestamptz);
drop index if exists public.idx_notification_fanout_completed_retention;

-- Preserve operational_metric_buckets and operational_alerts for incident
-- reconstruction. A later reviewed retention operation may remove them.
