-- 0068_contextual_ecosystem_completion.rollback.sql
-- Restore the 0063 orchestration behaviour.
--
-- Non-destructive: no context, rule, audit record or configuration row is removed.
-- The plan function reverts to taxonomy-scope resolution without listing-state,
-- service-availability or location awareness, the condition vocabulary stops being
-- enforced, and the contextual health surface is withdrawn.

alter table public.recommendation_context_rules
  drop constraint if exists recommendation_context_rules_conditions_vocabulary;

drop function if exists public.contextual_ecosystem_health_v1();

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
begin
  if p_subject_listing_id is null then
    raise exception 'subject listing is required' using errcode = '22023';
  end if;
  if p_journey_stage is not null and p_journey_stage not in ('discover', 'evaluate', 'prepare', 'transact', 'own') then
    raise exception 'invalid journey stage' using errcode = '22023';
  end if;

  select * into subject_row
  from public.eligible_listing_recommendation_features
  where listing_id = p_subject_listing_id;

  if not found then
    return jsonb_build_object(
      'contractVersion', 1,
      'requestId', request_id,
      'subjectListingId', p_subject_listing_id,
      'sections', '[]'::jsonb,
      'degraded', false,
      'reason', 'subject_not_eligible'
    );
  end if;

  with subject_nodes as (
    select node.id
    from public.recommendation_taxonomy_nodes node
    where node.is_active
      and node.stable_key in (subject_row.category_key, subject_row.subcategory_key)
  ),
  resolved as (
    select distinct on (rule.service_name)
      context.stable_key as context_key,
      context.label,
      context.journey_stage,
      rule.service_name,
      rule.reason_code,
      rule.maximum_items,
      context.priority as context_priority,
      rule.priority as rule_priority,
      rule.id
    from public.recommendation_context_rules rule
    join public.recommendation_contexts context
      on context.id = rule.context_id
     and context.is_active
    where rule.is_active
      and rule.valid_from <= now()
      and (rule.valid_until is null or rule.valid_until > now())
      and (p_journey_stage is null or context.journey_stage = p_journey_stage)
      and (rule.source_node_id is null or rule.source_node_id in (select id from subject_nodes))
    order by rule.service_name,
      case when rule.source_node_id is null then 1 else 0 end,
      rule.priority,
      context.priority,
      rule.id
  ),
  ordered as (
    select * from resolved
    order by context_priority, rule_priority, service_name
    limit bounded_sections
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'contextKey', context_key,
    'label', label,
    'journeyStage', journey_stage,
    'service', service_name,
    'reasonCode', reason_code,
    'maximumItems', maximum_items
  ) order by context_priority, rule_priority, service_name), '[]'::jsonb)
  into result_sections
  from ordered;

  return jsonb_build_object(
    'contractVersion', 1,
    'requestId', request_id,
    'subjectListingId', p_subject_listing_id,
    'categoryKey', subject_row.category_key,
    'subcategoryKey', subject_row.subcategory_key,
    'sections', result_sections,
    'degraded', false
  );
exception when query_canceled then
  return jsonb_build_object(
    'contractVersion', 1,
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

-- The vocabulary helpers are retained. They are pure and referenced by nothing once
-- the constraint is dropped, and keeping them avoids a dependency failure if the
-- rollback is replayed.

update public.marketplace_operational_controls
set
  state = 'phase_3_contextual_ecosystem_foundation_installed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 67,
    'contextual_plan_contract_version', 1,
    'contextual_listing_state_aware', false,
    'contextual_service_availability_aware', false,
    'contextual_location_aware', false,
    'contextual_conditions_validated', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
