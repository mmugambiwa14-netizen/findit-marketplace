-- Non-destructive rollback capsule for 0072.
-- Retain aggregate evidence while disabling refresh and browser reporting.

update public.marketplace_operational_controls
set
  enabled = false,
  state = 'rollback_disabled',
  updated_at = now()
where control_key = 'recommendation_analytics';

revoke all on function public.refresh_recommendation_service_metrics_daily_v1(date)
  from public, anon, authenticated, service_role;
revoke all on function public.purge_recommendation_service_metrics_v1(date, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_recommendation_analytics_v1(date, date)
  from public, anon, authenticated, service_role;
revoke all on function public.recommendation_analytics_health_v1()
  from public, anon, authenticated, service_role;

alter table public.recommendation_service_metrics_daily enable row level security;
alter table public.recommendation_service_metrics_daily force row level security;
revoke all on public.recommendation_service_metrics_daily
  from public, anon, authenticated, service_role;
