-- 0057_recommendation_eligibility_geospatial_and_deletion_closure.rollback.sql
-- Fail closed while preserving projections, public geography, events and audit evidence.

revoke all on function public.refresh_listing_recommendation_feature(uuid)
  from service_role;
revoke all on function public.process_listing_recommendation_projection_jobs(integer, integer)
  from service_role;
revoke all on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb)
  from anon, authenticated;

drop trigger if exists trg_users_recommendation_eligibility on public.users;

update public.marketplace_operational_controls
set
  enabled = false,
  state = 'phase_1_closure_rolled_back',
  updated_at = now()
where control_key in (
  'recommendation_foundation',
  'recommendation_projection',
  'recommendation_event_collection',
  'recommendation_retention'
);

alter table public.listing_recommendation_features force row level security;
alter table public.recommendation_events force row level security;
alter table public.recommendation_events_default force row level security;
alter table public.recommendation_projection_jobs force row level security;
alter table public.recommendation_projection_dead_letters force row level security;
