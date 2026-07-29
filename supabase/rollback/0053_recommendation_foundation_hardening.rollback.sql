-- 0053_recommendation_foundation_hardening.rollback.sql
-- Fail closed rather than restoring the less strict ingestion contract.

revoke all on function public.record_recommendation_event(text, uuid, uuid, uuid, uuid, text, text, jsonb) from anon, authenticated;
revoke all on function public.refresh_recommendation_popularity_daily(date) from service_role;

update public.marketplace_operational_controls
set
  enabled = false,
  state = 'hardening_rolled_back',
  updated_at = now()
where control_key in (
  'recommendation_event_collection',
  'recommendation_projection',
  'recommendation_retention'
);

alter table public.recommendation_events force row level security;
alter table public.recommendation_configuration_audit force row level security;
