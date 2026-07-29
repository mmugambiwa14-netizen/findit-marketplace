-- 0051_recommendation_projection_ingestion_and_retention.rollback.sql
-- Non-destructive rollback: stop ingestion/projection workers and preserve all evidence.

revoke all on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb) from anon, authenticated;
revoke all on function public.refresh_listing_recommendation_feature(uuid) from service_role;
revoke all on function public.refresh_listing_recommendation_features_batch(uuid, integer) from service_role;
revoke all on function public.ensure_recommendation_event_partition(date) from service_role;
revoke all on function public.refresh_recommendation_popularity_daily(date) from service_role;
revoke all on function public.purge_expired_recommendation_data(integer) from service_role;

drop trigger if exists trg_listings_recommendation_projection on public.listings;
drop trigger if exists trg_car_details_recommendation_projection on public.car_details;
drop trigger if exists trg_property_details_recommendation_projection on public.property_details;
drop trigger if exists trg_machinery_details_recommendation_projection on public.machinery_details;

update public.marketplace_operational_controls
set
  enabled = false,
  state = 'rolled_back',
  updated_at = now()
where control_key in (
  'recommendation_projection',
  'recommendation_event_collection',
  'recommendation_retention'
);

alter table public.recommendation_events force row level security;
alter table public.recommendation_events_default force row level security;
alter table public.listing_recommendation_features force row level security;
alter table public.recommendation_cache force row level security;
alter table public.recommendation_popularity_daily force row level security;
