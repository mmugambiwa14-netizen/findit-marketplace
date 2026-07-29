-- 0052_recommendation_taxonomy_weights_and_admin.rollback.sql
-- Non-destructive rollback: preserve configuration history and disable all active profiles.

revoke all on function public.admin_upsert_recommendation_taxonomy_node(text, text, text, uuid, jsonb, boolean) from authenticated;
revoke all on function public.admin_upsert_recommendation_relationship(uuid, uuid, text, numeric, text, boolean, timestamptz, timestamptz) from authenticated;
revoke all on function public.admin_upsert_recommendation_weight_profile(text, integer, text, jsonb, boolean) from authenticated;
revoke all on function public.admin_recommendation_configuration_snapshot() from authenticated;

update public.recommendation_weight_profiles
set is_active = false, updated_at = now()
where is_active;

update public.recommendation_relationships
set is_active = false, updated_at = now()
where is_active;

update public.recommendation_taxonomy_nodes
set is_active = false, updated_at = now()
where is_active;

alter table public.recommendation_weight_profiles force row level security;
alter table public.recommendation_configuration_audit force row level security;
alter table public.recommendation_taxonomy_nodes force row level security;
alter table public.recommendation_relationships force row level security;
