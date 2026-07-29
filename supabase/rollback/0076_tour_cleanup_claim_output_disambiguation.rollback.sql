-- Non-destructive rollback capsule for 0076. Keep all Tour rows, queue jobs,
-- storage objects, and the corrected function, but close Peek before removing
-- reliance on the hosted-safe cleanup claim boundary.

update public.marketplace_feature_controls
set enabled = false, updated_at = now()
where feature_key = 'tours';

revoke all on function public.claim_tour_cleanup_jobs(integer, timestamptz)
  from public, anon, authenticated, service_role;
