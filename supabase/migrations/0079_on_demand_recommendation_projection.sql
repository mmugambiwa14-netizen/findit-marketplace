-- 0079_on_demand_recommendation_projection.sql
-- Scheduled workers remain authoritative for normal projection throughput. This
-- bounded safeguard repairs a missing subject projection when a detail surface
-- asks for recommendations before the worker has caught up. Listing reads and
-- writes remain independent and never call this function.

create or replace function public.ensure_listing_recommendation_feature_v1(
  p_listing_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_listing_id is null then return false; end if;

  if exists (
    select 1
    from public.listing_recommendation_features feature
    where feature.listing_id = p_listing_id
  ) then
    return true;
  end if;

  if not exists (
    select 1
    from public.listings listing
    where listing.id = p_listing_id
  ) then
    return false;
  end if;

  begin
    perform public.refresh_listing_recommendation_feature(p_listing_id);
    delete from public.recommendation_projection_jobs
    where listing_id = p_listing_id;
  exception when others then
    -- Recommendations are fail-open. A projection failure is left for the normal
    -- bounded queue and must not become a listing-detail failure.
    return false;
  end;

  return exists (
    select 1
    from public.listing_recommendation_features feature
    where feature.listing_id = p_listing_id
  );
end;
$$;

revoke all on function public.ensure_listing_recommendation_feature_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_listing_recommendation_feature_v1(uuid)
  to service_role;

insert into public.marketplace_operational_controls (
  control_key,
  enabled,
  state,
  configuration
)
values (
  'recommendation_projection',
  true,
  'asynchronous_with_on_demand_safeguard',
  '{"schema_version":79,"normal_path":"worker_queue","detail_safeguard":true,"listing_dependency":false}'::jsonb
)
on conflict (control_key) do update set
  enabled = excluded.enabled,
  state = excluded.state,
  configuration = public.marketplace_operational_controls.configuration || excluded.configuration,
  updated_at = now();

comment on function public.ensure_listing_recommendation_feature_v1(uuid)
  is 'Service-role-only fail-open safeguard that creates one missing listing recommendation projection without making listing availability depend on recommendations.';
