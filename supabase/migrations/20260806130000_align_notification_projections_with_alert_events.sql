begin;

do $migration$
begin
  if to_regprocedure('private.notification_rows(text, boolean, integer, integer)') is null
     or to_regprocedure('private.notification_rows_page(text, boolean, timestamptz, uuid, integer)') is null then
    raise exception 'expected notification projections to live in private';
  end if;
end;
$migration$;

create or replace function private.notification_rows(
  p_event_type text default 'all',
  p_unread_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  notification_id uuid,
  event_type text,
  title text,
  message text,
  link text,
  is_read boolean,
  read_at timestamptz,
  listing_id uuid,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_event_type not in (
    'all', 'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
    'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable',
    'peek_request_created', 'peek_request_answered'
  ) or p_limit not between 1 and 100 or p_offset not between 0 and 1000000 then
    raise exception 'invalid notification page' using errcode = '22023';
  end if;

  return query
  select a.id, a.event_type, a.title, a.message,
    case when public.is_safe_notification_link(a.link) then a.link else null end,
    a.is_read, a.read_at, a.listing_id, a.created_at, count(*) over()
  from public.app_alerts a
  where a.user_id = auth.uid()
    and a.event_type is not null
    and (p_event_type = 'all' or a.event_type = p_event_type)
    and (not p_unread_only or not a.is_read)
  order by a.created_at desc, a.id desc
  limit p_limit offset p_offset;
end;
$$;

create or replace function private.notification_rows_page(
  p_event_type text default 'all',
  p_unread_only boolean default false,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table (
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
set search_path = ''
as $$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_event_type not in (
    'all', 'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
    'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable',
    'peek_request_created', 'peek_request_answered'
  ) or p_limit not between 1 and 50
    or ((p_cursor_at is null) <> (p_cursor_id is null)) then
    raise exception 'invalid notification page' using errcode = '22023';
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
$$;

commit;
