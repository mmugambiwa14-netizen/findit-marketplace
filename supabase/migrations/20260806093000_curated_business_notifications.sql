begin;

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
set search_path = 'public'
as $$
declare
  alert_id uuid;
  normalized_title text := trim(coalesce(p_title, ''));
  normalized_message text := trim(coalesce(p_message, ''));
  normalized_source text := trim(coalesce(p_source_key, ''));
begin
  if p_event_type not in (
    'listing_approved', 'listing_rejected', 'listing_expires_soon',
    'report_resolved', 'account_status', 'tour_ready', 'tour_failed',
    'tour_rejected', 'listing_status_changed', 'saved_listing_unavailable',
    'business_application_updated', 'business_category_updated',
    'managed_listing_updated'
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
  if p_listing_id is not null and not exists (select 1 from public.listings where id = p_listing_id) then
    raise exception 'notification listing not found' using errcode = 'P0002';
  end if;

  insert into public.app_alerts (
    user_id, title, message, type, link, listing_id, event_type, source_key
  ) values (
    p_user_id, normalized_title, normalized_message,
    case when p_event_type = 'account_status' then 'system'::alert_type else 'status_change'::alert_type end,
    p_link, p_listing_id, p_event_type, normalized_source
  )
  on conflict (user_id, event_type, source_key)
    where event_type is not null and source_key is not null
  do nothing
  returning id into alert_id;

  if alert_id is null then
    select id into alert_id from public.app_alerts
    where user_id = p_user_id and event_type = p_event_type and source_key = normalized_source;
  end if;
  return alert_id;
end;
$$;

create or replace function private.notify_business_application_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_message text;
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  v_title := case new.status
    when 'reviewing' then 'Business application under review'
    when 'needs_information' then 'More information is needed'
    when 'approved' then 'Business application approved'
    when 'rejected' then 'Business application not approved'
    else 'Business application updated'
  end;
  v_message := case new.status
    when 'reviewing' then 'PeekaListing is reviewing your business application.'
    when 'needs_information' then coalesce(nullif(new.reviewer_message, ''), 'Please provide the requested information to continue your application.')
    when 'approved' then 'Your business application has been approved. You can publish only in categories approved separately.'
    when 'rejected' then coalesce(nullif(new.reviewer_message, ''), 'Your business application was not approved.')
    else 'Your business application status changed to ' || replace(new.status, '_', ' ') || '.'
  end;

  perform public.create_essential_notification(
    new.user_id,
    'business_application_updated',
    new.id::text || ':' || new.status || ':' || extract(epoch from new.updated_at)::bigint,
    v_title,
    v_message,
    '/post',
    null
  );
  return new;
end;
$$;

create or replace function private.notify_business_category_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_message text;
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  v_title := initcap(new.category) || ' publishing ' || replace(new.status, '_', ' ');
  v_message := case new.status
    when 'approved' then 'Your business can now publish in ' || initcap(new.category) || '.'
    when 'rejected' then coalesce(nullif(new.reviewer_message, ''), 'Your request to publish in ' || initcap(new.category) || ' was not approved.')
    when 'suspended' then coalesce(nullif(new.reviewer_message, ''), initcap(new.category) || ' publishing has been suspended.')
    when 'pending' then 'Your ' || initcap(new.category) || ' category request is awaiting review.'
    else 'Your ' || initcap(new.category) || ' publishing status changed.'
  end;

  perform public.create_essential_notification(
    new.user_id,
    'business_category_updated',
    new.id::text || ':' || new.status || ':' || extract(epoch from new.updated_at)::bigint,
    v_title,
    v_message,
    '/post',
    null
  );
  return new;
end;
$$;

create or replace function private.notify_managed_listing_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_message text;
begin
  if tg_op <> 'UPDATE' or new.status is not distinct from old.status then
    return new;
  end if;

  v_title := 'Managed listing ' || replace(new.status, '_', ' ');
  v_message := case new.status
    when 'reviewing' then 'PeekaListing has started reviewing your advertising request.'
    when 'accepted' then 'Your advertising request has been accepted for preparation.'
    when 'needs_information' then coalesce(nullif(new.reviewer_message, ''), 'More information is needed for your advertising request.')
    when 'declined' then coalesce(nullif(new.reviewer_message, ''), 'Your advertising request was not accepted.')
    when 'published' then 'Your managed listing has been published.'
    when 'cancelled' then 'Your managed listing request has been cancelled.'
    else 'Your managed listing request was updated.'
  end;

  perform public.create_essential_notification(
    new.requester_user_id,
    'managed_listing_updated',
    new.id::text || ':' || new.status || ':' || extract(epoch from new.updated_at)::bigint,
    v_title,
    v_message,
    '/post',
    null
  );
  return new;
end;
$$;

revoke all on function private.notify_business_application_change() from public, anon, authenticated;
revoke all on function private.notify_business_category_change() from public, anon, authenticated;
revoke all on function private.notify_managed_listing_change() from public, anon, authenticated;

drop trigger if exists business_applications_notify_status on public.business_applications;
create trigger business_applications_notify_status
after update of status on public.business_applications
for each row execute function private.notify_business_application_change();

drop trigger if exists business_category_approvals_notify_status on public.business_category_approvals;
create trigger business_category_approvals_notify_status
after update of status on public.business_category_approvals
for each row execute function private.notify_business_category_change();

drop trigger if exists managed_listing_requests_notify_status on public.managed_listing_requests;
create trigger managed_listing_requests_notify_status
after update of status on public.managed_listing_requests
for each row execute function private.notify_managed_listing_change();

commit;
