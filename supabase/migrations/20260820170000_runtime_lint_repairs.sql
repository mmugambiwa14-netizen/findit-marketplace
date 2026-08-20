begin;

-- Correct application-owned runtime defects found by hosted plpgsql analysis.
-- The PostGIS extension warnings reported by the same analyzer are external
-- extension false positives and are intentionally not modified here.

create or replace function private.admin_tour_queue(
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
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
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
    where p_status = 'all'
      or (p_status = 'failed' and t.status = 'failed')
      or (p_status <> 'failed' and t.moderation_status = p_status)
  ), filtered as (
    select q.*
    from queue q
    where trim(coalesce(p_query, '')) = ''
      or coalesce(q.parent_title, '') ilike '%' || trim(p_query) || '%'
      or coalesce(q.owner_name, '') ilike '%' || trim(p_query) || '%'
      or coalesce(q.owner_email, '') ilike '%' || trim(p_query) || '%'
      or coalesce(q.latest_report_reason, '') ilike '%' || trim(p_query) || '%'
      or coalesce(q.failure_code, '') ilike '%' || trim(p_query) || '%'
  )
  select
    f.tour_id,
    f.parent_type,
    f.parent_id,
    f.parent_title,
    f.parent_status,
    f.parent_path,
    f.owner_id,
    f.owner_name,
    f.owner_email,
    f.owner_status,
    f.owner_rejected_tour_count,
    f.status,
    f.moderation_status,
    f.duration_seconds,
    f.failure_code,
    f.failure_message,
    f.rejection_reason,
    f.report_count,
    f.latest_report_id,
    f.latest_report_reason,
    f.ready_at,
    f.created_at,
    count(*) over ()
  from filtered f
  order by
    case when f.moderation_status = 'reported' then 0 else 1 end,
    case when f.status = 'failed' then 0 else 1 end,
    coalesce(f.ready_at, f.created_at) desc,
    f.tour_id desc
  limit p_limit offset p_offset;
end;
$function$;

create or replace function private.report_tour(
  p_tour_id uuid,
  p_reason text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
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

  select *
  into tour
  from public.listing_tours
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
  )
  values (
    tour.listing_id,
    tour.service_id,
    tour.id,
    'tour',
    case
      when tour.service_id is not null then 'service'::public.ticket_listing_category
      when exists (
        select 1 from public.listings l
        where l.id = tour.listing_id and l.kind = 'car'
      ) then 'vehicle'::public.ticket_listing_category
      when exists (
        select 1 from public.listings l
        where l.id = tour.listing_id and l.kind = 'property'
      ) then 'property'::public.ticket_listing_category
      else 'machinery'::public.ticket_listing_category
    end,
    coalesce(
      (select l.title from public.listings l where l.id = tour.listing_id),
      (select s.title from public.services s where s.id = tour.service_id)
    ),
    'other'::public.report_reason,
    p_reason,
    normalized_description,
    auth.uid()
  )
  returning id into report_id;

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status, metadata
  )
  values (
    tour.id, auth.uid(), 'system', 'tour_reported', tour.status, tour.status,
    jsonb_build_object('reportId', report_id, 'reason', p_reason, 'contentRemainsPublished', true)
  );
  return report_id;
end;
$function$;

create or replace function private.admin_review_report(
  p_report_id uuid,
  p_status public.report_status,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_reason text := public.require_admin_reason(p_notes);
  before_row jsonb;
  after_row jsonb;
  target_listing uuid;
  target_service uuid;
  target_tour uuid;
  v_target_type text;
  target_conversation uuid;
  target_reporter uuid;
  report_link text;
begin
  if p_status not in ('reviewed', 'dismissed', 'actioned') then
    raise exception 'invalid report decision' using errcode = '22023';
  end if;

  select to_jsonb(r), r.listing_id, r.service_id, r.tour_id, r.target_type, r.reporter_id
  into before_row, target_listing, target_service, target_tour, v_target_type, target_reporter
  from public.reports r
  where r.id = p_report_id
  for update;

  if before_row is not null then
    if v_target_type = 'tour' then
      if p_status = 'actioned' then
        perform public.admin_reject_tour(target_tour, normalized_reason);
        update public.reports as r
        set status = 'actioned', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where r.tour_id = target_tour and r.status in ('pending', 'reviewed');
      elsif p_status = 'dismissed' then
        update public.reports as r
        set status = 'dismissed', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where r.tour_id = target_tour and r.status in ('pending', 'reviewed');
      else
        update public.reports as r
        set status = 'reviewed', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where r.id = p_report_id;
      end if;

      select to_jsonb(r) into after_row from public.reports r where r.id = p_report_id;
      if p_status in ('dismissed', 'actioned') then
        report_link := case
          when target_listing is not null then
            (select '/' || l.kind::text || '/' || l.id::text
             from public.listings l where l.id = target_listing)
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
      select '/' || l.kind::text || '/' || l.id::text into report_link
      from public.listings l where l.id = target_listing;
    elsif target_service is not null then
      report_link := '/service/' || target_service::text;
    end if;

    if p_status = 'actioned' then
      if v_target_type = 'service' then
        if target_service is null then
          raise exception 'reported service is no longer available' using errcode = 'P0002';
        end if;
        update public.reports as r
        set status = 'actioned', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where r.service_id = target_service and r.target_type = 'service'
          and r.status in ('pending', 'reviewed');
        delete from public.services where id = target_service;
      else
        if target_listing is null then
          raise exception 'reported listing is no longer available' using errcode = 'P0002';
        end if;
        update public.reports as r
        set status = 'actioned', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where r.listing_id = target_listing and r.target_type = 'listing'
          and r.status in ('pending', 'reviewed');
        update public.reports as r set listing_id = null where r.listing_id = target_listing;
        delete from public.listings where id = target_listing;
      end if;
      report_link := null;
    else
      update public.reports as r
      set status = p_status, admin_notes = normalized_reason,
          reviewed_by = auth.uid(), reviewed_at = now()
      where r.id = p_report_id;
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

  update public.conversation_reports as cr
  set status = p_status, admin_notes = normalized_reason,
      reviewed_by = auth.uid(), reviewed_at = now()
  where cr.id = p_report_id;
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

create or replace function private.bind_response_peek(
  p_tour_id uuid,
  p_request_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tour public.listing_tours%rowtype;
  v_request public.peek_requests%rowtype;
  v_count integer := 0;
  v_request_id uuid;
  v_link text;
  v_kind text;
begin
  if coalesce(cardinality(p_request_ids), 0) = 0 or cardinality(p_request_ids) > 25 then
    raise exception 'choose between 1 and 25 Peek Requests' using errcode = '22023';
  end if;
  if cardinality(p_request_ids) <> (select count(distinct x) from unnest(p_request_ids) x) then
    raise exception 'duplicate Peek Request selections are not allowed' using errcode = '22023';
  end if;

  select * into v_tour from public.listing_tours where id = p_tour_id for update;
  if not found then raise exception 'Response Peek not found' using errcode = 'P0002'; end if;
  if v_tour.peek_kind <> 'response' or v_tour.status <> 'published' or v_tour.moderation_status <> 'approved' then
    raise exception 'Response Peek must be published and approved before binding' using errcode = '22023';
  end if;
  perform private.assert_peek_parent_owner(v_tour.listing_id, v_tour.service_id, auth.uid());

  foreach v_request_id in array p_request_ids loop
    select * into v_request from public.peek_requests where id = v_request_id for update;
    if not found then raise exception 'Peek Request not found' using errcode = 'P0002'; end if;
    if v_request.listing_id is distinct from v_tour.listing_id or v_request.service_id is distinct from v_tour.service_id then
      raise exception 'Response Peek and request must share the same parent' using errcode = '22023';
    end if;
    if v_request.status not in ('pending', 'answered', 'declined', 'expired')
       or v_request.moderation_status <> 'approved' or v_request.merged_into_id is not null then
      raise exception 'this Peek Request cannot be answered' using errcode = '22023';
    end if;
    update public.peek_request_responses
    set is_current = false, superseded_at = now()
    where request_id = v_request_id and is_current;
    insert into public.peek_request_responses(request_id, tour_id, is_current)
      values (v_request_id, p_tour_id, true)
      on conflict(request_id, tour_id) do update set is_current = true, superseded_at = null;
    update public.peek_requests
    set status = 'answered', current_response_id = p_tour_id,
        answered_at = now(), declined_at = null, decline_reason = null
    where id = v_request_id;
    v_count := v_count + 1;
  end loop;

  if v_tour.listing_id is not null then
    select kind::text into v_kind from public.listings where id = v_tour.listing_id;
    v_link := '/' || case when v_kind = 'car' then 'car' when v_kind = 'machinery' then 'machinery' else 'property' end
      || '/' || v_tour.listing_id::text || '?responsePeek=' || p_tour_id::text || '#peek-threads';
  else
    v_link := '/service/' || v_tour.service_id::text || '?responsePeek=' || p_tour_id::text || '#peek-threads';
  end if;

  with recipients as (
    select r.requester_id as user_id, true as is_requester
    from public.peek_requests r where r.id = any(p_request_ids)
    union all
    select s.user_id, false
    from public.peek_request_supporters s where s.request_id = any(p_request_ids)
  ), deduped as (
    select user_id, bool_or(is_requester) as is_requester
    from recipients
    where user_id is not null and user_id <> auth.uid()
    group by user_id
  )
  insert into public.app_alerts(
    user_id, title, message, type, link, is_read, listing_id, event_type, source_key, created_at
  )
  select d.user_id,
    case when d.is_requester then 'Your Peek Request has been answered' else 'A Peek you wanted is now available' end,
    'The seller added new visual evidence. Watch the Response Peek on the listing.',
    'status_change'::public.alert_type,
    v_link, false, v_tour.listing_id, 'peek_request_answered', p_tour_id::text, now()
  from deduped d
  on conflict(user_id, event_type, source_key)
  where event_type is not null and source_key is not null
  do nothing;
  return v_count;
end;
$function$;

create or replace function private.admin_unified_audit_activity_page(
  p_query text default '',
  p_target_type text default 'all',
  p_limit integer default 50,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  audit_id uuid,
  admin_user_id uuid,
  admin_email text,
  action_performed text,
  target_record_id text,
  target_record_type text,
  reason text,
  result text,
  correlation_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  normalized_query text := trim(coalesce(p_query, ''));
  escaped_query text;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 100
     or length(normalized_query) > 100
     or p_target_type not in (
       'all', 'user', 'property', 'car', 'machinery', 'service',
       'report', 'tour_report', 'listing_tour', 'category',
       'support_request', 'business_review', 'recommendation_configuration',
       'managed_listing_request'
     )
     or ((p_cursor_at is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid audit page' using errcode = '22023';
  end if;

  escaped_query := replace(replace(replace(normalized_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');

  return query
  with activity as (
    select
      a.id as audit_id, a.admin_user_id, u.email as admin_email,
      a.action_performed, a.target_record_id, a.target_record_type,
      a.reason, a.result, a.correlation_id, a.created_at
    from public.audit_logs a
    left join public.users u on u.id = a.admin_user_id
    union all
    select
      md5('business-review:' || e.id::text)::uuid, e.actor_user_id, u.email,
      'business_review.' || e.action,
      coalesce(e.category_approval_id, e.application_id)::text,
      'business_review', e.message, e.new_status, null::uuid, e.created_at
    from public.business_review_events e
    left join public.users u on u.id = e.actor_user_id
    union all
    select
      md5('recommendation-configuration:' || a.id::text)::uuid, a.actor_id, u.email,
      'recommendation.' || a.action, a.entity_id::text,
      'recommendation_configuration', null::text, a.entity_type, null::uuid, a.created_at
    from public.recommendation_configuration_audit a
    left join public.users u on u.id = a.actor_id
  ), filtered as (
    select activity.*
    from activity
    where (p_target_type = 'all' or activity.target_record_type = p_target_type)
      and (
        normalized_query = ''
        or coalesce(activity.admin_email, '') ilike '%' || escaped_query || '%' escape E'\\'
        or activity.action_performed ilike '%' || escaped_query || '%' escape E'\\'
        or coalesce(activity.target_record_id, '') ilike '%' || escaped_query || '%' escape E'\\'
        or coalesce(activity.reason, '') ilike '%' || escaped_query || '%' escape E'\\'
        or coalesce(activity.result, '') ilike '%' || escaped_query || '%' escape E'\\'
      )
      and (p_cursor_at is null or (activity.created_at, activity.audit_id) < (p_cursor_at, p_cursor_id))
  )
  select
    filtered.audit_id, filtered.admin_user_id, coalesce(filtered.admin_email, 'System'),
    filtered.action_performed, filtered.target_record_id, filtered.target_record_type,
    filtered.reason, filtered.result, filtered.correlation_id, filtered.created_at
  from filtered
  order by filtered.created_at desc, filtered.audit_id desc
  limit p_limit + 1;
end;
$function$;

commit;
