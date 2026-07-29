-- 0056_recommendation_projection_queue.rollback.sql
-- Non-destructive rollback: stop queue ingestion and workers while preserving
-- pending jobs, dead letters, projected rows and operational evidence.

revoke all on function public.enqueue_listing_recommendation_projection(uuid) from service_role;
revoke all on function public.process_listing_recommendation_projection_jobs(integer, integer) from service_role;
revoke all on function public.retry_recommendation_projection_dead_letter(bigint) from service_role;

drop trigger if exists trg_listings_recommendation_projection on public.listings;
drop trigger if exists trg_car_details_recommendation_projection on public.car_details;
drop trigger if exists trg_property_details_recommendation_projection on public.property_details;
drop trigger if exists trg_machinery_details_recommendation_projection on public.machinery_details;

update public.marketplace_operational_controls
set
  enabled = false,
  state = 'projection_queue_rolled_back',
  updated_at = now()
where control_key = 'recommendation_projection';

alter table public.recommendation_projection_jobs force row level security;
alter table public.recommendation_projection_dead_letters force row level security;
alter table public.listing_recommendation_features force row level security;
