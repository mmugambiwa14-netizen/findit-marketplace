-- 0064_contextual_rule_identity_and_admin.sql
-- Harden global-rule identity and provide audited admin configuration.

alter table public.recommendation_context_rules
  drop constraint if exists recommendation_context_rules_context_id_source_node_id_service_name_reason_code_key;

create unique index if not exists idx_recommendation_context_rules_identity
  on public.recommendation_context_rules
  (context_id, source_node_id, service_name, reason_code) nulls not distinct;

alter table public.recommendation_configuration_audit
  drop constraint if exists recommendation_configuration_audit_entity_type_check;
alter table public.recommendation_configuration_audit
  add constraint recommendation_configuration_audit_entity_type_check
  check (entity_type in ('taxonomy_node', 'relationship', 'weight_profile', 'service_policy', 'context', 'context_rule'));

create or replace function public.admin_upsert_recommendation_context_rule_v1(
  p_context_key text,
  p_source_node_id uuid,
  p_service_name text,
  p_reason_code text,
  p_priority integer,
  p_maximum_items integer,
  p_conditions jsonb default '{}'::jsonb,
  p_is_active boolean default true,
  p_valid_from timestamptz default now(),
  p_valid_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  context_row public.recommendation_contexts%rowtype;
  rule_id uuid;
  before_value jsonb;
  after_value jsonb;
  action_value text;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  select * into context_row
  from public.recommendation_contexts
  where stable_key = p_context_key;

  if not found
    or p_service_name not in (
      'similar_listings_service', 'seller_recommendations_service',
      'related_services_service', 'related_products_service',
      'nearby_service', 'recently_listed_service'
    )
    or p_reason_code !~ '^[a-z][a-z0-9_]{2,63}$'
    or p_priority not between 1 and 10000
    or p_maximum_items not between 1 and 24
    or jsonb_typeof(coalesce(p_conditions, 'null'::jsonb)) <> 'object'
    or octet_length(coalesce(p_conditions, '{}'::jsonb)::text) > 4096
    or p_valid_from is null
    or (p_valid_until is not null and p_valid_until <= p_valid_from)
    or (p_source_node_id is not null and not exists (
      select 1 from public.recommendation_taxonomy_nodes where id = p_source_node_id
    ))
  then
    raise exception 'invalid contextual recommendation rule' using errcode = '22023';
  end if;

  select rule.id, to_jsonb(rule)
  into rule_id, before_value
  from public.recommendation_context_rules rule
  where rule.context_id = context_row.id
    and rule.source_node_id is not distinct from p_source_node_id
    and rule.service_name = p_service_name
    and rule.reason_code = p_reason_code
  for update;

  insert into public.recommendation_context_rules (
    context_id, source_node_id, service_name, reason_code, priority,
    maximum_items, conditions, is_active, valid_from, valid_until
  ) values (
    context_row.id, p_source_node_id, p_service_name, p_reason_code, p_priority,
    p_maximum_items, coalesce(p_conditions, '{}'::jsonb), p_is_active,
    p_valid_from, p_valid_until
  )
  on conflict (context_id, source_node_id, service_name, reason_code) do update set
    priority = excluded.priority,
    maximum_items = excluded.maximum_items,
    conditions = excluded.conditions,
    is_active = excluded.is_active,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until
  returning id, to_jsonb(recommendation_context_rules.*)
  into rule_id, after_value;

  action_value := case
    when before_value is null then 'create'
    when coalesce((before_value ->> 'is_active')::boolean, false) is distinct from p_is_active
      then case when p_is_active then 'activate' else 'deactivate' end
    else 'update'
  end;

  insert into public.recommendation_configuration_audit (
    actor_id, entity_type, entity_id, action, before_state, after_state
  ) values (
    auth.uid(), 'context_rule', rule_id, action_value, before_value, after_value
  );

  perform public.write_audit_log(
    'recommendation.context_rule.' || action_value,
    rule_id,
    'recommendation_context_rule'
  );

  return rule_id;
end;
$$;

revoke all on function public.admin_upsert_recommendation_context_rule_v1(
  text, uuid, text, text, integer, integer, jsonb, boolean, timestamptz, timestamptz
) from public, anon, service_role;
grant execute on function public.admin_upsert_recommendation_context_rule_v1(
  text, uuid, text, text, integer, integer, jsonb, boolean, timestamptz, timestamptz
) to authenticated;

update public.marketplace_operational_controls
set configuration = configuration || jsonb_build_object(
  'schema_version', 64,
  'context_rule_null_identity', true,
  'audited_context_rule_admin', true
), updated_at = now()
where control_key = 'recommendation_foundation';
