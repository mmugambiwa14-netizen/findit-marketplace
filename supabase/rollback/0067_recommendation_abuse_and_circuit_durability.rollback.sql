-- 0067_recommendation_abuse_and_circuit_durability.rollback.sql
-- Revert to the pre-0067 runtime contract.
--
-- Non-destructive: the circuit-state and request-budget tables are retained with
-- their rows intact, and only the functions added by 0067 are withdrawn. Reverting
-- returns the runtime to per-isolate circuit state and no request budget, so the
-- Edge runtime must be redeployed to its matching revision at the same time.

drop function if exists public.recommendation_service_runtime_state_v1(text);
drop function if exists public.record_recommendation_service_outcome_v1(text, boolean, integer, integer);
drop function if exists public.consume_recommendation_request_budget_v1(text, text, integer, integer);
drop function if exists public.purge_recommendation_request_budget_v1(integer);

-- The tables stay in place. They hold operational evidence, and the retention rule
-- for the budget window is enforced by the purge routine rather than by rollback.
revoke all on public.recommendation_service_circuit_state from public, anon, authenticated, service_role;
revoke all on public.recommendation_request_budget from public, anon, authenticated, service_role;

update public.marketplace_operational_controls
set
  configuration = configuration || jsonb_build_object(
    'schema_version', 66,
    'durable_circuit_breaker', false,
    'request_budget_enforced', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';
