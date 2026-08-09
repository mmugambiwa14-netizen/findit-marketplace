-- Public seller profile details and secure seller-logo media.
--
-- Seller profile fields are intentionally public profile data. Account email,
-- phone-security fields, roles, status and ban state remain private or
-- system-managed. Logo objects stay in the existing private marketplace
-- bucket and are only signed after the public seller boundary allows them.

alter table public.users
  add column if not exists display_name text,
  add column if not exists public_address text,
  add column if not exists website_url text,
  add column if not exists avatar_storage_path text;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_display_name_length'
  ) then
    alter table public.users
      add constraint users_display_name_length
      check (display_name is null or char_length(display_name) <= 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_public_address_length'
  ) then
    alter table public.users
      add constraint users_public_address_length
      check (public_address is null or char_length(public_address) <= 300);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_website_url_format'
  ) then
    alter table public.users
      add constraint users_website_url_format
      check (
        website_url is null
        or (
          char_length(website_url) <= 2048
          and website_url ~* '^https?://[^[:space:]]+$'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_avatar_storage_path'
  ) then
    alter table public.users
      add constraint users_avatar_storage_path
      check (
        avatar_storage_path is null
        or avatar_storage_path ~ '^[0-9a-f-]{36}/seller_logo/staging/[0-9a-f-]{36}\.(jpg|png|webp)$'
      );
  end if;
end
$constraints$;

alter table public.marketplace_image_upload_intents
  drop constraint if exists marketplace_image_upload_intents_purpose_check;

alter table public.marketplace_image_upload_intents
  add constraint marketplace_image_upload_intents_purpose_check
  check (purpose in ('service_photo', 'business_logo', 'seller_logo'));

-- The helper functions were moved to private in migration 0087. Keep the
-- Storage policy boundary private while allowing attached seller logos to be
-- read by the public profile resolver.
create or replace function private.is_public_marketplace_image(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1
      from public.service_media sm
      join public.services s on s.id = sm.service_id
      join public.users owner on owner.id = s.provider_id
      where sm.storage_path = p_storage_path
        and s.status = 'active'
        and s.category <> 'legal'
        and owner.status = 'active'
    )
    or exists (
      select 1
      from public.business_profiles bp
      join public.users owner on owner.id = bp.user_id
      where bp.avatar_storage_path = p_storage_path
        and owner.status = 'active'
        and bp.business_type <> 'legal_firm'
    )
    or exists (
      select 1
      from public.users owner
      where owner.avatar_storage_path = p_storage_path
        and owner.status = 'active'
    );
$function$;

create or replace function private.is_attached_marketplace_image(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (select 1 from public.service_media sm where sm.storage_path = p_storage_path)
    or exists (select 1 from public.business_profiles bp where bp.avatar_storage_path = p_storage_path)
    or exists (select 1 from public.users owner where owner.avatar_storage_path = p_storage_path);
$function$;

revoke all on function private.is_public_marketplace_image(text)
  from public, anon, authenticated, service_role;
grant execute on function private.is_public_marketplace_image(text)
  to anon, authenticated, service_role;

revoke all on function private.is_attached_marketplace_image(text)
  from public, anon, authenticated, service_role;
grant execute on function private.is_attached_marketplace_image(text)
  to authenticated, service_role;

-- Prevent direct browser writes to the storage path. The attach/detach RPCs
-- below are the only supported way to change it.
create or replace function public.protect_user_managed_fields()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if auth.uid() = old.id
    and not public.is_admin()
    and current_user not in ('postgres', 'service_role')
    and (
      new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.role is distinct from old.role
      or new.phone is distinct from old.phone
      or new.phone_verified is distinct from old.phone_verified
      or new.phone_otp_code is distinct from old.phone_otp_code
      or new.phone_otp_pending is distinct from old.phone_otp_pending
      or new.phone_otp_expires is distinct from old.phone_otp_expires
      or new.verified is distinct from old.verified
      or new.verified_at is distinct from old.verified_at
      or new.verified_full_name is distinct from old.verified_full_name
      or new.super_admin is distinct from old.super_admin
      or new.status is distinct from old.status
      or new.ban_reason is distinct from old.ban_reason
      or new.ban_until is distinct from old.ban_until
      or new.avatar_storage_path is distinct from old.avatar_storage_path
      or new.created_at is distinct from old.created_at
    ) then
    raise exception 'privileged user fields require a trusted server operation'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

create or replace function public.authorize_marketplace_image_upload(
  p_user_id uuid,
  p_purpose text,
  p_storage_path text,
  p_mime_type text,
  p_byte_size integer,
  p_width_px integer,
  p_height_px integer,
  p_sha256_hex text
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  intent_id uuid;
begin
  if not exists (select 1 from public.users where id = p_user_id and status = 'active') then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_purpose not in ('service_photo', 'business_logo', 'seller_logo')
    or p_storage_path !~ (
      '^' || p_user_id::text || '/' || p_purpose || '/staging/[0-9a-f-]{36}\.(jpg|png|webp)$'
    )
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size not between 1 and 5242880
    or p_width_px not between 1 and 8000
    or p_height_px not between 1 and 8000
    or (p_width_px::bigint * p_height_px::bigint) > 40000000
    or p_sha256_hex !~ '^[0-9a-f]{64}$'
  then
    raise exception 'invalid image metadata' using errcode = '22023';
  end if;
  if (
    select count(*) from public.marketplace_image_upload_intents
    where user_id = p_user_id and created_at >= now() - interval '1 hour'
  ) >= 40 then
    raise exception 'marketplace image upload rate exceeded' using errcode = 'P0001';
  end if;

  insert into public.marketplace_image_upload_intents (
    user_id, purpose, storage_path, mime_type, byte_size,
    width_px, height_px, sha256_hex
  ) values (
    p_user_id, p_purpose, p_storage_path, p_mime_type, p_byte_size,
    p_width_px, p_height_px, lower(p_sha256_hex)
  ) returning id into intent_id;
  return intent_id;
end;
$function$;

create or replace function public.attach_marketplace_image(
  p_intent_id uuid,
  p_storage_path text,
  p_target_kind text,
  p_target_id uuid,
  p_display_order integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $function$
declare
  intent public.marketplace_image_upload_intents%rowtype;
  previous_path text;
  media_paths jsonb;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_target_kind not in ('service', 'business', 'seller') then
    raise exception 'invalid image target' using errcode = '22023';
  end if;

  select * into intent
  from public.marketplace_image_upload_intents
  where id = p_intent_id
    and user_id = auth.uid()
    and storage_path = p_storage_path
    and purpose = case
      when p_target_kind = 'service' then 'service_photo'
      when p_target_kind = 'business' then 'business_logo'
      else 'seller_logo'
    end
    and state = 'uploaded'
    and expires_at > now()
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'marketplace-images'
        and o.name = marketplace_image_upload_intents.storage_path
        and o.owner_id = marketplace_image_upload_intents.user_id::text
        and o.metadata ->> 'mimetype' = marketplace_image_upload_intents.mime_type
        and (o.metadata ->> 'size')::integer = marketplace_image_upload_intents.byte_size
    )
  for update;
  if not found then
    raise exception 'image is invalid, expired, or already attached' using errcode = '22023';
  end if;

  if p_target_kind = 'seller' then
    if p_display_order <> 0 then
      raise exception 'a seller profile has one logo' using errcode = '22023';
    end if;
    select avatar_storage_path into previous_path
    from public.users
    where id = p_target_id and id = auth.uid() and status = 'active'
    for update;
    if not found then
      raise exception 'seller profile not found' using errcode = 'P0002';
    end if;
    update public.users
    set avatar_storage_path = intent.storage_path, avatar_url = null
    where id = p_target_id;
  elsif p_target_kind = 'business' then
    if p_display_order <> 0 then
      raise exception 'a business profile has one logo' using errcode = '22023';
    end if;
    select avatar_storage_path into previous_path
    from public.business_profiles
    where id = p_target_id and user_id = auth.uid()
    for update;
    if not found then
      raise exception 'business profile not found' using errcode = 'P0002';
    end if;
    update public.business_profiles
    set avatar_storage_path = intent.storage_path, avatar_url = null
    where id = p_target_id;
  else
    if p_display_order not between 0 and 5 then
      raise exception 'service image order is invalid' using errcode = '22023';
    end if;
    perform 1 from public.services
    where id = p_target_id and provider_id = auth.uid() and category <> 'legal'
    for update;
    if not found then
      raise exception 'service not found' using errcode = 'P0002';
    end if;
    insert into public.service_media (
      service_id, owner_id, storage_path, display_order, mime_type,
      byte_size, width_px, height_px, sha256_hex
    ) values (
      p_target_id, auth.uid(), intent.storage_path, p_display_order,
      intent.mime_type, intent.byte_size, intent.width_px, intent.height_px,
      intent.sha256_hex
    );
    select coalesce(jsonb_agg(sm.storage_path order by sm.display_order), '[]'::jsonb)
      into media_paths
    from public.service_media sm where sm.service_id = p_target_id;
    update public.services set photos = media_paths where id = p_target_id;
  end if;

  update public.marketplace_image_upload_intents
  set state = 'attached', attached_at = now()
  where id = intent.id;

  return jsonb_build_object(
    'path', intent.storage_path,
    'previousPath', previous_path,
    'targetKind', p_target_kind,
    'targetId', p_target_id
  );
end;
$function$;

create or replace function public.detach_marketplace_image(
  p_target_kind text,
  p_target_id uuid,
  p_storage_path text
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  detached_path text;
  media_paths jsonb;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_target_kind = 'seller' then
    update public.users
    set avatar_storage_path = null
    where id = p_target_id and id = auth.uid()
      and avatar_storage_path = p_storage_path
    returning p_storage_path into detached_path;
  elsif p_target_kind = 'business' then
    update public.business_profiles
    set avatar_storage_path = null
    where id = p_target_id and user_id = auth.uid()
      and avatar_storage_path = p_storage_path
    returning p_storage_path into detached_path;
  elsif p_target_kind = 'service' then
    delete from public.service_media
    where service_id = p_target_id and owner_id = auth.uid()
      and storage_path = p_storage_path
    returning storage_path into detached_path;
    if detached_path is not null then
      select coalesce(jsonb_agg(sm.storage_path order by sm.display_order), '[]'::jsonb)
        into media_paths
      from public.service_media sm where sm.service_id = p_target_id;
      update public.services
      set photos = media_paths
      where id = p_target_id and provider_id = auth.uid();
    end if;
  else
    raise exception 'invalid image target' using errcode = '22023';
  end if;
  if detached_path is null then
    raise exception 'attached image not found' using errcode = 'P0002';
  end if;
  return detached_path;
end;
$function$;

-- The public seller RPC returns only intentional profile fields. It never
-- returns account email, phone, role, status, or any moderation state.
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
    'display_name', seller.display_name,
    'bio', seller.bio,
    'public_address', seller.public_address,
    'website_url', seller.website_url,
    'avatar_url', seller.avatar_url,
    'avatar_storage_path', seller.avatar_storage_path
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

revoke all on function private.get_public_seller_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.get_public_seller_profile(uuid)
  to anon, authenticated, service_role;

create or replace function public.get_public_seller_profile(p_seller_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select private.get_public_seller_profile(p_seller_id);
$function$;

revoke all on function public.get_public_seller_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_seller_profile(uuid)
  to anon, authenticated, service_role;

revoke all on function public.authorize_marketplace_image_upload(uuid, text, text, text, integer, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.authorize_marketplace_image_upload(uuid, text, text, text, integer, integer, integer, text)
  to service_role;

revoke all on function public.attach_marketplace_image(uuid, text, text, uuid, integer)
  from public;
grant execute on function public.attach_marketplace_image(uuid, text, text, uuid, integer)
  to authenticated;

revoke all on function public.detach_marketplace_image(text, uuid, text)
  from public;
grant execute on function public.detach_marketplace_image(text, uuid, text)
  to authenticated;

do $verify$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
      and column_name = 'display_name'
  ) then
    raise exception 'seller profile display name column missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users'
      and column_name = 'avatar_storage_path'
  ) then
    raise exception 'seller profile logo column missing';
  end if;
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'get_public_seller_profile'
      and pg_get_function_identity_arguments(p.oid) = 'p_seller_id uuid'
      and p.prosecdef
      and p.proconfig = array['search_path=""']::text[]
  ) then
    raise exception 'public seller profile implementation is not hardened';
  end if;
end
$verify$;
