begin;

-- Keep authenticated-callable implementations behind the established private
-- boundary. Moving the existing functions preserves their tested logic and
-- explicit role grants; public names remain compatibility wrappers only.
alter function public.get_web_push_notification_preferences() set schema private;
alter function public.update_web_push_notification_preferences(boolean,boolean,boolean,boolean,boolean) set schema private;

create function public.get_web_push_notification_preferences()
returns public.web_push_notification_preferences
language sql
volatile
security invoker
set search_path = ''
as $wrapper$
  select private.get_web_push_notification_preferences();
$wrapper$;

create function public.update_web_push_notification_preferences(
  p_messages boolean,
  p_peek_activity boolean,
  p_listing_activity boolean,
  p_business_activity boolean,
  p_moderation boolean
)
returns public.web_push_notification_preferences
language sql
volatile
security invoker
set search_path = ''
as $wrapper$
  select private.update_web_push_notification_preferences($1,$2,$3,$4,$5);
$wrapper$;

revoke all on function public.get_web_push_notification_preferences() from public,anon,authenticated,service_role;
revoke all on function public.update_web_push_notification_preferences(boolean,boolean,boolean,boolean,boolean) from public,anon,authenticated,service_role;
grant execute on function public.get_web_push_notification_preferences() to authenticated;
grant execute on function public.update_web_push_notification_preferences(boolean,boolean,boolean,boolean,boolean) to authenticated;

-- Recreate the report review implementation without a PL/pgSQL variable whose
-- name collides with reports.target_type. Moderation semantics are unchanged:
-- reviewed/dismissed never remove content and only actioned performs takedown.
create or replace function private.admin_review_report(
  p_report_id uuid,
  p_status public.report_status,
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
  v_target_type text;
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
    before_row, target_listing, target_service, target_tour, v_target_type,
    target_reporter
  from public.reports r
  where r.id = p_report_id
  for update;

  if before_row is not null then
    if v_target_type = 'tour' then
      if p_status = 'actioned' then
        perform public.admin_reject_tour(target_tour, normalized_reason);
        update public.reports
        set status = 'actioned', admin_notes = normalized_reason,
            reviewed_by = auth.uid(), reviewed_at = now()
        where tour_id = target_tour and status in ('pending', 'reviewed');
      elsif p_status = 'dismissed' then
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
      if v_target_type = 'service' then
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
$function$;

commit;
