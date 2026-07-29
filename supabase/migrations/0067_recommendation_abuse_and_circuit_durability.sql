-- 0067_recommendation_abuse_and_circuit_durability.sql
-- Durable circuit-breaker state and bounded abuse controls for the recommendation services.
--
-- The Edge runtime held circuit-breaker state in a module-level map inside a Deno
-- isolate. Edge Functions run many isolates and recycle them, so every cold isolate
-- started with a clean breaker and the failure threshold rarely engaged. State now
-- lives in the database, and is read on the same call that already fetches the
-- service policy so the hot path gains no extra round trip.
--
-- The services also had no abuse control of any kind. Each unauthenticated request
-- triggers a database RPC, and the cache key includes the page size, so distinct
-- request shapes could grow the cache without bound. A windowed request budget
-- keyed by an opaque client hash bounds both.

create table if not exists public.recommendation_service_circuit_state (
  service_name text primary key
    references public.recommendation_service_policies(service_name) on delete cascade,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  open_until timestamptz,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  updated_at timestamptz not null default now()
);

-- The client hash is a salted digest computed in the Edge runtime. No address, no
-- header value and no account identifier is ever stored here.
create table if not exists public.recommendation_request_budget (
  client_hash text not null check (client_hash ~ '^[0-9a-f]{64}$'),
  service_name text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (client_hash, service_name, window_started_at)
);

create index if not exists idx_recommendation_request_budget_window
  on public.recommendation_request_budget(window_started_at);
create index if not exists idx_recommendation_service_circuit_open
  on public.recommendation_service_circuit_state(open_until)
  where open_until is not null;

alter table public.recommendation_service_circuit_state enable row level security;
alter table public.recommendation_request_budget enable row level security;
revoke all on public.recommendation_service_circuit_state from public, anon, authenticated, service_role;
revoke all on public.recommendation_request_budget from public, anon, authenticated, service_role;

create trigger trg_recommendation_service_circuit_state_updated_at
  before update on public.recommendation_service_circuit_state
  for each row execute function public.set_updated_at();

insert into public.recommendation_service_circuit_state (service_name)
select policy.service_name from public.recommendation_service_policies policy
on conflict (service_name) do nothing;

-- Policy and circuit state in one read, so enforcing the breaker costs nothing extra
-- on the request path.
create or replace function public.recommendation_service_runtime_state_v1(p_service_name text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'serviceName', policy.service_name,
    'contractVersion', policy.contract_version,
    'enabled', policy.enabled,
    'timeoutMs', policy.timeout_ms,
    'cacheFreshSeconds', policy.cache_fresh_seconds,
    'cacheStaleSeconds', policy.cache_stale_seconds,
    'maximumPageSize', policy.maximum_page_size,
    'configuration', policy.configuration,
    'updatedAt', policy.updated_at,
    'circuitOpen', coalesce(circuit.open_until > now(), false),
    'consecutiveFailures', coalesce(circuit.consecutive_failures, 0),
    'requestBudgetPerWindow', greatest(1, least(
      coalesce((policy.configuration ->> 'request_budget_per_window')::integer, 120), 10000)),
    'requestBudgetWindowSeconds', greatest(1, least(
      coalesce((policy.configuration ->> 'request_budget_window_seconds')::integer, 60), 3600))
  )
  from public.recommendation_service_policies policy
  left join public.recommendation_service_circuit_state circuit
    on circuit.service_name = policy.service_name
  where policy.service_name = p_service_name;
$$;

-- Recording an outcome is idempotent per call and never raises into the request path.
create or replace function public.record_recommendation_service_outcome_v1(
  p_service_name text,
  p_succeeded boolean,
  p_failure_threshold integer default 3,
  p_open_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bounded_threshold integer := greatest(1, least(coalesce(p_failure_threshold, 3), 100));
  bounded_open_seconds integer := greatest(1, least(coalesce(p_open_seconds, 30), 3600));
  resulting_failures integer;
begin
  if p_service_name is null or p_succeeded is null then
    return false;
  end if;

  if not exists (
    select 1 from public.recommendation_service_policies policy
    where policy.service_name = p_service_name
  ) then
    return false;
  end if;

  if p_succeeded then
    insert into public.recommendation_service_circuit_state as circuit (
      service_name, consecutive_failures, open_until, last_success_at
    )
    values (p_service_name, 0, null, now())
    on conflict (service_name) do update set
      consecutive_failures = 0,
      open_until = null,
      last_success_at = now();
    return true;
  end if;

  insert into public.recommendation_service_circuit_state as circuit (
    service_name, consecutive_failures, last_failure_at
  )
  values (p_service_name, 1, now())
  on conflict (service_name) do update set
    consecutive_failures = circuit.consecutive_failures + 1,
    last_failure_at = now(),
    open_until = case
      when circuit.consecutive_failures + 1 >= bounded_threshold
        then now() + make_interval(secs => bounded_open_seconds)
      else circuit.open_until
    end
  returning circuit.consecutive_failures into resulting_failures;

  return coalesce(resulting_failures, 0) >= bounded_threshold;
end;
$$;

-- Returns true when the request is within budget. Fails open on any internal error:
-- an abuse control must never be the reason a listing page loses its sections.
create or replace function public.consume_recommendation_request_budget_v1(
  p_client_hash text,
  p_service_name text,
  p_budget integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bounded_budget integer := greatest(1, least(coalesce(p_budget, 120), 10000));
  bounded_window integer := greatest(1, least(coalesce(p_window_seconds, 60), 3600));
  window_start timestamptz;
  observed_count integer;
begin
  if p_client_hash is null or p_client_hash !~ '^[0-9a-f]{64}$' or p_service_name is null then
    return true;
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from now()) / bounded_window) * bounded_window
  );

  insert into public.recommendation_request_budget as budget (
    client_hash, service_name, window_started_at, request_count
  )
  values (p_client_hash, p_service_name, window_start, 1)
  on conflict (client_hash, service_name, window_started_at) do update set
    request_count = budget.request_count + 1,
    updated_at = now()
  returning budget.request_count into observed_count;

  return coalesce(observed_count, 1) <= bounded_budget;
exception when others then
  return true;
end;
$$;

-- Bounded purge, consistent with the existing cache purge. Never deletes the current
-- window, so an in-flight budget is not reset by maintenance.
create or replace function public.purge_recommendation_request_budget_v1(p_maximum_rows integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  bounded_rows integer := greatest(1, least(coalesce(p_maximum_rows, 5000), 50000));
  removed_rows integer;
begin
  with expired as (
    select budget.client_hash, budget.service_name, budget.window_started_at
    from public.recommendation_request_budget budget
    where budget.window_started_at < now() - interval '2 hours'
    order by budget.window_started_at
    limit bounded_rows
  )
  delete from public.recommendation_request_budget target
  using expired
  where target.client_hash = expired.client_hash
    and target.service_name = expired.service_name
    and target.window_started_at = expired.window_started_at;

  get diagnostics removed_rows = row_count;
  return coalesce(removed_rows, 0);
end;
$$;

revoke all on function public.recommendation_service_runtime_state_v1(text)
  from public, anon, authenticated;
revoke all on function public.record_recommendation_service_outcome_v1(text, boolean, integer, integer)
  from public, anon, authenticated;
revoke all on function public.consume_recommendation_request_budget_v1(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.purge_recommendation_request_budget_v1(integer)
  from public, anon, authenticated;

grant execute on function public.recommendation_service_runtime_state_v1(text) to service_role;
grant execute on function public.record_recommendation_service_outcome_v1(text, boolean, integer, integer) to service_role;
grant execute on function public.consume_recommendation_request_budget_v1(text, text, integer, integer) to service_role;
grant execute on function public.purge_recommendation_request_budget_v1(integer) to service_role;

update public.marketplace_operational_controls
set
  configuration = configuration || jsonb_build_object(
    'schema_version', 67,
    'durable_circuit_breaker', true,
    'request_budget_enforced', true,
    'request_budget_stores_client_address', false
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on table public.recommendation_service_circuit_state
  is 'Durable per-service circuit-breaker state. Replaces per-isolate memory, which reset on every cold start.';
comment on table public.recommendation_request_budget
  is 'Windowed request budget keyed by an opaque salted client hash. Stores no address, header value or account identifier.';
comment on function public.consume_recommendation_request_budget_v1(text, text, integer, integer)
  is 'Consumes one unit of request budget. Fails open so an abuse control can never remove sections from a listing page.';
