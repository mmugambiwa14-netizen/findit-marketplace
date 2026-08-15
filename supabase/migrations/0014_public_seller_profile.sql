-- Phase 3 V1 public seller summary.
-- Exposes only the identity fields required to evaluate a seller. Account
-- email, phone, role, status, verification, ban and OTP fields remain private.

drop function if exists public.get_public_seller_profile(text);

create or replace function public.get_public_seller_profile(seller_email text)
returns jsonb as $$
  select jsonb_build_object(
    'id', u.id,
    'full_name', u.full_name,
    'bio', u.bio,
    'avatar_url', u.avatar_url
  )
  from public.users u
  where u.status = 'active'
    and seller_email is not null
    and length(seller_email) <= 254
    and lower(u.email) = lower(trim(seller_email))
  limit 1;
$$ language sql stable security definer set search_path = public;

revoke all on function public.get_public_seller_profile(text) from public;
grant execute on function public.get_public_seller_profile(text) to anon, authenticated, service_role;
