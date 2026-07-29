-- 0050_recommendation_data_foundation.rollback.sql
-- Non-destructive rollback: disable customer visibility and writes while preserving evidence.

revoke all on public.recommendation_taxonomy_nodes from anon, authenticated;
revoke all on public.recommendation_relationships from anon, authenticated;
revoke all on public.listing_recommendation_features from anon, authenticated;
revoke all on public.recommendation_events from anon, authenticated;
revoke all on public.recommendation_cache from anon, authenticated;
revoke all on public.recommendation_popularity_daily from anon, authenticated;

alter table public.recommendation_taxonomy_nodes force row level security;
alter table public.recommendation_relationships force row level security;
alter table public.listing_recommendation_features force row level security;
alter table public.recommendation_events force row level security;
alter table public.recommendation_events_default force row level security;
alter table public.recommendation_cache force row level security;
alter table public.recommendation_popularity_daily force row level security;

update public.recommendation_taxonomy_nodes set is_active = false where is_active;
update public.recommendation_relationships set is_active = false where is_active;