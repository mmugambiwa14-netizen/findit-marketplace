-- 0019_v1_essential_notifications.sql
-- Bounded V1 operational notifications only. Legacy AppAlert rows remain
-- preserved but are not exposed through the V1 notification RPCs.

alter table public.app_alerts
  add column event_type text,
  add column source_key text,
  add column read_at timestamptz;

alter table public.app_alerts
  add constraint app_alerts_v1_event_type_check check (
    event_type is null or event_type in (
      'listing_approved',
      'listing_rejected',
      'listing_expires_soon',
      'report_resolved',
      'account_status'
    )
  ),
  add constraint app_alerts_source_key_check check (
    source_key is null or (length(source_key) between 1 and 200)
  ),
  add constraint app_alerts_v1_lengths_check check (
    event_type is null or (
      length(title) between 1 and 120
      and length(message) between 1 and 1000
    )
  );

create unique index idx_app_alerts_v1_source
  on public.app_alerts(user_id, event_type, source_key)
  where event_type is not null and source_key is not null;

alter table public.listings
  add column expires_at timestamptz,
  add column expiry_notice_sent_at timestamptz;

update public.listings
set expires_at = now() + interval '30 days'
where status in ('available', 'under_offer', 'rented') and expires_at is null;

create index idx_listings_expiry_due
  on public.listings(expires_at)
  where status in ('available', 'under_offer', 'rented');

create or replace function public.is_safe_notification_link(p_link text)
returns boolean as $$
  select p_link is null or (
    length(p_link) between 1 and 200
    and (
      p_link in ('/my-listings', '/profile', '/settings')
      or p_link ~ '^/(property|car|machinery|messages)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
  );
$$ language sql immutable set search_path = public;

create or replace function public.create_essential_notification(
  p_user_id uuid,
  p_event_type text,
  p_source_key text,
  p_title text,
  p_message text,
  p_link text default null,
  p_listing_id uuid default null
)
returns uuid as $$
declare
  alert_id uuid;
  normalized_title text := trim(coalesce(p_title, ''));
  normalized_message text := trim(coalesce(p_message, ''));
  normalized_source text := trim(coalesce(p_source_key, ''));
begin
  if p_event_type not in (
    'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status'
  ) then
    raise exception 'unsupported notification event' using errcode = '22023';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'notification recipient not found' using errcode = 'P0002';
  end if;
  if length(normalized_source) not between 1 and 200 then
    raise exception 'notification source key is invalid' using errcode = '22023';
  end if;
  if length(normalized_title) not between 1 and 120
    or length(normalized_message) not between 1 and 1000
  then
    raise exception 'notification content is invalid' using errcode = '22023';
  end if;
  if not public.is_safe_notification_link(p_link) then
    raise exception 'notification link is invalid' using errcode = '22023';
  end if;
  if p_listing_id is not null
    and not exists (select 1 from public.listings where id = p_listing_id)
  then
    raise exception 'notification listing not found' using errcode = 'P0002';
  end if;

  insert into public.app_alerts (
    user_id, title, message, type, link, listing_id, event_type, source_key
  ) values (
    p_user_id,
    normalized_title,
    normalized_message,
    case when p_event_type = 'account_status' then 'system'::alert_type else 'status_change'::alert_type end,
    p_link,
    p_listing_id,
    p_event_type,
    normalized_source
  )
  on conflict (user_id, event_type, source_key)
    where event_type is not null and source_key is not null
  do nothing
  returning id into alert_id;

  if alert_id is null then
    select id into alert_id
    from public.app_alerts
    where user_id = p_user_id
      and event_type = p_event_type
      and source_key = normalized_source;
  end if;
  return alert_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.create_essential_notification(uuid, text, text, text, text, text, uuid) from public;
revoke all on function public.is_safe_notification_link(text) from public;

create or replace function public.protect_alert_fields()
returns trigger as $$
begin
  if auth.uid() = old.user_id and not public.is_admin() and (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.title is distinct from old.title
    or new.message is distinct from old.message
    or new.type is distinct from old.type
    or new.event_type is distinct from old.event_type
    or new.source_key is distinct from old.source_key
    or new.link is distinct from old.link
    or new.listing_id is distinct from old.listing_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'notification content requires a trusted operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop policy if exists "app_alerts_owner_update" on public.app_alerts;
revoke insert, update, delete on public.app_alerts from anon, authenticated;
grant select on public.app_alerts to authenticated;

create or replace function public.notification_rows(
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
) as $$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_event_type not in (
    'all', 'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status'
  ) then
    raise exception 'unsupported notification filter' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 or p_offset > 1000000 then
    raise exception 'invalid notification page' using errcode = '22023';
  end if;

  return query
  select
    a.id,
    a.event_type,
    a.title,
    a.message,
    case when public.is_safe_notification_link(a.link) then a.link else null end,
    a.is_read,
    a.read_at,
    a.listing_id,
    a.created_at,
    count(*) over()
  from public.app_alerts a
  where a.user_id = auth.uid()
    and a.event_type is not null
    and (p_event_type = 'all' or a.event_type = p_event_type)
    and (not p_unread_only or not a.is_read)
  order by a.created_at desc, a.id desc
  limit p_limit offset p_offset;
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.notification_unread_count()
returns bigint as $$
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  return (
    select count(*)
    from public.app_alerts
    where user_id = auth.uid() and event_type is not null and not is_read
  );
end;
$$ language plpgsql stable security definer set search_path = public;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean as $$
declare
  changed boolean;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  update public.app_alerts
  set is_read = true, read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = auth.uid() and event_type is not null;
  changed := found;
  return changed;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.mark_all_notifications_read()
returns integer as $$
declare
  changed integer;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  update public.app_alerts
  set is_read = true, read_at = coalesce(read_at, now())
  where user_id = auth.uid() and event_type is not null and not is_read;
  get diagnostics changed = row_count;
  return changed;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.notification_rows(text, boolean, integer, integer) from public;
revoke all on function public.notification_unread_count() from public;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.notification_rows(text, boolean, integer, integer) to authenticated;
grant execute on function public.notification_unread_count() to authenticated, service_role;
grant execute on function public.mark_notification_read(uuid) to authenticated, service_role;
grant execute on function public.mark_all_notifications_read() to authenticated, service_role;

create or replace function public.set_listing_expiry_defaults()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('available', 'under_offer', 'rented') and new.expires_at is null then
      new.expires_at := now() + interval '30 days';
    end if;
    new.expiry_notice_sent_at := null;
    return new;
  end if;

  if new.status in ('available', 'under_offer', 'rented')
    and old.status is distinct from new.status
  then
    new.expires_at := now() + interval '30 days';
    new.expiry_notice_sent_at := null;
  elsif auth.uid() = old.seller_id and not public.is_admin() then
    new.expires_at := old.expires_at;
    new.expiry_notice_sent_at := old.expiry_notice_sent_at;
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger trg_listings_expiry_defaults
  before insert or update on public.listings
  for each row execute function public.set_listing_expiry_defaults();

create or replace function public.process_listing_expiry_notifications(
  p_now timestamptz default now()
)
returns jsonb as $$
declare
  candidate record;
  notices integer := 0;
  expired integer := 0;
begin
  for candidate in
    select id, seller_id, title, kind, expires_at
    from public.listings
    where status in ('available', 'under_offer', 'rented')
      and expires_at > p_now
      and expires_at <= p_now + interval '3 days'
      and expiry_notice_sent_at is null
    for update skip locked
  loop
    perform public.create_essential_notification(
      candidate.seller_id,
      'listing_expires_soon',
      'listing:' || candidate.id::text || ':expiry:' || candidate.expires_at::text,
      'Listing expires soon',
      candidate.title || ' expires on ' || to_char(candidate.expires_at at time zone 'UTC', 'YYYY-MM-DD') || '.',
      '/my-listings',
      candidate.id
    );
    update public.listings set expiry_notice_sent_at = p_now where id = candidate.id;
    notices := notices + 1;
  end loop;

  update public.listings
  set status = 'expired'
  where status in ('available', 'under_offer', 'rented')
    and expires_at is not null and expires_at <= p_now;
  get diagnostics expired = row_count;
  return jsonb_build_object('notices_created', notices, 'listings_expired', expired);
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.process_listing_expiry_notifications(timestamptz) from public;
grant execute on function public.process_listing_expiry_notifications(timestamptz) to service_role;

create or replace function public.admin_moderate_marketplace_item(
  p_item_id uuid,
  p_kind text,
  p_action text,
  p_reason text
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  before_row jsonb;
  after_row jsonb;
  correlation uuid := gen_random_uuid();
  target_owner uuid;
  target_title text;
begin
  if p_kind not in ('property', 'car', 'machinery', 'service')
    or p_action not in ('publish', 'pause', 'reject', 'remove')
  then
    raise exception 'invalid moderation operation' using errcode = '22023';
  end if;
  if p_kind = 'service' and p_action = 'reject' then
    raise exception 'service rejection is not supported by the V1 notification contract' using errcode = '22023';
  end if;

  if p_kind = 'service' then
    select to_jsonb(s) into before_row
    from public.services s
    where s.id = p_item_id and s.category <> 'legal'
    for update;
    if before_row is null then
      raise exception 'marketplace item not found' using errcode = 'P0002';
    end if;
    if p_action = 'remove' then
      delete from public.services where id = p_item_id;
      after_row := jsonb_build_object('removed', true);
    else
      update public.services
      set status = case when p_action = 'publish' then 'active'::service_status else 'paused'::service_status end
      where id = p_item_id returning to_jsonb(public.services.*) into after_row;
    end if;
  else
    select to_jsonb(l), l.seller_id, l.title
      into before_row, target_owner, target_title
    from public.listings l
    where l.id = p_item_id and l.kind::text = p_kind
    for update;
    if before_row is null then
      raise exception 'marketplace item not found' using errcode = 'P0002';
    end if;

    if p_action = 'remove' then
      update public.reports
      set status = 'actioned', admin_notes = normalized_reason,
          reviewed_by = auth.uid(), reviewed_at = now()
      where listing_id = p_item_id and status in ('pending', 'reviewed');
      update public.reports set listing_id = null where listing_id = p_item_id;
      delete from public.listings where id = p_item_id;
      after_row := jsonb_build_object('removed', true);
    else
      update public.listings
      set status = case when p_action = 'publish' then 'available'::listing_status else 'draft'::listing_status end
      where id = p_item_id returning to_jsonb(public.listings.*) into after_row;

      if p_action in ('publish', 'reject') then
        perform public.create_essential_notification(
          target_owner,
          case when p_action = 'publish' then 'listing_approved' else 'listing_rejected' end,
          'moderation:' || correlation::text,
          case when p_action = 'publish' then 'Listing approved' else 'Listing rejected' end,
          case when p_action = 'publish'
            then target_title || ' is now live on FindIt.'
            else target_title || ' was not approved. Reason: ' || normalized_reason
          end,
          '/my-listings',
          p_item_id
        );
      end if;
    end if;
  end if;

  perform public.record_admin_action(
    'marketplace.' || p_action, p_item_id::text, p_kind, normalized_reason,
    before_row, after_row, correlation
  );
  return after_row || jsonb_build_object('correlation_id', correlation);
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status user_status,
  p_reason text,
  p_ban_until timestamptz default null
)
returns jsonb as $$
declare
  normalized_reason text := public.require_admin_reason(p_reason);
  before_row jsonb;
  after_row jsonb;
  correlation uuid := gen_random_uuid();
begin
  if p_user_id = auth.uid() then
    raise exception 'self status changes are not allowed' using errcode = '42501';
  end if;
  select to_jsonb(u) into before_row from public.users u where u.id = p_user_id for update;
  if before_row is null then raise exception 'user not found' using errcode = 'P0002'; end if;
  if coalesce((before_row ->> 'super_admin')::boolean, false) and not public.is_super_admin() then
    raise exception 'only a super admin can change this account' using errcode = '42501';
  end if;
  if p_status = 'banned' and p_ban_until is not null and p_ban_until <= now() then
    raise exception 'ban expiry must be in the future' using errcode = '22023';
  end if;

  update public.users
  set status = p_status,
      ban_reason = case when p_status = 'active' then null else normalized_reason end,
      ban_until = case when p_status = 'banned' then p_ban_until else null end
  where id = p_user_id returning to_jsonb(public.users.*) into after_row;

  perform public.create_essential_notification(
    p_user_id,
    'account_status',
    'account:' || correlation::text,
    case p_status when 'active' then 'Account restored' when 'suspended' then 'Account suspended' else 'Account banned' end,
    normalized_reason,
    case when p_status = 'active' then '/profile' else null end,
    null
  );
  perform public.record_admin_action(
    'user.status_changed', p_user_id::text, 'user', normalized_reason,
    before_row - array['phone_otp_code', 'phone_otp_pending'],
    after_row - array['phone_otp_code', 'phone_otp_pending'], correlation
  );
  return after_row - array['phone_otp_code', 'phone_otp_pending'];
end;
$$ language plpgsql security definer set search_path = public;

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
  target_conversation uuid;
  target_reporter uuid;
  report_link text;
begin
  if p_status not in ('reviewed', 'dismissed', 'actioned') then
    raise exception 'invalid report decision' using errcode = '22023';
  end if;

  select to_jsonb(r), r.listing_id, r.reporter_id
    into before_row, target_listing, target_reporter
  from public.reports r where r.id = p_report_id for update;

  if before_row is not null then
    if target_listing is not null then
      select '/' || kind::text || '/' || id::text into report_link
      from public.listings where id = target_listing;
    end if;
    if p_status = 'actioned' then
      if target_listing is null then
        raise exception 'reported listing is no longer available' using errcode = 'P0002';
      end if;
      update public.reports
      set status = 'actioned', admin_notes = normalized_reason,
          reviewed_by = auth.uid(), reviewed_at = now()
      where listing_id = target_listing and status in ('pending', 'reviewed');
      update public.reports set listing_id = null where listing_id = target_listing;
      delete from public.listings where id = target_listing;
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
        target_reporter, 'report_resolved',
        'report:' || p_report_id::text || ':' || p_status::text,
        'Report resolved', normalized_reason, report_link,
        case when p_status = 'actioned' then null else target_listing end
      );
    end if;
    perform public.record_admin_action(
      'report.' || p_status::text, p_report_id::text, 'report',
      normalized_reason, before_row, after_row
    );
    return after_row;
  end if;

  select to_jsonb(cr), cr.conversation_id, cr.reporter_id
    into before_row, target_conversation, target_reporter
  from public.conversation_reports cr where cr.id = p_report_id for update;
  if before_row is null then raise exception 'report not found' using errcode = 'P0002'; end if;

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
      target_reporter, 'report_resolved',
      'conversation-report:' || p_report_id::text || ':' || p_status::text,
      'Report resolved', normalized_reason,
      '/messages/' || target_conversation::text, null
    );
  end if;
  perform public.record_admin_action(
    'conversation_report.' || p_status::text, p_report_id::text,
    'conversation_report', normalized_reason, before_row, after_row
  );
  return after_row;
end;
$$ language plpgsql security definer set search_path = public;

comment on column public.app_alerts.event_type is
  'Null for preserved legacy rows; otherwise one of five allowlisted V1 operational event classes.';
comment on function public.process_listing_expiry_notifications(timestamptz) is
  'Service-only expiry worker; schedule once daily after deployment ownership and monitoring are configured.';
