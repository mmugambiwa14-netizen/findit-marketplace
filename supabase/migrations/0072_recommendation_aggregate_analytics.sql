-- 0072_recommendation_aggregate_analytics.sql
-- Phase 6: aggregate-only recommendation analytics with strict attribution,
-- bounded admin reporting, scheduled refresh, and independent retention.

create table if not exists public.recommendation_service_metrics_daily (
  metric_date date not null,
  service_name text not null check (service_name in (
    'similar-listings-service',
    'seller-recommendations-service',
    'related-services-service',
    'related-products-service',
    'nearby-service',
    'recently-listed-service',
    'personalized-recommendation-service'
  )),
  reason_code text not null check (reason_code ~ '^[A-Z0-9_]{3,64}$'),
  surface text not null check (surface ~ '^[a-z0-9_:-]{1,64}$'),
  impression_count bigint not null default 0 check (impression_count >= 0),
  click_count bigint not null default 0 check (click_count >= 0),
  request_count bigint not null default 0 check (request_count >= 0),
  refreshed_at timestamptz not null default now(),
  primary key (metric_date, service_name, reason_code, surface)
);

create index if not exists idx_recommendation_service_metrics_daily_service
  on public.recommendation_service_metrics_daily (
    service_name,
    metric_date desc,
    reason_code,
    surface
  );

alter table public.recommendation_service_metrics_daily enable row level security;
alter table public.recommendation_service_metrics_daily force row level security;
revoke all on public.recommendation_service_metrics_daily from public, anon, authenticated;
grant select, insert, update, delete on public.recommendation_service_metrics_daily to service_role;

create or replace function public.validate_recommendation_analytics_attribution_v1()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  event_surface text;
  event_source text;
  event_position integer;
  event_page_size integer;
  event_result_count integer;
begin
  if new.event_type not in ('recommendation_impression', 'recommendation_click') then
    return new;
  end if;

  event_surface := new.context ->> 'surface';
  event_source := new.context ->> 'source';

  if jsonb_typeof(new.context -> 'position') <> 'number'
    or jsonb_typeof(new.context -> 'page_size') <> 'number'
    or jsonb_typeof(new.context -> 'result_count') <> 'number'
  then
    raise exception 'recommendation analytics context is incomplete'
      using errcode = '22023';
  end if;

  begin
    event_position := (new.context ->> 'position')::integer;
    event_page_size := (new.context ->> 'page_size')::integer;
    event_result_count := (new.context ->> 'result_count')::integer;
  exception when others then
    raise exception 'recommendation analytics context is invalid'
      using errcode = '22023';
  end;

  if event_surface <> 'listing_detail'
    or event_source is null
    or event_source !~ '^[A-Za-z0-9_:-]{1,120}$'
    or event_position not between 0 and 23
    or event_page_size not between 1 and 24
    or event_result_count not between 1 and 24
    or event_position >= event_page_size
    or event_page_size > event_result_count
  then
    raise exception 'recommendation analytics context is invalid'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_recommendation_analytics_attribution_v1()
  from public, anon, authenticated;

create trigger trg_recommendation_events_analytics_attribution
  before insert or update of event_type, recommendation_request_id,
    recommendation_service, reason_code, context
  on public.recommendation_events
  for each row execute function public.validate_recommendation_analytics_attribution_v1();

create or replace function public.refresh_recommendation_service_metrics_daily_v1(
  p_metric_date date default current_date - 1
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  refreshed_count integer := 0;
begin
  if p_metric_date is null
    or p_metric_date < current_date - 180
    or p_metric_date > current_date
  then
    raise exception 'analytics date is outside the refresh window'
      using errcode = '22023';
  end if;

  delete from public.recommendation_service_metrics_daily metric
  where metric.metric_date = p_metric_date;

  insert into public.recommendation_service_metrics_daily (
    metric_date,
    service_name,
    reason_code,
    surface,
    impression_count,
    click_count,
    request_count,
    refreshed_at
  )
  select
    p_metric_date,
    event.recommendation_service,
    event.reason_code,
    event.context ->> 'surface',
    count(*) filter (
      where event.event_type = 'recommendation_impression'
    )::bigint,
    count(*) filter (
      where event.event_type = 'recommendation_click'
    )::bigint,
    count(distinct event.recommendation_request_id)::bigint,
    now()
  from public.recommendation_events event
  where event.occurred_at >= p_metric_date::timestamptz
    and event.occurred_at < (p_metric_date + 1)::timestamptz
    and event.event_type in ('recommendation_impression', 'recommendation_click')
    and event.recommendation_request_id is not null
    and event.recommendation_service is not null
    and event.reason_code is not null
    and event.context ->> 'surface' is not null
  group by
    event.recommendation_service,
    event.reason_code,
    event.context ->> 'surface';

  get diagnostics refreshed_count = row_count;
  return refreshed_count;
end;
$$;

revoke all on function public.refresh_recommendation_service_metrics_daily_v1(date)
  from public, anon, authenticated;
grant execute on function public.refresh_recommendation_service_metrics_daily_v1(date)
  to service_role;

create or replace function public.purge_recommendation_service_metrics_v1(
  p_before_date date default current_date - 400,
  p_limit integer default 5000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if p_before_date is null
    or p_before_date > current_date - 30
    or p_limit not between 1 and 50000
  then
    raise exception 'invalid analytics retention request'
      using errcode = '22023';
  end if;

  with expired as (
    select metric.ctid
    from public.recommendation_service_metrics_daily metric
    where metric.metric_date < p_before_date
    order by metric.metric_date, metric.service_name, metric.reason_code, metric.surface
    limit p_limit
    for update skip locked
  )
  delete from public.recommendation_service_metrics_daily metric
  using expired
  where metric.ctid = expired.ctid;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_recommendation_service_metrics_v1(date, integer)
  from public, anon, authenticated;
grant execute on function public.purge_recommendation_service_metrics_v1(date, integer)
  to service_role;

create or replace function public.admin_recommendation_analytics_v1(
  p_start_date date default current_date - 29,
  p_end_date date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  response jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;

  if p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date
    or p_end_date > current_date
    or p_end_date - p_start_date > 89
    or p_start_date < current_date - 399
  then
    raise exception 'analytics date range is invalid'
      using errcode = '22023';
  end if;

  with selected as (
    select *
    from public.recommendation_service_metrics_daily metric
    where metric.metric_date between p_start_date and p_end_date
  ),
  service_totals as (
    select
      service_name,
      sum(impression_count)::bigint as impressions,
      sum(click_count)::bigint as clicks,
      sum(request_count)::bigint as requests
    from selected
    group by service_name
  ),
  daily_totals as (
    select
      metric_date,
      sum(impression_count)::bigint as impressions,
      sum(click_count)::bigint as clicks,
      sum(request_count)::bigint as requests
    from selected
    group by metric_date
  )
  select jsonb_build_object(
    'contractVersion', 1,
    'startDate', p_start_date,
    'endDate', p_end_date,
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'impressions', coalesce((select sum(impressions) from service_totals), 0),
      'clicks', coalesce((select sum(clicks) from service_totals), 0),
      'requests', coalesce((select sum(requests) from service_totals), 0),
      'clickThroughRate', coalesce((
        select round(sum(clicks)::numeric / nullif(sum(impressions), 0), 6)
        from service_totals
      ), 0)
    ),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'service', service_name,
        'impressions', impressions,
        'clicks', clicks,
        'requests', requests,
        'clickThroughRate', coalesce(
          round(clicks::numeric / nullif(impressions, 0), 6),
          0
        )
      ) order by impressions desc, service_name)
      from service_totals
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', metric_date,
        'impressions', impressions,
        'clicks', clicks,
        'requests', requests,
        'clickThroughRate', coalesce(
          round(clicks::numeric / nullif(impressions, 0), 6),
          0
        )
      ) order by metric_date)
      from daily_totals
    ), '[]'::jsonb)
  )
  into response;

  return response;
end;
$$;

revoke all on function public.admin_recommendation_analytics_v1(date, date)
  from public, anon, service_role;
grant execute on function public.admin_recommendation_analytics_v1(date, date)
  to authenticated;

create or replace function public.recommendation_analytics_health_v1()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'contractVersion', 1,
    'latestMetricDate', max(metric.metric_date),
    'latestRefreshAt', max(metric.refreshed_at),
    'metricRows', count(*)::bigint,
    'retentionDays', 400,
    'generatedAt', now()
  )
  from public.recommendation_service_metrics_daily metric;
$$;

revoke all on function public.recommendation_analytics_health_v1()
  from public, anon, authenticated;
grant execute on function public.recommendation_analytics_health_v1()
  to service_role;

insert into public.marketplace_operational_controls (
  control_key,
  enabled,
  state,
  configuration
)
values (
  'recommendation_analytics',
  true,
  'aggregate_only',
  jsonb_build_object(
    'schema_version', 72,
    'raw_event_browser_access', false,
    'admin_reports_include_identity', false,
    'maximum_report_days', 90,
    'aggregate_retention_days', 400,
    'supported_surfaces', jsonb_build_array('listing_detail')
  )
)
on conflict (control_key) do update set
  enabled = excluded.enabled,
  state = excluded.state,
  configuration = excluded.configuration,
  updated_at = now();

update public.marketplace_operational_controls
set
  state = 'phase_6_aggregate_analytics',
  configuration = configuration || jsonb_build_object(
    'schema_version', 72,
    'aggregate_analytics', true,
    'analytics_identity_fields_exposed', false,
    'analytics_report_maximum_days', 90
  ),
  updated_at = now()
where control_key = 'recommendation_foundation';

comment on table public.recommendation_service_metrics_daily
  is 'Daily aggregate recommendation delivery metrics. Contains no actor, session, listing, seller, request, message, contact, or search-query identity.';
comment on function public.admin_recommendation_analytics_v1(date, date)
  is 'Admin-only aggregate recommendation report with a maximum 90-day range and no behavioural identities.';
