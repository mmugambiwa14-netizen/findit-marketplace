-- Targeted rollback for 0039_v1_tour_reporting_and_admin.sql.
-- Disable the Tours frontend/backend before applying. This rollback preserves
-- report, Tour, listing, service, user, audit, and media records.

revoke execute on function public.admin_tour_review_metadata(uuid) from authenticated;
drop function if exists public.admin_tour_review_metadata(uuid);

drop function if exists public.admin_tour_queue(text, text, integer, integer);

-- Restore the Milestone 2 queue signature and shape.
create function public.admin_tour_queue(
  p_status text default 'pending',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  tour_id uuid,
  parent_type text,
  parent_id uuid,
  parent_title text,
  owner_id uuid,
  owner_name text,
  status text,
  moderation_status text,
  duration_seconds numeric,
  thumbnail_storage_path text,
  failure_code text,
  rejection_reason text,
  report_count bigint,
  created_at timestamptz,
  total_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_status not in ('all', 'pending', 'approved', 'rejected', 'reported', 'failed')
    or p_limit not between 1 and 100 or p_offset < 0 then
    raise exception 'invalid Tour queue filters' using errcode = '22023';
  end if;
  return query
  select
    t.id,
    case when t.listing_id is not null then 'listing' else 'service' end,
    coalesce(t.listing_id, t.service_id),
    coalesce(l.title, s.title),
    t.owner_id,
    u.full_name,
    t.status,
    t.moderation_status,
    t.duration_seconds,
    t.thumbnail_storage_path,
    t.failure_code,
    t.rejection_reason,
    (select count(*) from public.reports r where r.tour_id = t.id),
    t.created_at,
    count(*) over()
  from public.listing_tours t
  join public.users u on u.id = t.owner_id
  left join public.listings l on l.id = t.listing_id
  left join public.services s on s.id = t.service_id
  where (
    p_status = 'all'
    or (p_status = 'failed' and t.status = 'failed')
    or (p_status <> 'failed' and t.moderation_status = p_status)
  )
  order by
    case when t.moderation_status = 'reported' then 0 else 1 end,
    coalesce(t.ready_at, t.created_at) desc,
    t.id desc
  limit p_limit offset p_offset;
end;
$$ language plpgsql stable security definer set search_path = public;
revoke all on function public.admin_tour_queue(text, integer, integer) from public, anon;
grant execute on function public.admin_tour_queue(text, integer, integer) to authenticated;

-- The expanded report row shape and Tour-safe decision function are left in
-- place during rollback because removing them would reintroduce the parent-
-- listing deletion defect for existing Tour reports. The additive target_id
-- column and trigger are likewise retained for data integrity.
