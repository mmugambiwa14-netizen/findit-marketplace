begin;

create or replace function public.enforce_curated_listing_publisher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_category text := new.kind::text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if new.seller_id <> v_actor and not public.is_admin() then
    raise exception 'Listing publisher identity mismatch' using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if not exists (
    select 1
    from public.business_category_approvals approval
    where approval.user_id = v_actor
      and approval.category = v_category
      and approval.status = 'approved'
  ) then
    raise exception 'Business category is not approved for publishing'
      using errcode = '42501',
            detail = v_category,
            hint = 'Apply for category approval or use the managed listing service.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_curated_service_publisher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if new.provider_id <> v_actor and not public.is_admin() then
    raise exception 'Service publisher identity mismatch' using errcode = '42501';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if not exists (
    select 1
    from public.business_category_approvals approval
    where approval.user_id = v_actor
      and approval.category = 'service'
      and approval.status = 'approved'
  ) then
    raise exception 'Business category is not approved for publishing'
      using errcode = '42501',
            detail = 'service',
            hint = 'Apply for Services approval or use the managed listing service.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_curated_listing_publisher() from public;
revoke all on function public.enforce_curated_service_publisher() from public;

-- These triggers are the authoritative enforcement boundary. They apply to
-- direct table writes and security-definer publication functions alike.
drop trigger if exists listings_enforce_curated_publisher on public.listings;
create trigger listings_enforce_curated_publisher
before insert on public.listings
for each row execute function public.enforce_curated_listing_publisher();

drop trigger if exists services_enforce_curated_publisher on public.services;
create trigger services_enforce_curated_publisher
before insert on public.services
for each row execute function public.enforce_curated_service_publisher();

comment on function public.enforce_curated_listing_publisher() is
  'Authoritative category-approval gate for Property, Cars and Machinery listing publication.';
comment on function public.enforce_curated_service_publisher() is
  'Authoritative Services-category approval gate for service publication.';

commit;
