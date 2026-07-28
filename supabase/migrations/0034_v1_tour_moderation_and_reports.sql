-- 0034_v1_tour_moderation_and_reports.sql
-- Manual moderation, atomic promotion, owner removal/retry, and parent-aware
-- Tour reporting. No external AI moderation is introduced.

alter table public.reports
  add column service_id uuid references public.services(id) on delete set null,
  add column tour_id uuid references public.listing_tours(id) on delete set null,
  add column target_type text check (
    target_type is null or target_type in ('listing', 'service', 'tour')
  ),
  add column tour_reason text check (
    tour_reason is null or tour_reason in (
      'unrelated_video', 'misleading_representation', 'stolen_content',
      'unsafe_content', 'inappropriate_content', 'prohibited_watermark',
      'suspected_fraud', 'duplicate_content'
    )
  ),
  add constraint reports_tour_parent_consistency check (
    tour_id is null
    or (
      target_type = 'tour'
      and tour_reason is not null
      and (
        (listing_id is not null and service_id is null)
        or (listing_id is null and service_id is not null)
      )
    )
  );

create index idx_reports_tour on public.reports(tour_id, status, created_at desc)
  where tour_id is not null;
create index idx_reports_service on public.reports(service_id, status, created_at desc)
  where service_id is not null;

-- Existing listing reports remain browser-insertable through their original
-- columns. Tour-specific relationships can only be written by report_tour(),
-- which validates eligibility, ownership, duplication and rate limits.
revoke insert on table public.reports from authenticated;
grant insert (
  listing_id, listing_type, listing_title, reason, description, reporter_id, status
) on table public.reports to authenticated;

create or replace function public.promote_approved_tour(p_tour_id uuid)
returns uuid as $$
declare
  candidate public.listing_tours%rowtype;
  slot_row public.listing_tour_slots%rowtype;
  previous_tour_id uuid;
begin
  select * into candidate from public.listing_tours
  where id = p_tour_id for update;
  if not found then
    raise exception 'Tour not found' using errcode = 'P0002';
  end if;
  if candidate.status <> 'ready'
    or candidate.moderation_status <> 'approved'
    or candidate.deleted_at is not null then
    raise exception 'Tour is not eligible for promotion' using errcode = '22023';
  end if;

  select * into slot_row from public.listing_tour_slots
  where pending_tour_id = candidate.id for update;
  if not found then
    if exists (
      select 1 from public.listing_tour_slots where current_tour_id = candidate.id
    ) then
      if not public.is_tour_parent_public(candidate.listing_id, candidate.service_id) then
        raise exception 'Tour parent is not publicly available' using errcode = '22023';
      end if;
      update public.listing_tours
      set published_at = coalesce(published_at, now())
      where id = candidate.id;
      insert into public.listing_tour_events (
        tour_id, actor_id, actor_type, event_type, previous_status, next_status
      ) values (
        candidate.id, auth.uid(),
        case when public.is_admin() then 'admin' else 'system' end,
        'tour_republished', 'ready', 'ready'
      );
      return candidate.id;
    end if;
    raise exception 'Tour is not the pending version for its parent' using errcode = '22023';
  end if;

  if not public.is_tour_parent_public(candidate.listing_id, candidate.service_id) then
    raise exception 'Tour parent is not publicly available' using errcode = '22023';
  end if;

  previous_tour_id := slot_row.current_tour_id;
  update public.listing_tour_slots
  set current_tour_id = candidate.id, pending_tour_id = null
  where id = slot_row.id;

  update public.listing_tours
  set published_at = coalesce(published_at, now())
  where id = candidate.id;

  if previous_tour_id is not null and previous_tour_id <> candidate.id then
    update public.listing_tours
    set status = 'superseded', superseded_at = now(), published_at = null
    where id = previous_tour_id;

    insert into public.listing_tour_events (
      tour_id, actor_type, event_type, previous_status, next_status,
      metadata
    ) values (
      previous_tour_id, 'system', 'tour_superseded', 'ready', 'superseded',
      jsonb_build_object('replacementTourId', candidate.id)
    );
  end if;

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status,
    metadata
  ) values (
    candidate.id, auth.uid(),
    case when public.is_admin() then 'admin' else 'system' end,
    'tour_promoted', 'ready', 'ready',
    jsonb_build_object('previousTourId', previous_tour_id)
  );
  return candidate.id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_approve_tour(
  p_tour_id uuid,
  p_reason text
)
returns uuid as $$
declare
  reason text;
  before_row jsonb;
  after_row jsonb;
begin
  reason := public.require_admin_reason(p_reason);
  select to_jsonb(t) into before_row from public.listing_tours t
  where t.id = p_tour_id for update;
  if before_row is null then
    raise exception 'Tour not found' using errcode = 'P0002';
  end if;
  if (before_row ->> 'status') <> 'ready' then
    raise exception 'only a ready Tour can be approved' using errcode = '22023';
  end if;

  update public.listing_tours
  set moderation_status = 'approved', approved_at = now(), rejection_reason = null
  where id = p_tour_id;

  perform public.promote_approved_tour(p_tour_id);
  select to_jsonb(t) into after_row from public.listing_tours t where t.id = p_tour_id;

  perform public.record_admin_action(
    'tour_approved', p_tour_id::text, 'listing_tour', reason,
    before_row - array['source_storage_path', 'checksum_sha256'],
    after_row - array['source_storage_path', 'checksum_sha256']
  );
  return p_tour_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_reject_tour(
  p_tour_id uuid,
  p_reason text
)
returns uuid as $$
declare
  reason text;
  tour public.listing_tours%rowtype;
  before_row jsonb;
  after_row jsonb;
begin
  reason := public.require_admin_reason(p_reason);
  select * into tour from public.listing_tours where id = p_tour_id for update;
  if not found then
    raise exception 'Tour not found' using errcode = 'P0002';
  end if;
  before_row := to_jsonb(tour);

  update public.listing_tour_slots
  set pending_tour_id = case when pending_tour_id = tour.id then null else pending_tour_id end,
      current_tour_id = case when current_tour_id = tour.id then null else current_tour_id end
  where pending_tour_id = tour.id or current_tour_id = tour.id;

  update public.listing_tours
  set moderation_status = 'rejected',
      status = case when status in ('ready', 'failed', 'uploaded', 'processing') then 'removed' else status end,
      rejection_reason = reason,
      removed_at = coalesce(removed_at, now()),
      published_at = null,
      processing_lease_token = null,
      processing_lease_until = null
  where id = tour.id;

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status,
    metadata
  ) values (
    tour.id, auth.uid(), 'admin', 'tour_rejected', tour.status,
    case when tour.status in ('ready', 'failed', 'uploaded', 'processing') then 'removed' else tour.status end,
    jsonb_build_object('reason', reason)
  );

  select to_jsonb(t) into after_row from public.listing_tours t where t.id = tour.id;
  perform public.record_admin_action(
    'tour_rejected', tour.id::text, 'listing_tour', reason,
    before_row - array['source_storage_path', 'checksum_sha256'],
    after_row - array['source_storage_path', 'checksum_sha256']
  );
  return tour.id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.owner_remove_tour(p_tour_id uuid)
returns boolean as $$
declare
  tour public.listing_tours%rowtype;
begin
  if not public.is_backend_feature_enabled('tours') then
    raise exception 'Tours backend is disabled' using errcode = '55000';
  end if;
  select * into tour from public.listing_tours
  where id = p_tour_id and owner_id = auth.uid() for update;
  if not found then
    raise exception 'Tour not found' using errcode = 'P0002';
  end if;
  if tour.status in ('removed', 'cleaned') then
    return true;
  end if;

  update public.listing_tour_slots
  set pending_tour_id = case when pending_tour_id = tour.id then null else pending_tour_id end,
      current_tour_id = case when current_tour_id = tour.id then null else current_tour_id end
  where owner_id = auth.uid()
    and (pending_tour_id = tour.id or current_tour_id = tour.id);

  update public.listing_tours
  set status = 'removed', removed_at = now(), published_at = null,
      processing_lease_token = null, processing_lease_until = null,
      processing_retry_at = null
  where id = tour.id;

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status
  ) values (
    tour.id, auth.uid(), 'owner', 'tour_removed', tour.status, 'removed'
  );
  return true;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.owner_retry_failed_tour(p_tour_id uuid)
returns boolean as $$
declare
  tour public.listing_tours%rowtype;
  max_attempts integer := public.tour_processing_max_attempts();
begin
  if not public.is_backend_feature_enabled('tours') then
    raise exception 'Tours backend is disabled' using errcode = '55000';
  end if;
  select * into tour from public.listing_tours
  where id = p_tour_id and owner_id = auth.uid() for update;
  if not found then
    raise exception 'Tour not found' using errcode = 'P0002';
  end if;
  if tour.status <> 'failed' or tour.processing_attempts >= max_attempts then
    raise exception 'Tour cannot be retried' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'tour-sources' and name = tour.source_storage_path
  ) then
    raise exception 'Tour source is no longer available' using errcode = '22023';
  end if;

  update public.listing_tours
  set status = 'uploaded', processing_retry_at = now(),
      failure_code = null, failure_message = null
  where id = tour.id;
  update public.listing_tour_upload_intents
  set state = 'uploaded'
  where tour_id = tour.id and state = 'processing';

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status
  ) values (
    tour.id, auth.uid(), 'owner', 'processing_retry_requested', 'failed', 'uploaded'
  );
  return true;
end;
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.report_tour(
  p_tour_id uuid,
  p_reason text,
  p_description text default null
)
returns uuid as $$
declare
  tour public.listing_tours%rowtype;
  report_id uuid;
  normalized_description text := nullif(left(trim(coalesce(p_description, '')), 2000), '');
begin
  if not public.is_backend_feature_enabled('tours') then
    raise exception 'Tours backend is disabled' using errcode = '55000';
  end if;
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_reason not in (
    'unrelated_video', 'misleading_representation', 'stolen_content',
    'unsafe_content', 'inappropriate_content', 'prohibited_watermark',
    'suspected_fraud', 'duplicate_content'
  ) then
    raise exception 'invalid Tour report reason' using errcode = '22023';
  end if;

  select * into tour from public.listing_tours
  where id = p_tour_id and public.is_tour_public_eligible(id)
  for update;
  if not found then
    raise exception 'public Tour not found' using errcode = 'P0002';
  end if;
  if tour.owner_id = auth.uid() then
    raise exception 'owners cannot report their own Tour' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.reports
    where tour_id = tour.id and reporter_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'this Tour is already reported by the user' using errcode = '23505';
  end if;
  if (
    select count(*) from public.reports
    where reporter_id = auth.uid() and tour_id is not null
      and created_at >= now() - interval '24 hours'
  ) >= 10 then
    raise exception 'Tour report rate exceeded' using errcode = 'P0001';
  end if;

  insert into public.reports (
    listing_id, service_id, tour_id, target_type, listing_type, listing_title,
    reason, tour_reason, description, reporter_id
  ) values (
    tour.listing_id,
    tour.service_id,
    tour.id,
    'tour',
    case
      when tour.service_id is not null then 'service'::ticket_listing_category
      when exists (select 1 from public.listings l where l.id = tour.listing_id and l.kind = 'car')
        then 'vehicle'::ticket_listing_category
      when exists (select 1 from public.listings l where l.id = tour.listing_id and l.kind = 'property')
        then 'property'::ticket_listing_category
      else 'machinery'::ticket_listing_category
    end,
    coalesce(
      (select title from public.listings where id = tour.listing_id),
      (select title from public.services where id = tour.service_id)
    ),
    'other'::report_reason,
    p_reason,
    normalized_description,
    auth.uid()
  ) returning id into report_id;

  update public.listing_tours
  set moderation_status = 'reported', published_at = null
  where id = tour.id and moderation_status = 'approved';

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status,
    metadata
  ) values (
    tour.id, auth.uid(), 'system', 'tour_reported', tour.status, tour.status,
    jsonb_build_object('reportId', report_id, 'reason', p_reason)
  );
  return report_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_tour_queue(
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

revoke all on function public.promote_approved_tour(uuid) from public, anon, authenticated;
revoke all on function public.admin_approve_tour(uuid, text) from public, anon;
revoke all on function public.admin_reject_tour(uuid, text) from public, anon;
revoke all on function public.owner_remove_tour(uuid) from public, anon;
revoke all on function public.owner_retry_failed_tour(uuid) from public, anon;
revoke all on function public.report_tour(uuid, text, text) from public, anon;
revoke all on function public.admin_tour_queue(text, integer, integer) from public, anon;

grant execute on function public.promote_approved_tour(uuid) to service_role;
grant execute on function public.admin_approve_tour(uuid, text) to authenticated;
grant execute on function public.admin_reject_tour(uuid, text) to authenticated;
grant execute on function public.owner_remove_tour(uuid) to authenticated;
grant execute on function public.owner_retry_failed_tour(uuid) to authenticated;
grant execute on function public.report_tour(uuid, text, text) to authenticated;
grant execute on function public.admin_tour_queue(text, integer, integer) to authenticated;
