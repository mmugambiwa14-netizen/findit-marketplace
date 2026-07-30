drop function if exists public.ensure_listing_recommendation_feature_v1(uuid);

update public.marketplace_operational_controls
set
  state = 'asynchronous',
  configuration = configuration - 'detail_safeguard' - 'normal_path' - 'listing_dependency',
  updated_at = now()
where control_key = 'recommendation_projection';
