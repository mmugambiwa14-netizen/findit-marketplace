-- Run with psql against an isolated target after migrations/data loading.
-- Output is deterministic CSV-friendly evidence; it contains counts only.

select table_name, row_count
from (
  select 'users' as table_name, count(*)::bigint as row_count from public.users
  union all select 'audit_logs', count(*) from public.audit_logs
  union all select 'locations', count(*) from public.locations
  union all select 'listings', count(*) from public.listings
  union all select 'car_details', count(*) from public.car_details
  union all select 'property_details', count(*) from public.property_details
  union all select 'machinery_details', count(*) from public.machinery_details
  union all select 'services', count(*) from public.services
  union all select 'saved_listings', count(*) from public.saved_listings
  union all select 'inquiries', count(*) from public.inquiries
  union all select 'app_alerts', count(*) from public.app_alerts
  union all select 'business_profiles', count(*) from public.business_profiles
  union all select 'reports', count(*) from public.reports
  union all select 'terms', count(*) from public.terms
) inventory
order by table_name;

select check_name, failure_count
from (
  select 'listing_without_owner' as check_name, count(*)::bigint as failure_count
  from public.listings l left join public.users u on u.id = l.seller_id
  where u.id is null
  union all
  select 'car_without_matching_parent', count(*)
  from public.car_details d left join public.listings l on l.id = d.listing_id and l.kind = 'car'
  where l.id is null
  union all
  select 'property_without_matching_parent', count(*)
  from public.property_details d left join public.listings l on l.id = d.listing_id and l.kind = 'property'
  where l.id is null
  union all
  select 'machinery_without_matching_parent', count(*)
  from public.machinery_details d left join public.listings l on l.id = d.listing_id and l.kind = 'machinery'
  where l.id is null
  union all
  select 'saved_listing_without_target', count(*)
  from public.saved_listings s left join public.listings l on l.id = s.listing_id
  where l.id is null
  union all
  select 'inquiry_participant_mismatch', count(*)
  from public.inquiries i join public.listings l on l.id = i.listing_id
  where i.seller_id <> l.seller_id or i.buyer_id = i.seller_id
  union all
  select 'report_without_target', count(*)
  from public.reports r left join public.listings l on l.id = r.listing_id
  where r.listing_id is not null and l.id is null
) checks
order by check_name;
