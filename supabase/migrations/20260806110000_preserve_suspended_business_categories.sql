begin;

-- A suspended category approval is a moderation decision. Before this migration
-- the applicant-driven upserts downgraded 'suspended' to 'pending' and cleared
-- the reviewer message, so a suspended business could lift its own suspension by
-- re-requesting the category. get_my_publishing_access() also omitted suspended
-- categories entirely, so the publishing surfaces offered exactly those
-- categories back to the applicant as available to request.

drop function if exists public.get_my_publishing_access();

create function public.get_my_publishing_access()
returns table (
  application_id uuid,
  application_status text,
  approved_categories text[],
  pending_categories text[],
  suspended_categories text[],
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
    coalesce(array_agg(c.category order by c.category) filter (where c.status = 'suspended'), '{}'::text[]),
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

-- A fresh application may only ever move a category forward into review. An
-- approved category stays approved and a suspended category stays suspended,
-- keeping the reviewer message that explains the suspension.
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
    insert into public.business_category_approvals as approval (business_application_id, user_id, category)
    values (v_application_id, v_user_id, v_category)
    on conflict (user_id, category) do update set
      business_application_id = excluded.business_application_id,
      status = case when approval.status in ('approved','suspended') then approval.status else 'pending' end,
      updated_at = now();
  end loop;

  return v_application_id;
end;
$$;

-- Requesting additional categories is an explicit applicant choice, so a
-- suspended category is refused outright rather than silently ignored.
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
  v_suspended text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_categories is null or cardinality(p_categories) = 0 then raise exception 'Choose at least one category'; end if;
  if exists (select 1 from unnest(p_categories) c where c not in ('property','car','machinery','service')) then
    raise exception 'Unsupported category';
  end if;

  select string_agg(approval.category, ', ' order by approval.category)
    into v_suspended
  from public.business_category_approvals approval
  where approval.user_id = v_user_id
    and approval.status = 'suspended'
    and approval.category = any (p_categories);

  if v_suspended is not null then
    raise exception 'Suspended categories cannot be re-requested'
      using errcode = '42501',
            detail = v_suspended,
            hint = 'Contact PeekaListing to have the suspension reviewed.';
  end if;

  select id into v_application_id
  from public.business_applications
  where user_id = v_user_id and status = 'approved'
  order by submitted_at desc
  limit 1;

  if v_application_id is null then raise exception 'An approved business application is required'; end if;

  foreach v_category in array p_categories loop
    insert into public.business_category_approvals as approval (
      business_application_id, user_id, category, status, reviewer_message, created_at, updated_at
    ) values (
      v_application_id, v_user_id, v_category, 'pending', null, now(), now()
    )
    on conflict (user_id, category) do update set
      business_application_id = excluded.business_application_id,
      status = case when approval.status in ('approved','suspended') then approval.status else 'pending' end,
      reviewer_message = case when approval.status = 'suspended' then approval.reviewer_message else null end,
      updated_at = now();
  end loop;
end;
$$;

revoke all on function public.get_my_publishing_access() from public;
revoke all on function public.get_my_publishing_access() from anon, authenticated;
grant execute on function public.get_my_publishing_access() to authenticated;

comment on function public.get_my_publishing_access() is
  'Publishing access for the calling user, including suspended categories so they are never offered back as requestable.';

commit;
