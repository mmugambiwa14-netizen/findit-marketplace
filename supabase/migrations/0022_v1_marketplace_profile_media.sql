-- 0022_v1_marketplace_profile_media.sql
-- Trusted image storage for the remaining active V1 service and lightweight
-- business/dealer profile surfaces. Objects stay private and are exposed only
-- through short-lived signed URLs after relationship-aware Storage checks.

alter table public.business_profiles
  add column avatar_storage_path text,
  add constraint business_profiles_avatar_storage_path
    check (
      avatar_storage_path is null
      or avatar_storage_path ~ '^[0-9a-f-]{36}/business_logo/staging/[0-9a-f-]{36}\.(jpg|png|webp)$'
    );

create table public.marketplace_image_upload_intents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  purpose       text not null check (purpose in ('service_photo', 'business_logo')),
  storage_path  text not null unique,
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size     integer not null check (byte_size between 1 and 5242880),
  width_px      integer not null check (width_px between 1 and 8000),
  height_px     integer not null check (height_px between 1 and 8000),
  sha256_hex    text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  state         text not null default 'validated'
                check (state in ('validated', 'uploaded', 'attached', 'rejected')),
  expires_at    timestamptz not null default (now() + interval '20 minutes'),
  created_at    timestamptz not null default now(),
  uploaded_at   timestamptz,
  attached_at   timestamptz,
  check ((width_px::bigint * height_px::bigint) <= 40000000),
  check (
    storage_path ~ (
      '^[0-9a-f-]{36}/' || purpose || '/staging/[0-9a-f-]{36}\.(jpg|png|webp)$'
    )
  )
);

create index idx_marketplace_image_intents_user_created
  on public.marketplace_image_upload_intents(user_id, created_at desc);
create index idx_marketplace_image_intents_expiry
  on public.marketplace_image_upload_intents(expires_at)
  where state in ('validated', 'uploaded');

create table public.service_media (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references public.services(id) on delete cascade,
  owner_id      uuid not null references public.users(id) on delete cascade,
  storage_path  text not null unique,
  display_order integer not null check (display_order between 0 and 5),
  mime_type     text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size     integer not null check (byte_size between 1 and 5242880),
  width_px      integer not null check (width_px between 1 and 8000),
  height_px     integer not null check (height_px between 1 and 8000),
  sha256_hex    text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  unique (service_id, display_order),
  check ((width_px::bigint * height_px::bigint) <= 40000000)
);

create index idx_service_media_service_order
  on public.service_media(service_id, display_order);

alter table public.marketplace_image_upload_intents enable row level security;
alter table public.service_media enable row level security;

create policy "service_media_read" on public.service_media
  for select using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.services s
      where s.id = service_id and s.status = 'active' and s.category <> 'legal'
    )
  );

revoke all on table public.marketplace_image_upload_intents from anon, authenticated;
revoke insert, update, delete on table public.service_media from anon, authenticated;
grant select on table public.service_media to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketplace-images', 'marketplace-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.has_valid_marketplace_image_upload_intent(p_storage_path text)
returns boolean as $$
  select exists (
    select 1 from public.marketplace_image_upload_intents i
    where i.user_id = auth.uid()
      and i.storage_path = p_storage_path
      and i.state = 'validated'
      and i.expires_at > now()
  );
$$ language sql stable security definer set search_path = public;

revoke all on function public.has_valid_marketplace_image_upload_intent(text) from public;
grant execute on function public.has_valid_marketplace_image_upload_intent(text) to authenticated, service_role;

create policy "marketplace_image_validated_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'marketplace-images'
    and owner_id = auth.uid()::text
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_valid_marketplace_image_upload_intent(name)
  );

create or replace function public.is_public_marketplace_image(p_storage_path text)
returns boolean as $$
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
    );
$$ language sql stable security definer set search_path = public;

create or replace function public.is_attached_marketplace_image(p_storage_path text)
returns boolean as $$
  select
    exists (select 1 from public.service_media sm where sm.storage_path = p_storage_path)
    or exists (select 1 from public.business_profiles bp where bp.avatar_storage_path = p_storage_path);
$$ language sql stable security definer set search_path = public;

revoke all on function public.is_public_marketplace_image(text) from public;
revoke all on function public.is_attached_marketplace_image(text) from public;
grant execute on function public.is_public_marketplace_image(text) to anon, authenticated, service_role;
grant execute on function public.is_attached_marketplace_image(text) to authenticated, service_role;

create policy "marketplace_image_authorized_read" on storage.objects
  for select to public using (
    bucket_id = 'marketplace-images'
    and (
      owner_id = auth.uid()::text
      or public.is_admin()
      or public.is_public_marketplace_image(name)
    )
  );

create policy "marketplace_image_owner_delete_unattached" on storage.objects
  for delete to authenticated using (
    bucket_id = 'marketplace-images'
    and owner_id = auth.uid()::text
    and not public.is_attached_marketplace_image(name)
  );

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
returns uuid as $$
declare
  intent_id uuid;
begin
  if not exists (select 1 from public.users where id = p_user_id and status = 'active') then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_purpose not in ('service_photo', 'business_logo')
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
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.complete_marketplace_image_upload(p_intent_id uuid)
returns void as $$
declare
  intent public.marketplace_image_upload_intents%rowtype;
begin
  select * into intent from public.marketplace_image_upload_intents
  where id = p_intent_id and state = 'validated' and expires_at > now()
  for update;
  if not found then
    raise exception 'upload authorization is invalid or expired' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'marketplace-images'
      and o.name = intent.storage_path
      and o.owner_id = intent.user_id::text
      and o.metadata ->> 'mimetype' = intent.mime_type
      and (o.metadata ->> 'size')::integer = intent.byte_size
  ) then
    raise exception 'uploaded object does not match its authorization' using errcode = 'P0002';
  end if;
  update public.marketplace_image_upload_intents
  set state = 'uploaded', uploaded_at = now(), expires_at = now() + interval '7 days'
  where id = p_intent_id;
end;
$$ language plpgsql security definer set search_path = public, storage;

-- Existing direct V1 service creation remains supported, but callers cannot
-- smuggle untrusted image URLs into the JSON compatibility field.
drop policy if exists "services_owner_write" on public.services;
create policy "services_owner_write" on public.services
  for insert with check (
    public.is_active_user()
    and provider_id = auth.uid()
    and category <> 'legal'
    and verified = false
    and views = 0
    and photos = '[]'::jsonb
  );

create or replace function public.protect_service_managed_fields()
returns trigger as $$
begin
  if auth.uid() = old.provider_id
    and not public.is_admin()
    and current_user not in ('postgres', 'service_role')
    and (
      new.id is distinct from old.id
      or new.provider_id is distinct from old.provider_id
      or new.photos is distinct from old.photos
      or new.verified is distinct from old.verified
      or new.views is distinct from old.views
      or new.created_at is distinct from old.created_at
    )
  then
    raise exception 'service-managed fields require a trusted operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

create or replace function public.protect_business_profile_managed_fields()
returns trigger as $$
begin
  if auth.uid() = old.user_id
    and not public.is_admin()
    and current_user not in ('postgres', 'service_role')
    and (
      new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.registration_number is distinct from old.registration_number
      or new.issuing_body is distinct from old.issuing_body
      or new.avatar_storage_path is distinct from old.avatar_storage_path
      or new.verified is distinct from old.verified
      or new.verification_status is distinct from old.verification_status
      or new.created_at is distinct from old.created_at
    )
  then
    raise exception 'business-profile managed fields require a trusted operation'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop policy if exists "business_profiles_owner_write" on public.business_profiles;
create policy "business_profiles_owner_write" on public.business_profiles
  for insert with check (
    public.is_active_user()
    and user_id = auth.uid()
    and business_type <> 'legal_firm'
    and registration_number is null
    and issuing_body is null
    and avatar_storage_path is null
    and verified = false
    and verification_status = 'none'
  );

create or replace function public.attach_marketplace_image(
  p_intent_id uuid,
  p_storage_path text,
  p_target_kind text,
  p_target_id uuid,
  p_display_order integer default 0
)
returns jsonb as $$
declare
  intent public.marketplace_image_upload_intents%rowtype;
  previous_path text;
  media_paths jsonb;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_target_kind not in ('service', 'business') then
    raise exception 'invalid image target' using errcode = '22023';
  end if;

  select * into intent
  from public.marketplace_image_upload_intents
  where id = p_intent_id
    and user_id = auth.uid()
    and storage_path = p_storage_path
    and purpose = case when p_target_kind = 'service' then 'service_photo' else 'business_logo' end
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

  if p_target_kind = 'business' then
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
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.detach_marketplace_image(
  p_target_kind text,
  p_target_id uuid,
  p_storage_path text
)
returns text as $$
declare
  detached_path text;
  media_paths jsonb;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_target_kind = 'business' then
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
$$ language plpgsql security definer set search_path = public;

drop view if exists public.business_profiles_public;
create view public.business_profiles_public with (security_barrier = true) as
  select
    bp.id,
    bp.user_id,
    bp.company_name,
    bp.business_type,
    bp.profile_type,
    bp.phone,
    bp.email,
    bp.website,
    bp.social_links,
    bp.city,
    bp.address,
    bp.description,
    bp.avatar_url,
    bp.avatar_storage_path,
    bp.created_at,
    bp.updated_at
  from public.business_profiles bp
  join public.users owner on owner.id = bp.user_id
  where owner.status = 'active'
    and bp.business_type <> 'legal_firm';

revoke all on public.business_profiles_public from public;
grant select on public.business_profiles_public to anon, authenticated;

revoke all on function public.authorize_marketplace_image_upload(uuid, text, text, text, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.complete_marketplace_image_upload(uuid) from public, anon, authenticated;
revoke all on function public.attach_marketplace_image(uuid, text, text, uuid, integer) from public;
revoke all on function public.detach_marketplace_image(text, uuid, text) from public;

grant execute on function public.authorize_marketplace_image_upload(uuid, text, text, text, integer, integer, integer, text) to service_role;
grant execute on function public.complete_marketplace_image_upload(uuid) to service_role;
grant execute on function public.attach_marketplace_image(uuid, text, text, uuid, integer) to authenticated;
grant execute on function public.detach_marketplace_image(text, uuid, text) to authenticated;
