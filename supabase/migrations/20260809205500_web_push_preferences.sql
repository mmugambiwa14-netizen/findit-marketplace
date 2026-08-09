begin;

create table if not exists public.web_push_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages boolean not null default true,
  peek_activity boolean not null default true,
  listing_activity boolean not null default true,
  business_activity boolean not null default true,
  moderation boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.web_push_notification_preferences enable row level security;
revoke all on public.web_push_notification_preferences from anon, authenticated;

create or replace function public.get_web_push_notification_preferences()
returns public.web_push_notification_preferences
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.web_push_notification_preferences;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  insert into public.web_push_notification_preferences(user_id)
  values(v_user_id) on conflict(user_id) do nothing;
  select * into v_row from public.web_push_notification_preferences where user_id=v_user_id;
  return v_row;
end;
$function$;

create or replace function public.update_web_push_notification_preferences(
  p_messages boolean,
  p_peek_activity boolean,
  p_listing_activity boolean,
  p_business_activity boolean,
  p_moderation boolean
)
returns public.web_push_notification_preferences
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.web_push_notification_preferences;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  insert into public.web_push_notification_preferences(
    user_id,messages,peek_activity,listing_activity,business_activity,moderation,updated_at
  ) values(
    v_user_id,coalesce(p_messages,true),coalesce(p_peek_activity,true),coalesce(p_listing_activity,true),
    coalesce(p_business_activity,true),coalesce(p_moderation,true),now()
  )
  on conflict(user_id) do update set
    messages=excluded.messages,
    peek_activity=excluded.peek_activity,
    listing_activity=excluded.listing_activity,
    business_activity=excluded.business_activity,
    moderation=excluded.moderation,
    updated_at=now()
  returning * into v_row;
  return v_row;
end;
$function$;

revoke all on function public.get_web_push_notification_preferences() from public,anon;
revoke all on function public.update_web_push_notification_preferences(boolean,boolean,boolean,boolean,boolean) from public,anon;
grant execute on function public.get_web_push_notification_preferences() to authenticated;
grant execute on function public.update_web_push_notification_preferences(boolean,boolean,boolean,boolean,boolean) to authenticated;

create or replace function public.web_push_event_enabled(p_user_id uuid,p_event_type text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when p_event_type='account_status' then true
    when p_event_type='new_message' then coalesce((select messages from public.web_push_notification_preferences where user_id=p_user_id),true)
    when p_event_type in ('peek_request_created','peek_request_answered','tour_ready','tour_failed','tour_rejected') then coalesce((select peek_activity from public.web_push_notification_preferences where user_id=p_user_id),true)
    when p_event_type in ('listing_approved','listing_rejected','listing_expires_soon','listing_status_changed','saved_listing_unavailable') then coalesce((select listing_activity from public.web_push_notification_preferences where user_id=p_user_id),true)
    when p_event_type in ('business_application_updated','business_category_updated','managed_listing_updated') then coalesce((select business_activity from public.web_push_notification_preferences where user_id=p_user_id),true)
    when p_event_type='report_resolved' then coalesce((select moderation from public.web_push_notification_preferences where user_id=p_user_id),true)
    else true
  end;
$function$;
revoke all on function public.web_push_event_enabled(uuid,text) from public,anon,authenticated;

create or replace function public.enqueue_web_push_for_alert()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  if public.web_push_event_enabled(new.user_id,new.event_type)
     and exists(select 1 from public.web_push_subscriptions s where s.user_id=new.user_id and s.enabled)
  then
    insert into public.web_push_delivery_jobs(alert_id,user_id)
    values(new.id,new.user_id)
    on conflict(alert_id) do nothing;
  end if;
  return new;
end;
$function$;

commit;
