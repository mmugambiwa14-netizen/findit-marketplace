-- 0070_contextual_listing_status_type_safety.sql
-- The contextual planner compares a listing_status enum with condition values
-- extracted from JSON as text. PostgreSQL does not provide an enum = text operator,
-- so every eligible subject reached a runtime error even when no status condition
-- was configured. Cast the trusted enum value to text at that closed boundary.

create or replace function public.contextual_ecosystem_plan_v1(
  p_subject_listing_id uuid,
  p_journey_stage text default null,
  p_max_sections integer default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  subject_row record;
  bounded_sections integer := greatest(1, least(coalesce(p_max_sections, 6), 12));
  request_id uuid := gen_random_uuid();
  result_sections jsonb := '[]'::jsonb;
  subject_has_location boolean;
  subject_has_price boolean;
  subject_has_seller_inventory boolean;
begin
  if p_subject_listing_id is null then
    raise exception 'subject listing is required' using errcode = '22023';
  end if;
  if p_journey_stage is not null and p_journey_stage not in ('discover', 'evaluate', 'prepare', 'transact', 'own') then
    raise exception 'invalid journey stage' using errcode = '22023';
  end if;

  select feature.*, listing.status as listing_status
  into subject_row
  from public.eligible_listing_recommendation_features feature
  join public.listings listing on listing.id = feature.listing_id
  where feature.listing_id = p_subject_listing_id;

  if not found then
    return jsonb_build_object(
      'contractVersion', 2,
      'requestId', request_id,
      'subjectListingId', p_subject_listing_id,
      'sections', '[]'::jsonb,
      'degraded', false,
      'reason', 'subject_not_eligible'
    );
  end if;

  subject_has_location := subject_row.location_key is not null or subject_row.country_code is not null;
  subject_has_price := subject_row.price_amount is not null;
  subject_has_seller_inventory := exists (
    select 1
    from public.eligible_listing_recommendation_features sibling
    where sibling.seller_id = subject_row.seller_id
      and sibling.listing_id <> subject_row.listing_id
    limit 1
  );

  with subject_nodes as (
    select
      node.id,
      case
        when node.node_type = 'subcategory' and node.stable_key = subject_row.subcategory_key then 0
        when node.node_type = 'category' and node.stable_key = subject_row.category_key then 1
        else 2
      end as specificity
    from public.recommendation_taxonomy_nodes node
    where node.is_active
      and (
        (node.node_type = 'subcategory' and node.stable_key = subject_row.subcategory_key)
        or (node.node_type = 'category' and node.stable_key = subject_row.category_key)
      )
  ),
  candidate as (
    select
      context.stable_key as context_key,
      context.label,
      context.journey_stage,
      rule.service_name,
      rule.reason_code,
      rule.maximum_items,
      context.priority as context_priority,
      rule.priority as rule_priority,
      rule.id as rule_id,
      coalesce(subject_node.specificity, 2) as specificity,
      rule.conditions
    from public.recommendation_context_rules rule
    join public.recommendation_contexts context
      on context.id = rule.context_id
     and context.is_active
    join public.recommendation_service_policies policy
      on policy.service_name = rule.service_name
     and policy.enabled
    left join subject_nodes subject_node
      on subject_node.id = rule.source_node_id
    where rule.is_active
      and rule.valid_from <= now()
      and (rule.valid_until is null or rule.valid_until > now())
      and (p_journey_stage is null or context.journey_stage = p_journey_stage)
      and (rule.source_node_id is null or subject_node.id is not null)
      and (coalesce((rule.conditions ->> 'requires_location')::boolean, false) is not true
        or subject_has_location)
      and (coalesce((rule.conditions ->> 'requires_price')::boolean, false) is not true
        or subject_has_price)
      and (coalesce((rule.conditions ->> 'requires_seller_inventory')::boolean, false) is not true
        or subject_has_seller_inventory)
      and (rule.conditions -> 'minimum_quality_score' is null
        or subject_row.quality_score >= (rule.conditions ->> 'minimum_quality_score')::numeric)
      and (rule.conditions -> 'listing_statuses' is null
        or subject_row.listing_status::text in (
          select status_value
          from jsonb_array_elements_text(rule.conditions -> 'listing_statuses') as status_value
        ))
  ),
  resolved as (
    select distinct on (candidate.service_name) candidate.*
    from candidate
    order by candidate.service_name, candidate.specificity, candidate.rule_priority,
      candidate.context_priority, candidate.rule_id
  ),
  ordered as (
    select resolved.*
    from resolved
    order by resolved.context_priority, resolved.rule_priority, resolved.service_name
    limit bounded_sections
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'contextKey', ordered.context_key,
    'label', ordered.label,
    'journeyStage', ordered.journey_stage,
    'service', ordered.service_name,
    'reasonCode', ordered.reason_code,
    'maximumItems', ordered.maximum_items,
    'precedence', case ordered.specificity when 0 then 'subcategory' when 1 then 'category' else 'global' end
  ) order by ordered.context_priority, ordered.rule_priority, ordered.service_name), '[]'::jsonb)
  into result_sections
  from ordered;

  return jsonb_build_object(
    'contractVersion', 2,
    'requestId', request_id,
    'subjectListingId', p_subject_listing_id,
    'categoryKey', subject_row.category_key,
    'subcategoryKey', subject_row.subcategory_key,
    'sections', result_sections,
    'degraded', false
  );
exception when query_canceled then
  return jsonb_build_object(
    'contractVersion', 2,
    'requestId', request_id,
    'subjectListingId', p_subject_listing_id,
    'sections', '[]'::jsonb,
    'degraded', true,
    'reason', 'timeout'
  );
end;
$$;

revoke all on function public.contextual_ecosystem_plan_v1(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.contextual_ecosystem_plan_v1(uuid, text, integer)
  to service_role;

update public.marketplace_operational_controls
set
  configuration = configuration || jsonb_build_object(
    'schema_version', 70,
    'contextual_listing_status_type_safe', true
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.contextual_ecosystem_plan_v1(uuid, text, integer)
  is 'Deterministic Phase 3 planner with type-safe closed-vocabulary listing status conditions.';
