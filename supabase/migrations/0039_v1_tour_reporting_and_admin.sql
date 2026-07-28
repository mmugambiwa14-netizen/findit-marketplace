-- 0039_v1_tour_reporting_and_admin.sql
-- Completes the manual Tour reporting and founder-admin moderation workflow.
-- Tour reports retain canonical parent identity and can never delete the parent
-- listing/service through the generic report decision path.

alter table public.reports
  add column if not exists target_id uuid;

update public.reports
set target_type = coalesce(
      target_type,
      case
        when tour_id is not null then 'tour'
        when service_id is not null then 'service'
        else 'listing'
      end
    ),
    target_id = coalesce(
      target_id,
      case
        -- Preserve the declared target class first. When an old foreign key
        -- was already cleared, the report UUID is the only collision-free
        -- durable fallback; canonical parent columns remain separate.
        when target_type = 'tour' then coalesce(tour_id, id)
        when target_type = 'service' then coalesce(service_id, id)
        when target_type = 'listing' then coalesce(listing_id, id)
        when tour_id is not null then tour_id
        when service_id is not null then service_id
        else coalesce(listing_id, id)
      end
    )
where target_type is null or target_id is null;

create or replace function public.set_report_target_identity()
returns trigger as $$
begin
  -- Preserve a previously assigned durable identity when a foreign-key
  -- cleanup clears the relationship column after its target is removed.
  if new.target_type = 'tour' and new.target_id is not null
    and (new.tour_id is null or new.target_id = new.tour_id) then
    return new;
  elsif new.target_type = 'service' and new.target_id is not null
    and (new.service_id is null or new.target_id = new.service_id) then
    return new;
  elsif new.target_type = 'listing' and new.target_id is not null
    and (new.listing_id is null or new.target_id = new.listing_id) then
    return new;
  end if;

  if new.tour_id is not null then
    new.target_type := 'tour';
    new.target_id := new.tour_id;
  elsif new.service_id is not null then
    new.target_type := 'service';
    new.target_id := new.service_id;
  elsif new.listing_id is not null then
    new.target_type := 'listing';
    new.target_id := new.listing_id;
  elsif new.target_type is null or new.target_id is null then
    raise exception 'a report target is required' using errcode = '23514';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

revoke all on function public.set_report_target_identity() from public, anon, authenticated;

drop trigger if exists trg_reports_target_identity on public.reports;
create trigger trg_reports_target_identity
  before insert or update of listing_id, service_id, tour_id, target_type, target_id
  on public.reports
  for each row execute function public.set_report_target_identity();

alter table public.reports
  alter column target_type set not null,
  alter column target_id set not null;

alter table public.reports
  drop constraint if exists reports_target_identity_consistency,
  add constraint reports_target_identity_consistency check (
    (
      target_type = 'listing'
      and service_id is null and tour_id is null
      and (listing_id is null or target_id = listing_id)
    )
    or
    (
      target_type = 'service'
      and listing_id is null and tour_id is null
      and (service_id is null or target_id = service_id)
    )
    or
    (
      target_type = 'tour'
      and tour_reason is not null
      and (tour_id is null or target_id = tour_id)
      and not (listing_id is not null and service_id is not null)
    )
  );

create index if not exists idx_reports_target
  on public.reports(target_type, target_id, status, created_at desc);

-- The old generic report queue cannot expose Tour identity or moderation state.
-- Drop/recreate is required because PostgreSQL cannot change a function's table
-- return type through CREATE OR REPLACE.
drop function if exists public.admin_report_rows(text, text, text, integer, integer);
create function public.admin_report_rows(
  p_query text default '',
  p_status text default 'pending',
  p_kind text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  report_id uuid,
  target_type text,
  target_id uuid,
  listing_id uuid,
  service_id uuid,
  tour_id uuid,
  listing_type text,
  listing_title text,
  reason text,
  description text,
  reporter_id uuid,
  reporter_email text,
  reporter_tour_reports_24h bigint,
  status text,
  admin_notes text,
  reviewed_by uuid,
  reviewer_email text,
  reviewed_at timestamptz,
  tour_status text,
  tour_moderation_status text,
  created_at timestamptz,
  total_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_status not in ('all', 'pending', 'reviewed', 'dismissed', 'actioned')
    or p_kind not in ('all', 'property', 'vehicle', 'machinery', 'service', 'tour', 'message')
    or p_limit not between 1 and 100
    or p_offset < 0
  then
    raise exception 'invalid report filter' using errcode = '22023';
  end if;

  return query
  with combined as (
    select
      r.id,
      r.target_type,
      r.target_id,
      r.listing_id,
      r.service_id,
      r.tour_id,
      case when r.target_type = 'tour' then 'tour' else r.listing_type::text end as item_type,
      r.listing_type::text as listing_type,
      r.listing_title,
      coalesce(r.tour_reason, r.reason::text) as reason,
      r.description,
      r.reporter_id,
      reporter.email as reporter_email,
      (
        select count(*)
        from public.reports rr
        where rr.reporter_id = r.reporter_id
          and rr.target_type = 'tour'
          and rr.created_at >= now() - interval '24 hours'
      ) as reporter_tour_reports_24h,
      r.status::text as status,
      r.admin_notes,
      r.reviewed_by,
      reviewer.email as reviewer_email,
      r.reviewed_at,
      t.status as tour_status,
      t.moderation_status as tour_moderation_status,
      r.created_at
    from public.reports r
    join public.users reporter on reporter.id = r.reporter_id
    left join public.users reviewer on reviewer.id = r.reviewed_by
    left join public.listing_tours t on t.id = r.tour_id

    union all

    select
      cr.id,
      'message'::text,
      cr.conversation_id,
      null::uuid,
      null::uuid,
      null::uuid,
      'message'::text,
      'message'::text,
      'Conversation about ' || l.title,
      cr.reason,
      cr.description,
      cr.reporter_id,
      reporter.email,
      0::bigint,
      cr.status::text,
      cr.admin_notes,
      cr.reviewed_by,
      reviewer.email,
      cr.reviewed_at,
      null::text,
      null::text,
      cr.created_at
    from public.conversation_reports cr
    join public.conversations c on c.id = cr.conversation_id
    join public.listings l on l.id = c.listing_id
    join public.users reporter on reporter.id = cr.reporter_id
    left join public.users reviewer on reviewer.id = cr.reviewed_by
  ), filtered as (
    select * from combined
    where (p_status = 'all' or combined.status = p_status)
      and (p_kind = 'all' or combined.item_type = p_kind)
      and (
        trim(coalesce(p_query, '')) = ''
        or combined.listing_title ilike '%' || trim(p_query) || '%'
        or combined.reporter_email ilike '%' || trim(p_query) || '%'
        or combined.reason ilike '%' || trim(p_query) || '%'
      )
  )
  select
    filtered.id,
    filtered.target_type,
    filtered.target_id,
    filtered.listing_id,
    filtered.service_id,
    filtered.tour_id,
    filtered.listing_type,
    filtered.listing_title,
    filtered.reason,
    filtered.description,
    filtered.reporter_id,
    filtered.reporter_email,
    filtered.reporter_tour_reports_24h,
    filtered.status,
    filtered.admin_notes,
    filtered.reviewed_by,
    filtered.reviewer_email,
    filtered.reviewed_at,
    filtered.tour_status,
    filtered.tour_moderation_status,
    filtered.created_at,
    count(*) over()
  from filtered
  order by filtered.created_at desc, filtered.id desc
  limit p_limit offset p_offset;
end;
$$ language plpgsql stable security definer set search_path = public;

-- Override the generic report decision so a Tour report can only affect the
-- Tour. It must never cascade into deleting the canonical parent listing.
create or replace function public.admin_review_report(
  p_report_id uuid,
  p_status report_status,
  p_notes text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_notes);
  before_row jsonb;
  after_row jsonb;
  target_listing uuid;
  target_service uuid;
  target_tour uuid;
  target_type text;
  target_conversation uuid;
  target_reporter uuid;
  report_link text;
begin
  if p_status not in ('reviewed', 'dismissed', 'actioned') then
    raise exception 'invalid report decision' using errcode = '22023';
  end if;

  select
    to_jsonb(r), r.listing_id, r.service_id, r.tour_id, r.target_type,
    r.reporter_id
  into
    before_row, target_listing, target_service, target_tour, target_type,
    target_reporter
  from public.reports r
  where r.id = p_report_id
  for update;

  if before_row is not null then
    if target_type = 'tour' then
      if p_status = 'actioned' then
        perform public.admin_reject_tour(target_tour, normalized_reason);
        update public.reports
        set status = 'actioned', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where tour_id = target_tour and status in ('pending', 'reviewed');
      elsif p_status = 'dismissed' then
        -- Only ready, reported Tours with an eligible parent can be restored.
        perform public.admin_approve_tour(target_tour, normalized_reason);
        update public.reports
        set status = 'dismissed', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where tour_id = target_tour and status in ('pending', 'reviewed');
      else
        update public.reports
        set status = 'reviewed', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where id = p_report_id;
      end if;

      select to_jsonb(r) into after_row from public.reports r where r.id = p_report_id;
      if p_status in ('dismissed', 'actioned') then
        report_link := case
          when target_listing is not null then
            (select '/' || kind::text || '/' || id::text from public.listings where id = target_listing)
          when target_service is not null then '/service/' || target_service::text
          else null
        end;
        perform public.create_essential_notification(
          target_reporter,
          'report_resolved',
          'tour-report:' || p_report_id::text || ':' || p_status::text,
          'Tour report resolved',
          normalized_reason,
          report_link,
          target_listing
        );
      end if;
      perform public.record_admin_action(
        'tour_report.' || p_status::text,
        p_report_id::text,
        'tour_report',
        normalized_reason,
        before_row,
        after_row
      );
      return after_row;
    end if;

    if target_listing is not null then
      select '/' || kind::text || '/' || id::text into report_link
      from public.listings where id = target_listing;
    elsif target_service is not null then
      report_link := '/service/' || target_service::text;
    end if;

    if p_status = 'actioned' then
      if target_type = 'service' then
        if target_service is null then
          raise exception 'reported service is no longer available' using errcode = 'P0002';
        end if;
        update public.reports
        set status = 'actioned', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where service_id = target_service and target_type = 'service'
          and status in ('pending', 'reviewed');
        delete from public.services where id = target_service;
      else
        if target_listing is null then
          raise exception 'reported listing is no longer available' using errcode = 'P0002';
        end if;
        update public.reports
        set status = 'actioned', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where listing_id = target_listing and target_type = 'listing'
          and status in ('pending', 'reviewed');
        update public.reports set listing_id = null where listing_id = target_listing;
        delete from public.listings where id = target_listing;
      end if;
      report_link := null;
    else
      update public.reports
      set status = p_status, admin_notes = normalized_reason,
          reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_report_id;
    end if;

    select to_jsonb(r) into after_row from public.reports r where r.id = p_report_id;
    if p_status in ('dismissed', 'actioned') then
      perform public.create_essential_notification(
        target_reporter,
        'report_resolved',
        'report:' || p_report_id::text || ':' || p_status::text,
        'Report resolved',
        normalized_reason,
        report_link,
        case when p_status = 'actioned' then null else target_listing end
      );
    end if;
    perform public.record_admin_action(
      'report.' || p_status::text,
      p_report_id::text,
      'report',
      normalized_reason,
      before_row,
      after_row
    );
    return after_row;
  end if;

  select to_jsonb(cr), cr.conversation_id, cr.reporter_id
  into before_row, target_conversation, target_reporter
  from public.conversation_reports cr
  where cr.id = p_report_id
  for update;
  if before_row is null then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  update public.conversation_reports
  set status = p_status, admin_notes = normalized_reason,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_report_id;
  if p_status = 'actioned' then
    update public.conversations set state = 'closed' where id = target_conversation;
  end if;
  select to_jsonb(cr) into after_row
  from public.conversation_reports cr where cr.id = p_report_id;
  if p_status in ('dismissed', 'actioned') then
    perform public.create_essential_notification(
      target_reporter,
      'report_resolved',
      'conversation-report:' || p_report_id::text || ':' || p_status::text,
      'Report resolved',
      normalized_reason,
      '/messages/' || target_conversation::text,
      null
    );
  end if;
  perform public.record_admin_action(
    'conversation_report.' || p_status::text,
    p_report_id::text,
    'conversation_report',
    normalized_reason,
    before_row,
    after_row
  );
  return after_row;
end;
$$ language plpgsql security definer set search_path = public;

-- Extend the existing Tour queue with search, owner risk context, and stable
-- parent state. Private paths remain admin-only and are signed by a dedicated
-- review Edge Function.
drop function if exists public.admin_tour_queue(text, integer, integer);
create function public.admin_tour_queue(
  p_query text default '',
  p_status text default 'pending',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  tour_id uuid,
  parent_type text,
  parent_id uuid,
  parent_title text,
  parent_status text,
  parent_path text,
  owner_id uuid,
  owner_name text,
  owner_email text,
  owner_status text,
  owner_rejected_tour_count bigint,
  status text,
  moderation_status text,
  duration_seconds numeric,
  failure_code text,
  failure_message text,
  rejection_reason text,
  report_count bigint,
  latest_report_id uuid,
  latest_report_reason text,
  ready_at timestamptz,
  created_at timestamptz,
  total_count bigint
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_status not in ('all', 'pending', 'approved', 'rejected', 'reported', 'failed')
    or p_limit not between 1 and 100
    or p_offset < 0
    or length(trim(coalesce(p_query, ''))) > 100
  then
    raise exception 'invalid Tour queue filters' using errcode = '22023';
  end if;

  return query
  with queue as (
    select
      t.id as tour_id,
      case when t.listing_id is not null then 'listing' else 'service' end as parent_type,
      coalesce(t.listing_id, t.service_id) as parent_id,
      coalesce(l.title, s.title) as parent_title,
      coalesce(l.status::text, s.status::text) as parent_status,
      case
        when t.service_id is not null then '/service/' || t.service_id::text
        else '/' || l.kind::text || '/' || t.listing_id::text
      end as parent_path,
      t.owner_id,
      u.full_name as owner_name,
      u.email as owner_email,
      u.status::text as owner_status,
      (
        select count(*)
        from public.listing_tours rejected
        where rejected.owner_id = t.owner_id
          and rejected.id <> t.id
          and rejected.moderation_status = 'rejected'
      ) as owner_rejected_tour_count,
      t.status,
      t.moderation_status,
      t.duration_seconds,
      t.failure_code,
      t.failure_message,
      t.rejection_reason,
      (select count(*) from public.reports r where r.tour_id = t.id) as report_count,
      (
        select r.id
        from public.reports r
        where r.tour_id = t.id and r.status in ('pending', 'reviewed')
        order by r.created_at desc, r.id desc
        limit 1
      ) as latest_report_id,
      (
        select r.tour_reason
        from public.reports r
        where r.tour_id = t.id
        order by r.created_at desc, r.id desc
        limit 1
      ) as latest_report_reason,
      t.ready_at,
      t.created_at
    from public.listing_tours t
    join public.users u on u.id = t.owner_id
    left join public.listings l on l.id = t.listing_id
    left join public.services s on s.id = t.service_id
    where (
      p_status = 'all'
      or (p_status = 'failed' and t.status = 'failed')
      or (p_status <> 'failed' and t.moderation_status = p_status)
    )
  ), filtered as (
    select * from queue
    where trim(coalesce(p_query, '')) = ''
      or parent_title ilike '%' || trim(p_query) || '%'
      or owner_name ilike '%' || trim(p_query) || '%'
      or owner_email ilike '%' || trim(p_query) || '%'
      or coalesce(latest_report_reason, '') ilike '%' || trim(p_query) || '%'
      or coalesce(failure_code, '') ilike '%' || trim(p_query) || '%'
  )
  select
    filtered.tour_id,
    filtered.parent_type,
    filtered.parent_id,
    filtered.parent_title,
    filtered.parent_status,
    filtered.parent_path,
    filtered.owner_id,
    filtered.owner_name,
    filtered.owner_email,
    filtered.owner_status,
    filtered.owner_rejected_tour_count,
    filtered.status,
    filtered.moderation_status,
    filtered.duration_seconds,
    filtered.failure_code,
    filtered.failure_message,
    filtered.rejection_reason,
    filtered.report_count,
    filtered.latest_report_id,
    filtered.latest_report_reason,
    filtered.ready_at,
    filtered.created_at,
    count(*) over()
  from filtered
  order by
    case when filtered.moderation_status = 'reported' then 0 else 1 end,
    case when filtered.status = 'failed' then 0 else 1 end,
    coalesce(filtered.ready_at, filtered.created_at) desc,
    filtered.tour_id desc
  limit p_limit offset p_offset;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.admin_tour_review_metadata(p_tour_id uuid)
returns table (
  tour_id uuid,
  parent_type text,
  parent_id uuid,
  status text,
  moderation_status text,
  duration_seconds numeric,
  width integer,
  height integer,
  playback_storage_path text,
  thumbnail_storage_path text
) as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  return query
  select
    t.id,
    case when t.listing_id is not null then 'listing' else 'service' end,
    coalesce(t.listing_id, t.service_id),
    t.status,
    t.moderation_status,
    t.duration_seconds,
    t.width,
    t.height,
    t.playback_storage_path,
    t.thumbnail_storage_path
  from public.listing_tours t
  where t.id = p_tour_id and t.deleted_at is null;
end;
$$ language plpgsql stable security definer set search_path = public;

revoke all on function public.admin_report_rows(text, text, text, integer, integer) from public, anon;
revoke all on function public.admin_review_report(uuid, report_status, text) from public, anon;
revoke all on function public.admin_tour_queue(text, text, integer, integer) from public, anon;
revoke all on function public.admin_tour_review_metadata(uuid) from public, anon;

grant execute on function public.admin_report_rows(text, text, text, integer, integer) to authenticated;
grant execute on function public.admin_review_report(uuid, report_status, text) to authenticated;
grant execute on function public.admin_tour_queue(text, text, integer, integer) to authenticated;
grant execute on function public.admin_tour_review_metadata(uuid) to authenticated;
