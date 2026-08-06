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

commit;
