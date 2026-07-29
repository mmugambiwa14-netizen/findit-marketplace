-- 0058_recommendation_publication_fail_open_closure.rollback.sql
-- Fail closed while preserving all projections, events and queue evidence.

revoke all on public.eligible_listing_recommendation_features
  from service_role;
revoke all on function public.process_listing_recommendation_projection_jobs(integer, integer)
  from service_role;
revoke all on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb)
  from anon, authenticated;

update public.marketplace_operational_controls
set
  enabled = false,
  state = 'publication_closure_rolled_back',
  updated_at = now()
where control_key in (
  'recommendation_foundation',
  'recommendation_projection',
  'recommendation_event_collection'
);

alter table public.listing_recommendation_features force row level security;
alter table public.recommendation_events force row level security;
alter table public.recommendation_events_default force row level security;
