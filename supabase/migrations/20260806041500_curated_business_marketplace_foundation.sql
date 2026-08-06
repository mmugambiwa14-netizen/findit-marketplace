begin;

create table if not exists public.business_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 160),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  business_email text not null,
  business_phone text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  city text not null check (char_length(city) between 2 and 120),
  description text not null check (char_length(description) between 20 and 3000),
  website_url text,
  social_url text,
  expected_inventory_band text not null check (expected_inventory_band in ('1-10','11-50','51-200','200+')),
  status text not null default 'submitted' check (status in ('submitted','reviewing','needs_information','approved','rejected','withdrawn')),
  reviewer_message text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create unique index if not exists business_applications_one_active_per_user
  on public.business_applications(user_id)
  where status in ('submitted','reviewing','needs_information','approved');

create table if not exists public.business_category_approvals (
  id uuid primary key default gen_random_uuid(),
  business_application_id uuid not null references public.business_applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('property','car','machinery','service')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  reviewer_message text,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

create table if not exists public.managed_listing_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('property','car','machinery','service')),
  owner_name text not null check (char_length(owner_name) between 2 and 160),
  contact_email text not null,
  contact_phone text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  city text not null check (char_length(city) between 2 and 120),
  item_summary text not null check (char_length(item_summary) between 20 and 5000),
  price_expectation text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','accepted','needs_information','declined','published','cancelled')),
  assigned_to uuid references auth.users(id),
  reviewer_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_applications enable row level security;
alter table public.business_category_approvals enable row level security;
alter table public.managed_listing_requests enable row level security;

revoke all on public.business_applications from anon, authenticated;
revoke all on public.business_category_approvals from anon, authenticated;
revoke all on public.managed_listing_requests from anon, authenticated;

grant select on public.business_applications to authenticated;
grant select on public.business_category_approvals to authenticated;
grant select on public.managed_listing_requests to authenticated;

create policy business_applications_owner_read on public.business_applications
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy category_approvals_owner_read on public.business_category_approvals
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy managed_listing_requests_owner_read on public.managed_listing_requests
  for select to authenticated using (requester_user_id = auth.uid() or public.is_admin());

create or replace function public.get_my_publishing_access()
returns table (
  application_id uuid,
  application_status text,
  approved_categories text[],
  pending_categories text[],
  needs_information boolean,
  reviewer_message text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    a.id,
    coalesce(a.status, 'not_started'),
    coalesce(array_agg(c.category order by c.category) filter (where c.status = 'approved'), '{}'::text[]),
    coalesce(array_agg(c.category order by c.category) filter (where c.status = 'pending'), '{}'::text[]),
    coalesce(a.status = 'needs_information', false),
    coalesce(a.reviewer_message, '')
  from (select auth.uid() as user_id) me
  left join lateral (
    select * from public.business_applications
    where user_id = me.user_id
    order by submitted_at desc
    limit 1
  ) a on true
  left join public.business_category_approvals c on c.business_application_id = a.id
  group by a.id, a.status, a.reviewer_message;
$$;

create or replace function public.submit_business_application(
  p_business_name text,
  p_contact_name text,
  p_business_email text,
  p_business_phone text,
  p_country_code text,
  p_city text,
  p_description text,
  p_website_url text,
  p_social_url text,
  p_expected_inventory_band text,
  p_requested_categories text[]
)
returns uuid
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
  if p_requested_categories is null or cardinality(p_requested_categories) = 0 then raise exception 'At least one category is required'; end if;
  if exists (select 1 from unnest(p_requested_categories) c where c not in ('property','car','machinery','service')) then raise exception 'Unsupported category'; end if;

  insert into public.business_applications (
    user_id, business_name, contact_name, business_email, business_phone,
    country_code, city, description, website_url, social_url, expected_inventory_band
  ) values (
    v_user_id, trim(p_business_name), trim(p_contact_name), lower(trim(p_business_email)), trim(p_business_phone),
    upper(trim(p_country_code)), trim(p_city), trim(p_description), nullif(trim(p_website_url), ''),
    nullif(trim(p_social_url), ''), p_expected_inventory_band
  ) returning id into v_application_id;

  foreach v_category in array p_requested_categories loop
    insert into public.business_category_approvals (business_application_id, user_id, category)
    values (v_application_id, v_user_id, v_category)
    on conflict (user_id, category) do update set
      business_application_id = excluded.business_application_id,
      status = case when public.business_category_approvals.status = 'approved' then 'approved' else 'pending' end,
      updated_at = now();
  end loop;

  return v_application_id;
end;
$$;

create or replace function public.submit_managed_listing_request(
  p_category text,
  p_owner_name text,
  p_contact_email text,
  p_contact_phone text,
  p_country_code text,
  p_city text,
  p_item_summary text,
  p_price_expectation text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_category not in ('property','car','machinery','service') then raise exception 'Unsupported category'; end if;
  insert into public.managed_listing_requests (
    requester_user_id, category, owner_name, contact_email, contact_phone,
    country_code, city, item_summary, price_expectation
  ) values (
    auth.uid(), p_category, trim(p_owner_name), lower(trim(p_contact_email)), trim(p_contact_phone),
    upper(trim(p_country_code)), trim(p_city), trim(p_item_summary), nullif(trim(p_price_expectation), '')
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.can_publish_in_category(p_category text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.business_category_approvals
    where user_id = auth.uid() and category = p_category and status = 'approved'
  );
$$;

revoke all on function public.get_my_publishing_access() from public;
revoke all on function public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[]) from public;
revoke all on function public.submit_managed_listing_request(text,text,text,text,text,text,text,text) from public;
revoke all on function public.can_publish_in_category(text) from public;
grant execute on function public.get_my_publishing_access() to authenticated;
grant execute on function public.submit_business_application(text,text,text,text,text,text,text,text,text,text,text[]) to authenticated;
grant execute on function public.submit_managed_listing_request(text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.can_publish_in_category(text) to authenticated;

commit;
