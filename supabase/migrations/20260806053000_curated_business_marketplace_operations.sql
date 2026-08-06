begin;

create table if not exists public.business_review_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.business_applications(id) on delete cascade,
  category_approval_id uuid references public.business_category_approvals(id) on delete set null,
  actor_user_id uuid not null references auth.users(id),
  action text not null check (action in (
    'application_review_started',
    'application_information_requested',
    'application_rejected',
    'category_approved',
    'category_rejected',
    'category_suspended',
    'category_reinstated'
  )),
  previous_status text,
  new_status text not null,
  message text,
  created_at timestamptz not null default now()
);

alter table public.business_review_events enable row level security;
revoke all on public.business_review_events from anon, authenticated;
grant select on public.business_review_events to authenticated;

create policy business_review_events_admin_read on public.business_review_events
  for select to authenticated using (public.is_admin());

create or replace function public.admin_list_business_applications(
  p_status text default null,
  p_limit integer default 50,
  p_before timestamptz default null
)
returns table (
  application_id uuid,
  user_id uuid,
  business_name text,
  contact_name text,
  business_email text,
  business_phone text,
  country_code text,
  city text,
  description text,
  website_url text,
  social_url text,
  expected_inventory_band text,
  application_status text,
  reviewer_message text,
  submitted_at timestamptz,
  requested_categories jsonb
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status is not null and p_status not in ('submitted','reviewing','needs_information','approved','rejected','withdrawn') then
    raise exception 'Unsupported application status';
  end if;

  return query
  select
    a.id,
    a.user_id,
    a.business_name,
    a.contact_name,
    a.business_email,
    a.business_phone,
    a.country_code,
    a.city,
    a.description,
    a.website_url,
    a.social_url,
    a.expected_inventory_band,
    a.status,
    a.reviewer_message,
    a.submitted_at,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id,
      'category', c.category,
      'status', c.status,
      'reviewerMessage', c.reviewer_message
    ) order by c.category) filter (where c.id is not null), '[]'::jsonb)
  from public.business_applications a
  left join public.business_category_approvals c on c.business_application_id = a.id
  where (p_status is null or a.status = p_status)
    and (p_before is null or a.submitted_at < p_before)
  group by a.id
  order by a.submitted_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.admin_review_business_application(
  p_application_id uuid,
  p_action text,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous text;
  v_next text;
  v_event text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select status into v_previous from public.business_applications where id = p_application_id for update;
  if v_previous is null then raise exception 'Application not found'; end if;

  case p_action
    when 'start_review' then v_next := 'reviewing'; v_event := 'application_review_started';
    when 'request_information' then v_next := 'needs_information'; v_event := 'application_information_requested';
    when 'reject' then v_next := 'rejected'; v_event := 'application_rejected';
    else raise exception 'Unsupported review action';
  end case;

  if p_action in ('request_information','reject') and nullif(trim(p_message), '') is null then
    raise exception 'A reviewer message is required';
  end if;

  update public.business_applications
  set status = v_next,
      reviewer_message = nullif(trim(p_message), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = p_application_id;

  insert into public.business_review_events (
    application_id, actor_user_id, action, previous_status, new_status, message
  ) values (
    p_application_id, auth.uid(), v_event, v_previous, v_next, nullif(trim(p_message), '')
  );
end;
$$;

create or replace function public.admin_review_business_category(
  p_category_approval_id uuid,
  p_action text,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
  v_previous text;
  v_next text;
  v_event text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;

  select business_application_id, status
  into v_application_id, v_previous
  from public.business_category_approvals
  where id = p_category_approval_id
  for update;

  if v_application_id is null then raise exception 'Category request not found'; end if;

  case p_action
    when 'approve' then v_next := 'approved'; v_event := case when v_previous = 'suspended' then 'category_reinstated' else 'category_approved' end;
    when 'reject' then v_next := 'rejected'; v_event := 'category_rejected';
    when 'suspend' then v_next := 'suspended'; v_event := 'category_suspended';
    else raise exception 'Unsupported category action';
  end case;

  if p_action in ('reject','suspend') and nullif(trim(p_message), '') is null then
    raise exception 'A reviewer message is required';
  end if;

  update public.business_category_approvals
  set status = v_next,
      reviewer_message = nullif(trim(p_message), ''),
      approved_at = case when v_next = 'approved' then now() else approved_at end,
      approved_by = case when v_next = 'approved' then auth.uid() else approved_by end,
      updated_at = now()
  where id = p_category_approval_id;

  if v_next = 'approved' then
    update public.business_applications
    set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
    where id = v_application_id and status <> 'approved';
  elsif not exists (
    select 1 from public.business_category_approvals
    where business_application_id = v_application_id and status = 'approved'
  ) then
    update public.business_applications
    set status = case when exists (
      select 1 from public.business_category_approvals
      where business_application_id = v_application_id and status = 'pending'
    ) then 'reviewing' else 'rejected' end,
    reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
    where id = v_application_id;
  end if;

  insert into public.business_review_events (
    application_id, category_approval_id, actor_user_id, action,
    previous_status, new_status, message
  ) values (
    v_application_id, p_category_approval_id, auth.uid(), v_event,
    v_previous, v_next, nullif(trim(p_message), '')
  );
end;
$$;

create or replace function public.admin_list_managed_listing_requests(
  p_status text default null,
  p_limit integer default 50,
  p_before timestamptz default null
)
returns setof public.managed_listing_requests
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
    select * from public.managed_listing_requests r
    where (p_status is null or r.status = p_status)
      and (p_before is null or r.created_at < p_before)
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function public.admin_update_managed_listing_request(
  p_request_id uuid,
  p_status text,
  p_message text default null,
  p_assigned_to uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('reviewing','accepted','needs_information','declined','published','cancelled') then
    raise exception 'Unsupported managed listing status';
  end if;
  if p_status in ('needs_information','declined') and nullif(trim(p_message), '') is null then
    raise exception 'A reviewer message is required';
  end if;

  update public.managed_listing_requests
  set status = p_status,
      reviewer_message = nullif(trim(p_message), ''),
      assigned_to = coalesce(p_assigned_to, assigned_to),
      updated_at = now()
  where id = p_request_id;
  if not found then raise exception 'Managed listing request not found'; end if;
end;
$$;

revoke all on function public.admin_list_business_applications(text,integer,timestamptz) from public;
revoke all on function public.admin_review_business_application(uuid,text,text) from public;
revoke all on function public.admin_review_business_category(uuid,text,text) from public;
revoke all on function public.admin_list_managed_listing_requests(text,integer,timestamptz) from public;
revoke all on function public.admin_update_managed_listing_request(uuid,text,text,uuid) from public;

grant execute on function public.admin_list_business_applications(text,integer,timestamptz) to authenticated;
grant execute on function public.admin_review_business_application(uuid,text,text) to authenticated;
grant execute on function public.admin_review_business_category(uuid,text,text) to authenticated;
grant execute on function public.admin_list_managed_listing_requests(text,integer,timestamptz) to authenticated;
grant execute on function public.admin_update_managed_listing_request(uuid,text,text,uuid) to authenticated;

commit;
