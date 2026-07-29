-- 0063_contextual_ecosystem_intelligence.sql
-- Phase 3 foundation: explainable, deterministic orchestration of independent recommendation services.
-- This layer returns a service plan only. It never executes recommendation services or listing delivery paths.

create table if not exists public.recommendation_contexts (
  id uuid primary key default gen_random_uuid(),
  stable_key text not null unique check (stable_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  label text not null check (length(label) between 2 and 120),
  journey_stage text not null check (journey_stage in ('discover', 'evaluate', 'prepare', 'transact', 'own')),
  priority integer not null default 100 check (priority between 1 and 10000),
  is_active boolean not null default true,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recommendation_context_rules (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references public.recommendation_contexts(id) on delete cascade,
  source_node_id uuid references public.recommendation_taxonomy_nodes(id) on delete cascade,
  service_name text not null check (service_name in (
    'similar_listings_service',
    'seller_recommendations_service',
    'related_services_service',
    'related_products_service',
    'nearby_service',
    'recently_listed_service'
  )),
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_]{2,63}$'),
  priority integer not null default 100 check (priority between 1 and 10000),
  maximum_items integer not null default 6 check (maximum_items between 1 and 24),
  conditions jsonb not null default '{}'::jsonb check (jsonb_typeof(conditions) = 'object'),
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  unique (context_id, source_node_id, service_name, reason_code)
);

create index if not exists idx_recommendation_contexts_active_order
  on public.recommendation_contexts(journey_stage, priority, stable_key)
  where is_active;
create index if not exists idx_recommendation_context_rules_resolution
  on public.recommendation_context_rules(source_node_id, priority, service_name)
  where is_active;
create index if not exists idx_recommendation_context_rules_context
  on public.recommendation_context_rules(context_id, priority, service_name)
  where is_active;

alter table public.recommendation_contexts enable row level security;
alter table public.recommendation_context_rules enable row level security;
revoke all on public.recommendation_contexts from public, anon, authenticated, service_role;
revoke all on public.recommendation_context_rules from public, anon, authenticated, service_role;
grant select on public.recommendation_contexts to service_role;
grant select on public.recommendation_context_rules to service_role;

create trigger trg_recommendation_contexts_updated_at
  before update on public.recommendation_contexts
  for each row execute function public.set_updated_at();
create trigger trg_recommendation_context_rules_updated_at
  before update on public.recommendation_context_rules
  for each row execute function public.set_updated_at();

insert into public.recommendation_contexts (stable_key, label, journey_stage, priority)
values
  ('compare_options', 'Compare options', 'evaluate', 10),
  ('complete_purchase', 'Complete the purchase', 'prepare', 20),
  ('local_support', 'Find local support', 'prepare', 30),
  ('seller_inventory', 'More from this seller', 'evaluate', 40),
  ('market_freshness', 'Recently added', 'discover', 50)
on conflict (stable_key) do update set
  label = excluded.label,
  journey_stage = excluded.journey_stage,
  priority = excluded.priority;

insert into public.recommendation_context_rules (
  context_id, source_node_id, service_name, reason_code, priority, maximum_items
)
select context.id, null, rule.service_name, rule.reason_code, rule.priority, rule.maximum_items
from public.recommendation_contexts context
join (values
  ('compare_options', 'similar_listings_service', 'compare_similar_options', 10, 8),
  ('complete_purchase', 'related_products_service', 'complete_with_related_products', 20, 6),
  ('local_support', 'related_services_service', 'find_related_services', 30, 6),
  ('local_support', 'nearby_service', 'explore_nearby_options', 40, 6),
  ('seller_inventory', 'seller_recommendations_service', 'more_from_seller', 50, 6),
  ('market_freshness', 'recently_listed_service', 'recent_market_activity', 60, 6)
) as rule(context_key, service_name, reason_code, priority, maximum_items)
  on context.stable_key = rule.context_key
on conflict (context_id, source_node_id, service_name, reason_code) do update set
  priority = excluded.priority,
  maximum_items = excluded.maximum_items,
  is_active = true;

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

update public.marketplace_operational_controls
set
  state = 'phase_3_contextual_ecosystem_foundation_installed',
  configuration = configuration || jsonb_build_object(
    'schema_version', 63,
    'contextual_plan_contract', 'contextual_ecosystem_plan_v1',
    'orchestration_executes_services', false,
    'personalization_used', false,
    'listing_delivery_dependency', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on function public.contextual_ecosystem_plan_v1(uuid, text, integer)
  is 'Deterministic Phase 3 orchestration plan. Returns relevant independent service sections and stable reason codes without executing services or affecting listing delivery.';
