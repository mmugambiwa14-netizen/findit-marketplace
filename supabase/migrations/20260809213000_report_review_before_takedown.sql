begin;

-- Reporting is an intake action, not a moderation decision. A public Peek/Tour
-- remains published while its report is pending or merely reviewed. Only an
-- explicit admin `actioned` decision may reject/take it down.
create or replace function private.report_tour(
  p_tour_id uuid,
  p_reason text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
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

  -- Deliberately do not mutate listing_tours here. A report is pending until an
  -- administrator approves a moderation action.
  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status,
    metadata
  ) values (
    tour.id, auth.uid(), 'system', 'tour_reported', tour.status, tour.status,
    jsonb_build_object('reportId', report_id, 'reason', p_reason, 'contentRemainsPublished', true)
  );
  return report_id;
end;
$function$;

create or replace function private.admin_review_report(
  p_report_id uuid,
  p_status report_status,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
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
        -- This is the sole report decision that changes/removes the Tour.
        perform public.admin_reject_tour(target_tour, normalized_reason);
        update public.reports
        set status = 'actioned', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where tour_id = target_tour and status in ('pending', 'reviewed');
      elsif p_status = 'dismissed' then
        -- Dismissing a report leaves the already-approved/public Tour exactly as
        -- it was. We no longer call admin_approve_tour because report intake no
        -- longer demotes or unpublishes the Tour.
        update public.reports
        set status = 'dismissed', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where tour_id = target_tour and status in ('pending', 'reviewed');
      else
        -- Reviewed means triaged, not approved for takedown.
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
          case when p_status = 'actioned' then null else report_link end,
          case when p_status = 'actioned' then null else target_listing end
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
      -- reviewed/dismissed never remove listing or service content.
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
$function$;

commit;
