-- 0068_contextual_ecosystem_completion.sql
-- Phase 3 completion: listing-state, service-availability and location awareness,
-- explicit precedence, validated rule conditions, and an operational health surface.
--
-- The 0063 plan resolved rules from taxonomy scope alone. It proposed a section
-- whether or not the underlying service was enabled, whether or not the subject
-- carried the data that section needs, and treated a category-scoped rule and a
-- subcategory-scoped rule as equally specific. All four are closed here.
--
-- The layer still returns a plan only. It does not execute any recommendation
-- service, and nothing in listing delivery depends on it.

-- Closed condition vocabulary. A rule carrying an unknown key is inert rather than
-- silently universal, so a typo cannot widen a rule's reach.
create or replace function public.contextual_condition_keys_v1()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array[
    'requires_location',
    'requires_price',
    'requires_seller_inventory',
    'minimum_quality_score',
    'listing_statuses'
  ]::text[];
$$;

create or replace function public.contextual_conditions_valid_v1(p_conditions jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  condition_key text;
  condition_value jsonb;
  allowed_status_count integer;
begin
  if p_conditions is null or jsonb_typeof(p_conditions) <> 'object' then
    return false;
  end if;

  for condition_key, condition_value in select key, value from jsonb_each(p_conditions) loop
    if not (condition_key = any (public.contextual_condition_keys_v1())) then
      return false;
    end if;

    if condition_key in ('requires_location', 'requires_price', 'requires_seller_inventory') then
      if jsonb_typeof(condition_value) <> 'boolean' then
        return false;
      end if;
    elsif condition_key = 'minimum_quality_score' then
      if jsonb_typeof(condition_value) <> 'number'
        or (condition_value #>> '{}')::numeric < 0
        or (condition_value #>> '{}')::numeric > 1
      then
        return false;
      end if;
    elsif condition_key = 'listing_statuses' then
      if jsonb_typeof(condition_value) <> 'array' then
        return false;
      end if;
      select count(*) into allowed_status_count
      from jsonb_array_elements_text(condition_value) as status_value
      where status_value not in ('available', 'under_offer');
      if allowed_status_count > 0 then
        return false;
      end if;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.recommendation_context_rules
  drop constraint if exists recommendation_context_rules_conditions_vocabulary;
alter table public.recommendation_context_rules
  add constraint recommendation_context_rules_conditions_vocabulary
  check (public.contextual_conditions_valid_v1(conditions)) not valid;

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

  -- Listing-state signals. Only presence is tested; no coordinate, price or seller
  -- detail leaves this function.
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
    -- Service availability. A disabled service is never contextually relevant,
    -- because the section it would produce can only come back empty.
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
      -- Listing-state and location gates, evaluated from the closed vocabulary.
      and (coalesce((rule.conditions ->> 'requires_location')::boolean, false) is not true
        or subject_has_location)
      and (coalesce((rule.conditions ->> 'requires_price')::boolean, false) is not true
        or subject_has_price)
      and (coalesce((rule.conditions ->> 'requires_seller_inventory')::boolean, false) is not true
        or subject_has_seller_inventory)
      and (rule.conditions -> 'minimum_quality_score' is null
        or subject_row.quality_score >= (rule.conditions ->> 'minimum_quality_score')::numeric)
      and (rule.conditions -> 'listing_statuses' is null
        or subject_row.listing_status in (
          select status_value from jsonb_array_elements_text(rule.conditions -> 'listing_statuses') as status_value
        ))
  ),
  -- Conflict resolution: one section per service, most specific rule wins.
  -- Subcategory beats category, category beats global, and every remaining tie is
  -- broken deterministically so the same subject always yields the same plan.
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

-- Operational health for the contextual layer, mirroring the recommendation service
-- health surface. Counts and timestamps only: no listing, seller or viewer identity.
create or replace function public.contextual_ecosystem_health_v1()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'contractVersion', 1,
    'generatedAt', now(),
    'activeContexts', (
      select count(*) from public.recommendation_contexts context where context.is_active
    ),
    'activeRules', (
      select count(*) from public.recommendation_context_rules rule
      where rule.is_active
        and rule.valid_from <= now()
        and (rule.valid_until is null or rule.valid_until > now())
    ),
    'scheduledRules', (
      select count(*) from public.recommendation_context_rules rule
      where rule.is_active and rule.valid_from > now()
    ),
    'expiredRules', (
      select count(*) from public.recommendation_context_rules rule
      where rule.valid_until is not null and rule.valid_until <= now()
    ),
    'rulesReferencingDisabledServices', (
      select count(*)
      from public.recommendation_context_rules rule
      join public.recommendation_service_policies policy
        on policy.service_name = rule.service_name
      where rule.is_active and not policy.enabled
    ),
    'globalRules', (
      select count(*) from public.recommendation_context_rules rule
      where rule.is_active and rule.source_node_id is null
    ),
    'scopedRules', (
      select count(*) from public.recommendation_context_rules rule
      where rule.is_active and rule.source_node_id is not null
    ),
    'lastConfigurationChangeAt', (
      select max(audit.created_at) from public.recommendation_configuration_audit audit
      where audit.entity_type in ('context', 'context_rule')
    )
  );
$$;

revoke all on function public.contextual_condition_keys_v1() from public, anon, authenticated;
revoke all on function public.contextual_conditions_valid_v1(jsonb) from public, anon, authenticated;
revoke all on function public.contextual_ecosystem_health_v1() from public, anon, authenticated;
revoke all on function public.contextual_ecosystem_plan_v1(uuid, text, integer) from public, anon, authenticated;

grant execute on function public.contextual_condition_keys_v1() to service_role;
grant execute on function public.contextual_conditions_valid_v1(jsonb) to service_role;
grant execute on function public.contextual_ecosystem_health_v1() to service_role;
grant execute on function public.contextual_ecosystem_plan_v1(uuid, text, integer) to service_role;

update public.marketplace_operational_controls
set
  state = 'phase_3_contextual_ecosystem_complete',
  configuration = configuration || jsonb_build_object(
    'schema_version', 68,
    'contextual_plan_contract_version', 2,
    'contextual_listing_state_aware', true,
    'contextual_service_availability_aware', true,
    'contextual_location_aware', true,
    'contextual_precedence', 'subcategory_then_category_then_global',
    'contextual_conditions_validated', true,
    'contextual_health_contract', 'contextual_ecosystem_health_v1',
    'orchestration_executes_services', false,
    'listing_delivery_dependency', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.contextual_ecosystem_plan_v1(uuid, text, integer)
  is 'Deterministic Phase 3 plan. Selects sections by journey stage, taxonomy precedence, listing state and service availability, and returns stable reason codes without executing services.';
comment on function public.contextual_ecosystem_health_v1()
  is 'Operational counts for the contextual layer. Contains no listing, seller or viewer identity.';
