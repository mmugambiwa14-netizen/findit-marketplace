-- Deactivate the listing-detail related-services context without deleting
-- historical configuration or attribution.

update public.recommendation_context_rules rule
set
  is_active = false,
  valid_until = greatest(now(), rule.valid_from + interval '1 millisecond'),
  updated_at = now()
from public.recommendation_contexts context
where context.id = rule.context_id
  and context.stable_key = 'listing_support'
  and rule.service_name = 'related_services_service'
  and rule.reason_code = 'services_for_listing';

update public.recommendation_contexts
set is_active = false, updated_at = now()
where stable_key = 'listing_support';

update public.marketplace_operational_controls
set
  state = 'phase_3_contextual_ecosystem',
  configuration = configuration - 'evaluate_related_services',
  updated_at = now()
where control_key = 'recommendation_contextual_ecosystem';
