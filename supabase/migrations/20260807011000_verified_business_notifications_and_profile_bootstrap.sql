begin;

create or replace function public.bootstrap_business_profile_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
begin
  select id into v_application_id
  from public.business_applications
  where user_id = new.user_id
  order by submitted_at desc, id desc
  limit 1;

  if v_application_id is not null then
    perform public.sync_business_profile_verification(v_application_id);
  end if;
  return new;
end;
$$;

revoke all on function public.bootstrap_business_profile_verification() from public, anon, authenticated;

drop trigger if exists bootstrap_verified_business_profile on public.business_profiles;
create trigger bootstrap_verified_business_profile
after insert on public.business_profiles
for each row execute function public.bootstrap_business_profile_verification();

create or replace function public.notify_business_application_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.business_applications;
  v_application_id uuid;
  v_approved_categories integer;
  v_title text;
  v_message text;
  v_state text;
begin
  if tg_table_name = 'business_applications' then
    v_application_id := case when tg_op = 'DELETE' then old.id else new.id end;
  else
    v_application_id := case when tg_op = 'DELETE' then old.business_application_id else new.business_application_id end;
  end if;

  select * into v_application
  from public.business_applications
  where id = v_application_id;

  if v_application.id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select count(*) into v_approved_categories
  from public.business_category_approvals
  where business_application_id = v_application.id and status = 'approved';

  v_state := case
    when v_approved_categories > 0 then 'approved'
    else v_application.status
  end;

  case v_state
    when 'approved' then
      v_title := 'Business publishing approved';
      v_message := 'Your business has approved publishing access. Your public business profile now shows its approved status.';
    when 'needs_information' then
      v_title := 'Business application needs information';
      v_message := coalesce(nullif(v_application.reviewer_message, ''), 'More information is required before the business application can be decided.');
    when 'rejected' then
      v_title := 'Business application not approved';
      v_message := coalesce(nullif(v_application.reviewer_message, ''), 'The business application was not approved.');
    when 'reviewing' then
      v_title := 'Business application under review';
      v_message := 'The business application is now being reviewed.';
    else
      return case when tg_op = 'DELETE' then old else new end;
  end case;

  perform public.create_essential_notification(
    v_application.user_id,
    'account_status',
    'business-application:' || v_application.id::text || ':' || v_state,
    v_title,
    left(v_message, 1000),
    '/profile',
    null
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.notify_business_application_state() from public, anon, authenticated;

drop trigger if exists notify_business_application_state on public.business_applications;
create trigger notify_business_application_state
after update of status, reviewer_message on public.business_applications
for each row
when (old.status is distinct from new.status or old.reviewer_message is distinct from new.reviewer_message)
execute function public.notify_business_application_state();

drop trigger if exists notify_business_category_state on public.business_category_approvals;
create trigger notify_business_category_state
after update of status on public.business_category_approvals
for each row
when (old.status is distinct from new.status)
execute function public.notify_business_application_state();

commit;
