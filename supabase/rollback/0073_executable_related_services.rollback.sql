-- Non-destructive rollback capsule for 0073.
-- Disable the affected policy and remove browser event execution while
-- retaining service data, aggregate events, and operational evidence.

update public.recommendation_service_policies
set enabled = false, updated_at = now()
where service_name = 'related_services_service';

revoke all on function public.related_services_service_v1(uuid, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.record_recommended_service_event_v1(
  text, uuid, uuid, uuid, text, text, jsonb
) from public, anon, authenticated, service_role;

alter table public.recommendation_events enable row level security;
alter table public.recommendation_events force row level security;
