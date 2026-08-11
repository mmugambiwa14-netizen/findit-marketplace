-- Rollback capsule for 20260809190000_curated_publisher_service_role_boundary.sql.

create or replace function public.enforce_curated_listing_publisher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

create or replace function public.enforce_curated_service_publisher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
$function$;

revoke all on function public.enforce_curated_listing_publisher() from public, anon, authenticated;
revoke all on function public.enforce_curated_service_publisher() from public, anon, authenticated;
