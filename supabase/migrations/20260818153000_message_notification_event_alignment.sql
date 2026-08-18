begin;

-- Keep message notifications on the canonical event vocabulary used by the
-- current client, push preferences and notification centre. Older staging
-- runtimes briefly used message_received; accept that input only as a
-- compatibility alias and persist it as new_message.
create or replace function public.create_essential_notification(
  p_user_id uuid,
  p_event_type text,
  p_source_key text,
  p_title text,
  p_message text,
  p_link text default null,
  p_listing_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  alert_id uuid;
  normalized_event text := case
    when p_event_type = 'message_received' then 'new_message'
    else trim(coalesce(p_event_type, ''))
  end;
  normalized_title text := trim(coalesce(p_title, ''));
  normalized_message text := trim(coalesce(p_message, ''));
  normalized_source text := trim(coalesce(p_source_key, ''));
begin
  if normalized_event not in (
    'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
    'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable',
    'peek_request_created', 'peek_request_answered',
    'business_application_updated', 'business_category_updated',
    'managed_listing_updated', 'new_message'
  ) then
    raise exception 'unsupported notification event' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'notification recipient not found' using errcode = 'P0002';
  end if;
  if length(normalized_source) not between 1 and 200
    or length(normalized_title) not between 1 and 120
    or length(normalized_message) not between 1 and 1000
    or not public.is_safe_notification_link(p_link)
  then
    raise exception 'notification payload is invalid' using errcode = '22023';
  end if;
  if p_listing_id is not null
    and not exists (select 1 from public.listings where id = p_listing_id)
  then
    raise exception 'notification listing not found' using errcode = 'P0002';
  end if;

  insert into public.app_alerts (
    user_id, title, message, type, link, listing_id, event_type, source_key
  ) values (
    p_user_id, normalized_title, normalized_message,
    case when normalized_event = 'account_status' then 'system'::alert_type else 'status_change'::alert_type end,
    p_link, p_listing_id, normalized_event, normalized_source
  )
  on conflict (user_id, event_type, source_key)
    where event_type is not null and source_key is not null
  do nothing
  returning id into alert_id;

  if alert_id is null then
    select id into alert_id
    from public.app_alerts
    where user_id = p_user_id
      and event_type = normalized_event
      and source_key = normalized_source;
  end if;
  return alert_id;
end;
$function$;

revoke all on function public.create_essential_notification(uuid, text, text, text, text, text, uuid)
  from public, anon, authenticated;

-- There was a second, older inquiry trigger on staging. The current trigger
-- below is the single message-notification path and is idempotent by source key.
drop trigger if exists inquiries_notify_recipient on public.inquiries;
drop trigger if exists inquiries_enqueue_message_notification on public.inquiries;
create trigger inquiries_enqueue_message_notification
after insert on public.inquiries
for each row
when (new.conversation_id is not null and new.sender_id is not null)
execute function public.enqueue_message_notification();

-- The cursor RPC must accept the same event set as the offset RPC and client.
create or replace function private.notification_rows_page(
  p_event_type text default 'all',
  p_unread_only boolean default false,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table(
  notification_id uuid,
  event_type text,
  title text,
  message text,
  link text,
  is_read boolean,
  read_at timestamptz,
  listing_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode='42501';
  end if;
  if p_event_type not in (
    'all','listing_approved','listing_rejected','listing_expires_soon',
    'report_resolved','account_status','tour_ready','tour_failed',
    'tour_rejected','listing_status_changed','saved_listing_unavailable',
    'peek_request_created','peek_request_answered',
    'business_application_updated','business_category_updated',
    'managed_listing_updated','new_message'
  ) or p_limit not between 1 and 50
    or ((p_cursor_at is null) <> (p_cursor_id is null))
  then
    raise exception 'invalid notification page' using errcode='22023';
  end if;

  return query
  select a.id, a.event_type, a.title, a.message,
    case when public.is_safe_notification_link(a.link) then a.link else null end,
    a.is_read, a.read_at, a.listing_id, a.created_at
  from public.app_alerts a
  where a.user_id = auth.uid()
    and a.event_type is not null
    and (p_event_type = 'all' or a.event_type = p_event_type)
    and (not p_unread_only or not a.is_read)
    and (p_cursor_at is null or (a.created_at, a.id) < (p_cursor_at, p_cursor_id))
  order by a.created_at desc, a.id desc
  limit p_limit + 1;
end;
$function$;

commit;
