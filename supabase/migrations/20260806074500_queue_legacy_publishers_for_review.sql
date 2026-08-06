begin;

-- Existing publishers are not auto-approved. They are placed into the same
-- review workflow as new businesses, with requested categories inferred from
-- their current inventory. This preserves the curated-marketplace promise
-- while preventing existing sellers from becoming invisible to operations.
with legacy_publishers as (
  select distinct u.id as user_id
  from public.users u
  where u.status = 'active'
    and (
      exists (select 1 from public.listings l where l.seller_id = u.id)
      or exists (select 1 from public.services s where s.provider_id = u.id)
    )
)
insert into public.business_applications (
  user_id,
  business_name,
  contact_name,
  business_email,
  business_phone,
  country_code,
  city,
  description,
  website_url,
  social_url,
  expected_inventory_band,
  status,
  reviewer_message,
  submitted_at,
  updated_at
)
select
  u.id,
  coalesce(nullif(trim(u.full_name), ''), split_part(u.email, '@', 1), 'Existing publisher'),
  coalesce(nullif(trim(u.full_name), ''), split_part(u.email, '@', 1), 'Existing publisher'),
  lower(u.email),
  coalesce(nullif(trim(u.phone), ''), 'Not provided'),
  'ZW',
  'Existing account',
  'Existing PeekaListing publisher queued for category-specific business review.',
  null,
  null,
  case
    when (select count(*) from public.listings l where l.seller_id = u.id)
       + (select count(*) from public.services s where s.provider_id = u.id) > 50 then '51-200'
    when (select count(*) from public.listings l where l.seller_id = u.id)
       + (select count(*) from public.services s where s.provider_id = u.id) > 10 then '11-50'
    else '1-10'
  end,
  'reviewing',
  'Existing publisher transition: review business legitimacy and approve only the categories that meet PeekaListing requirements.',
  now(),
  now()
from legacy_publishers legacy
join public.users u on u.id = legacy.user_id
where not exists (
  select 1 from public.business_applications a
  where a.user_id = u.id
    and a.status in ('submitted','reviewing','needs_information','approved')
);

insert into public.business_category_approvals (
  business_application_id,
  user_id,
  category,
  status,
  reviewer_message,
  created_at,
  updated_at
)
select distinct
  a.id,
  a.user_id,
  inferred.category,
  'pending',
  'Inferred from inventory that existed before curated publishing was enabled.',
  now(),
  now()
from public.business_applications a
join lateral (
  select l.kind::text as category
  from public.listings l
  where l.seller_id = a.user_id
  union
  select 'service'::text
  where exists (select 1 from public.services s where s.provider_id = a.user_id)
) inferred on true
where a.status = 'reviewing'
  and a.reviewer_message like 'Existing publisher transition:%'
on conflict (user_id, category) do nothing;

commit;
