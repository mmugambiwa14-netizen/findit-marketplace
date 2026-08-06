begin;

create table if not exists public.business_application_responses (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.business_applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 5 and 3000),
  created_at timestamptz not null default now()
);

alter table public.business_application_responses enable row level security;
revoke all on public.business_application_responses from anon, authenticated;
grant select on public.business_application_responses to authenticated;

create policy business_application_responses_owner_read
  on public.business_application_responses
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
  );

create or replace function public.respond_to_business_application(
  p_application_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_message), '') is null then raise exception 'A response is required'; end if;

  select status into v_status
  from public.business_applications
  where id = p_application_id and user_id = v_user_id
  for update;

  if v_status is null then raise exception 'Application not found'; end if;
  if v_status <> 'needs_information' then raise exception 'This application is not awaiting information'; end if;

  insert into public.business_application_responses(application_id, user_id, message)
  values (p_application_id, v_user_id, trim(p_message));

  update public.business_applications
  set status = 'reviewing', reviewer_message = null, updated_at = now()
  where id = p_application_id;
end;
$$;

create or replace function public.request_additional_business_categories(
  p_categories text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_application_id uuid;
  v_category text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_categories is null or cardinality(p_categories) = 0 then raise exception 'Choose at least one category'; end if;
  if exists (select 1 from unnest(p_categories) c where c not in ('property','car','machinery','service')) then
    raise exception 'Unsupported category';
  end if;

  select id into v_application_id
  from public.business_applications
  where user_id = v_user_id and status = 'approved'
  order by submitted_at desc
  limit 1;

  if v_application_id is null then raise exception 'An approved business application is required'; end if;

  foreach v_category in array p_categories loop
    insert into public.business_category_approvals(
      business_application_id, user_id, category, status, reviewer_message, created_at, updated_at
    ) values (
      v_application_id, v_user_id, v_category, 'pending', null, now(), now()
    )
    on conflict (user_id, category) do update set
      business_application_id = excluded.business_application_id,
      status = case
        when public.business_category_approvals.status = 'approved' then 'approved'
        else 'pending'
      end,
      reviewer_message = null,
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.get_my_managed_listing_requests()
returns table (
  id uuid,
  category text,
  owner_name text,
  city text,
  item_summary text,
  price_expectation text,
  status text,
  reviewer_message text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.id, r.category, r.owner_name, r.city, r.item_summary,
    r.price_expectation, r.status, r.reviewer_message, r.created_at, r.updated_at
  from public.managed_listing_requests r
  where r.requester_user_id = auth.uid()
  order by r.created_at desc
  limit 100;
$$;

revoke all on function public.respond_to_business_application(uuid,text) from public;
revoke all on function public.request_additional_business_categories(text[]) from public;
revoke all on function public.get_my_managed_listing_requests() from public;
grant execute on function public.respond_to_business_application(uuid,text) to authenticated;
grant execute on function public.request_additional_business_categories(text[]) to authenticated;
grant execute on function public.get_my_managed_listing_requests() to authenticated;

commit;
