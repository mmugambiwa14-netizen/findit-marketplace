-- Seller profile details are additive public profile data. This rollback keeps
-- the columns and any uploaded logos so a rollback cannot silently destroy
-- seller content. It restores the pre-migration public seller projection and
-- leaves the image RPCs backward-compatible for already-attached media.

create or replace function private.get_public_seller_profile(p_seller_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', seller.id,
    'full_name', seller.full_name,
    'bio', seller.bio,
    'avatar_url', seller.avatar_url
  )
  from public.users seller
  where p_seller_id is not null
    and seller.id = p_seller_id
    and seller.status = 'active'
    and exists (
      select 1
      from public.listings listing
      left join public.locations location on location.id = listing.location_id
      where listing.seller_id = seller.id
        and listing.status in ('available', 'under_offer')
        and listing.content_suspended_at is null
        and private.is_country_browsable(
          coalesce(listing.country_code, location.country_code, 'ZW')
        )
    )
  limit 1;
$function$;

create or replace function public.get_public_seller_profile(p_seller_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_public_seller_profile(p_seller_id);
$function$;

revoke all on function private.get_public_seller_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.get_public_seller_profile(uuid)
  to anon, authenticated, service_role;

revoke all on function public.get_public_seller_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_seller_profile(uuid)
  to anon, authenticated, service_role;

-- Keep seller_logo in the media intent constraint because attached data is
-- intentionally preserved. Removing it would make future cleanup fail and
-- would require destructive deletion of user-uploaded profile media.
