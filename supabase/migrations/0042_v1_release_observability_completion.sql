-- 0042_v1_release_observability_completion.sql
-- Completes bounded notification fan-out observability and retention without
-- adding a raw per-user event stream or forcing founder dashboard scans.

create index if not exists idx_notification_fanout_completed_retention
  on public.essential_notification_fanout_jobs(completed_at, id)
  where state = 'completed';

create or replace function public.evaluate_notification_fanout_alerts(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dead_letters numeric := 0;
  pending_jobs numeric := 0;
  claimed_jobs numeric := 0;
  stale_claims numeric := 0;
  oldest_pending_seconds numeric := 0;
  window_start timestamptz := p_now - interval '1 hour';
  snapshot_bucket timestamptz := date_trunc('hour', p_now);
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select
    count(*) filter (where state = 'dead_lettered')::numeric,
    count(*) filter (where state = 'pending')::numeric,
    count(*) filter (where state = 'claimed')::numeric,
    count(*) filter (
      where state = 'claimed' and claimed_at < p_now - interval '10 minutes'
    )::numeric,
    coalesce(max(extract(epoch from (p_now - created_at))) filter (
      where state in ('pending', 'claimed')
    ), 0)::numeric
  into dead_letters, pending_jobs, claimed_jobs, stale_claims, oldest_pending_seconds
  from public.essential_notification_fanout_jobs
  where state <> 'completed';

  -- These are gauge snapshots, not event counters. Update the current UTC-hour
  -- bucket in place so dashboard reads remain constant-time and retention stays
  -- bounded even when the evaluator runs every ten minutes.
  insert into public.operational_metric_buckets (
    bucket_start, metric_name, dimension, sample_count, value_sum,
    value_max, last_value, metadata, first_recorded_at, last_recorded_at
  ) values
    (snapshot_bucket, 'queue_notification_fanout_pending', 'all', 1, pending_jobs, pending_jobs, pending_jobs, '{}'::jsonb, now(), now()),
    (snapshot_bucket, 'queue_notification_fanout_claimed', 'all', 1, claimed_jobs, claimed_jobs, claimed_jobs, '{}'::jsonb, now(), now()),
    (snapshot_bucket, 'queue_notification_fanout_dead_lettered', 'all', 1, dead_letters, dead_letters, dead_letters, '{}'::jsonb, now(), now()),
    (snapshot_bucket, 'queue_notification_fanout_oldest_pending_seconds', 'all', 1, oldest_pending_seconds, oldest_pending_seconds, oldest_pending_seconds, '{}'::jsonb, now(), now()),
    (snapshot_bucket, 'queue_notification_fanout_stale_claims', 'all', 1, stale_claims, stale_claims, stale_claims, '{}'::jsonb, now(), now())
  on conflict (bucket_start, metric_name, dimension) do update set
    sample_count = 1,
    value_sum = excluded.value_sum,
    value_max = excluded.value_max,
    last_value = excluded.last_value,
    metadata = excluded.metadata,
    last_recorded_at = excluded.last_recorded_at;

  perform public.upsert_operational_alert(
    'notification_fanout_dead_letters', 'critical', dead_letters, 1,
    window_start, p_now, '{}'::jsonb, dead_letters >= 1
  );
  perform public.upsert_operational_alert(
    'notification_fanout_backlog', 'warning', greatest(pending_jobs, oldest_pending_seconds), 1000,
    window_start, p_now,
    jsonb_build_object(
      'pending_jobs', pending_jobs,
      'claimed_jobs', claimed_jobs,
      'oldest_pending_seconds', oldest_pending_seconds
    ),
    pending_jobs >= 1000 or oldest_pending_seconds >= 1800
  );
  perform public.upsert_operational_alert(
    'notification_fanout_stale_claims', 'critical', stale_claims, 1,
    window_start, p_now, '{}'::jsonb, stale_claims >= 1
  );

  return jsonb_build_object(
    'dead_lettered', dead_letters,
    'pending', pending_jobs,
    'claimed', claimed_jobs,
    'stale_claims', stale_claims,
    'oldest_pending_seconds', oldest_pending_seconds,
    'snapshot_at', snapshot_bucket
  );
end;
$$;

create or replace function public.admin_notification_fanout_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  snapshot jsonb := jsonb_build_object(
    'pending', 0,
    'claimed', 0,
    'dead_lettered', 0,
    'oldest_pending_seconds', 0,
    'stale_claims', 0
  );
  snapshot_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  select
    snapshot || coalesce(jsonb_object_agg(
      regexp_replace(metric_name, '^queue_notification_fanout_', ''),
      coalesce(last_value, 0)
    ), '{}'::jsonb),
    max(bucket_start)
  into snapshot, snapshot_at
  from (
    select distinct on (metric_name)
      metric_name, last_value, bucket_start
    from public.operational_metric_buckets
    where metric_name in (
      'queue_notification_fanout_pending',
      'queue_notification_fanout_claimed',
      'queue_notification_fanout_dead_lettered',
      'queue_notification_fanout_oldest_pending_seconds',
      'queue_notification_fanout_stale_claims'
    )
    order by metric_name, bucket_start desc
  ) latest_fanout;

  return snapshot || jsonb_build_object('snapshot_at', snapshot_at);
end;
$$;

create or replace function public.prune_notification_fanout_jobs(
  p_before timestamptz default now() - interval '30 days'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  removed bigint;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_before > now() - interval '7 days' or p_before < now() - interval '365 days' then
    raise exception 'notification fanout retention boundary is invalid' using errcode = '22023';
  end if;
  delete from public.essential_notification_fanout_jobs
  where state = 'completed' and completed_at < p_before;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.evaluate_notification_fanout_alerts(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_notification_fanout_health() from public, anon;
revoke all on function public.prune_notification_fanout_jobs(timestamptz) from public, anon, authenticated;
grant execute on function public.evaluate_notification_fanout_alerts(timestamptz) to service_role;
grant execute on function public.admin_notification_fanout_health() to authenticated;
grant execute on function public.prune_notification_fanout_jobs(timestamptz) to service_role;

comment on function public.evaluate_notification_fanout_alerts(timestamptz) is
  'Service-only queue health evaluation. Publishes aggregate gauges and deterministic alerts without user identity or notification text.';
comment on function public.admin_notification_fanout_health() is
  'Admin-only constant-time queue health read from compact operational metric snapshots.';
comment on function public.prune_notification_fanout_jobs(timestamptz) is
  'Deletes only completed notification fan-out jobs after a bounded retention window. Dead letters remain available for investigation.';
