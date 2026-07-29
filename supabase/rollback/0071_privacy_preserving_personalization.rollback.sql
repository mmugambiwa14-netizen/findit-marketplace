-- 0071_privacy_preserving_personalization.rollback.sql
-- Non-destructive safety rollback. Existing preference and event data is retained,
-- but personalization is disabled and browser mutation privileges are revoked.

update public.recommendation_personalization_preferences
set
  enabled = false,
  disabled_at = now(),
  updated_at = now()
where enabled;

revoke execute on function public.get_my_recommendation_personalization_v1()
  from authenticated;
revoke execute on function public.set_my_recommendation_personalization_v1(boolean)
  from authenticated;
revoke execute on function public.clear_my_recommendation_personalization_data_v1()
  from authenticated;

alter table public.recommendation_personalization_preferences force row level security;
revoke all on public.recommendation_personalization_preferences
  from public, anon, authenticated;

update public.recommendation_service_policies
set
  enabled = false,
  updated_at = now()
where service_name = 'personalized_recommendation_service';

update public.marketplace_operational_controls
set
  state = 'phase_5_personalization_rolled_back_safe',
  configuration = configuration || jsonb_build_object(
    'schema_version', 71,
    'personalization_default_enabled', false,
    'personalization_requires_explicit_consent', true,
    'rollback_0071_data_retained', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
