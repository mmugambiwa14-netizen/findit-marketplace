begin;

create or replace function private.register_web_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_platform text default 'web'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_existing_user uuid;
  v_endpoint text := trim(coalesce(p_endpoint,''));
begin
  if v_user_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if length(v_endpoint) < 20
     or length(trim(coalesce(p_p256dh,''))) < 20
     or length(trim(coalesce(p_auth,''))) < 8 then
    raise exception 'invalid push subscription' using errcode='22023';
  end if;

  select user_id into v_existing_user
  from public.web_push_subscriptions
  where endpoint=v_endpoint;

  if v_existing_user is not null and v_existing_user <> v_user_id then
    raise exception 'push subscription belongs to another account' using errcode='42501';
  end if;

  insert into public.web_push_subscriptions
    (user_id,endpoint,p256dh,auth,user_agent,platform,enabled,last_seen_at,
     failure_count,last_success_at,last_failure_at,updated_at)
  values
    (v_user_id,v_endpoint,trim(p_p256dh),trim(p_auth),left(p_user_agent,500),
     left(coalesce(p_platform,'web'),40),true,now(),0,null,null,now())
  on conflict(endpoint) do update set
    p256dh=excluded.p256dh,
    auth=excluded.auth,
    user_agent=excluded.user_agent,
    platform=excluded.platform,
    enabled=true,
    last_seen_at=now(),
    failure_count=0,
    last_failure_at=null,
    updated_at=now()
  returning id into v_id;
  return v_id;
end;
$function$;

commit;
