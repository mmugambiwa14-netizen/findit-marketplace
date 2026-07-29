-- 0054_recommendation_foundation_certification_corrections.rollback.sql
-- Fail closed while preserving projections, events, aggregates and configuration evidence.

revoke all on function public.refresh_listing_recommendation_features_batch(uuid, integer) from service_role;
revoke all on function public.refresh_recommendation_popularity_daily(date) from service_role;
revoke all on function public.recommendation_foundation_health() from service_role;

update public.marketplace_operational_controls
set
  enabled = false,
  state = 'certification_corrections_rolled_back',
  updated_at = now()
where control_key in (
  'recommendation_foundation',
  'recommendation_projection',
  'recommendation_event_collection',
  'recommendation_retention'
);

alter table public.listing_recommendation_features force row level security;
alter table public.recommendation_events force row level security;
alter table public.recommendation_cache force row level security;
alter table public.recommendation_popularity_daily force row level security;
