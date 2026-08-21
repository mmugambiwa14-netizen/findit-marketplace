-- 20260821091000_admin_business_listing_publication.sql
--
-- Lets an admin publish a marketplace listing on behalf of an onboarded
-- business, or against an accepted managed listing request.
--
-- The managed advertising workflow previously ended at a status flag: an
-- operator pressed "Mark published" and nothing was published, because every
-- listing write path binds the seller to auth.uid(). The curated publishing
-- trigger has always permitted an admin to insert a listing owned by someone
-- else -- 20260806070000 returns early for is_admin() -- but no function ever
-- used that permission.
--
-- Rather than copy the listing transaction, the V1 and V2 implementations are
-- re-expressed as owner-parameterised functions and the existing entry points
-- become wrappers that pass auth.uid() for both identities. Owner-served
-- publication therefore keeps its exact current behaviour, and admin-served
-- publication runs the same validation -- country, currency, category, text
-- bounds, media intents, schema registry -- rather than a second copy of it
-- that could drift.
--
-- Two identities are distinguished:
--   p_actor_id  uploaded the images, so the upload intents and storage objects
--               belong to them (the admin, when an admin publishes).
--   p_owner_id  owns the listing: seller_id, seller name, and listing_media
--               ownership, so the business controls what it publishes.

begin;

-- ---------------------------------------------------------------------------
-- The listing owner can always read its own listing media.
--
-- Both read policies reached the owner only through `owner_id = auth.uid()`,
-- which held because the uploader was always the seller. With an admin
-- uploading on a business's behalf that stops being true, and a business could
-- not see the images of its own draft or paused listing. The seller branch
-- states the intent directly instead of relying on the two identities being
-- the same account.
-- ---------------------------------------------------------------------------
drop policy if exists "listing_media_read" on public.listing_media;
create policy "listing_media_read" on public.listing_media
  for select using (
    owner_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (
          l.seller_id = (select auth.uid())
          or l.status in ('available', 'under_offer')
          or (
            public.is_active_user()
            and exists (
              select 1 from public.saved_listings saved
              where saved.listing_id = l.id and saved.user_id = (select auth.uid())
            )
          )
          or (
            public.is_active_user()
            and exists (
              select 1 from public.conversations conversation
              where conversation.listing_id = l.id
                and (conversation.buyer_id = (select auth.uid()) or conversation.seller_id = (select auth.uid()))
            )
          )
        )
    )
  );

drop policy if exists "listing_image_authorized_read" on storage.objects;
create policy "listing_image_authorized_read" on storage.objects
  for select to public using (
    bucket_id = 'listing-images'
    and (
      owner_id = (select auth.uid())::text
      or public.is_admin()
      or exists (
        select 1
        from public.listing_media m
        join public.listings l on l.id = m.listing_id
        where m.storage_path = name
          and (
            l.seller_id = (select auth.uid())
            or l.status in ('available', 'under_offer')
            or (
              public.is_active_user()
              and exists (
                select 1 from public.saved_listings saved
                where saved.listing_id = l.id and saved.user_id = (select auth.uid())
              )
            )
            or (
              public.is_active_user()
              and exists (
                select 1 from public.conversations conversation
                where conversation.listing_id = l.id
                  and (conversation.buyer_id = (select auth.uid()) or conversation.seller_id = (select auth.uid()))
              )
            )
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- V1 listing transaction, owner-parameterised.
--
-- The body is the Aug-6 implementation with its six identity references split
-- between the acting account and the owning account. Nothing else changed.
-- ---------------------------------------------------------------------------
create or replace function private.create_listing_submission_for_owner(
  p_actor_id uuid,
  p_owner_id uuid,
  p_submission_key uuid,
  p_listing jsonb,
  p_detail jsonb,
  p_media jsonb
)
returns jsonb as $function$
declare
  actor public.users%rowtype;
  existing public.listings%rowtype;
  created public.listings%rowtype;
  location_row public.locations%rowtype;
  normalized_kind public.listing_kind;
  normalized_title text := trim(coalesce(p_listing ->> 'title', ''));
  normalized_description text := trim(coalesce(p_listing ->> 'description', ''));
  normalized_category text := trim(coalesce(p_listing ->> 'category', ''));
  normalized_offer text := trim(coalesce(p_listing ->> 'listingType', ''));
  normalized_phone text := nullif(trim(coalesce(p_listing ->> 'contactPhone', '')), '');
  normalized_whatsapp text := nullif(trim(coalesce(p_listing ->> 'contactWhatsapp', '')), '');
  normalized_email text := nullif(lower(trim(coalesce(p_listing ->> 'contactEmail', ''))), '');
  normalized_price numeric;
  normalized_currency text := upper(trim(coalesce(p_listing ->> 'currency', 'USD')));
  normalized_location uuid;
  normalized_country text;
  media_count integer;
  media_item jsonb;
  media_intent public.listing_upload_intents%rowtype;
  media_paths jsonb := '[]'::jsonb;
  media_index integer := 0;
begin
  if not exists (
    select 1 from public.users where id = p_owner_id and status = 'active'
  ) then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if p_submission_key is null then
    raise exception 'submission key is required' using errcode = '22023';
  end if;

  select * into existing from public.listings where submission_key = p_submission_key;
  if found then
    if existing.seller_id <> p_owner_id then
      raise exception 'submission key already used' using errcode = '23505';
    end if;
    return jsonb_build_object('id', existing.id, 'kind', existing.kind, 'status', existing.status);
  end if;

  select * into actor from public.users where id = p_owner_id and status = 'active';
  normalized_kind := (p_listing ->> 'kind')::public.listing_kind;
  normalized_price := (p_listing ->> 'price')::numeric;
  normalized_location := (p_listing ->> 'locationId')::uuid;
  media_count := jsonb_array_length(coalesce(p_media, '[]'::jsonb));

  select * into location_row from public.locations
  where id = normalized_location and is_active;
  if not found then
    raise exception 'active location not found' using errcode = '22023';
  end if;
  normalized_country := upper(location_row.country_code);

  if length(normalized_title) not between 10 and 160
    or length(normalized_description) not between 50 and 5000
    or normalized_price <= 0 or normalized_price > 999999999999.99
    or normalized_currency !~ '^[A-Z]{3}$'
    or not public.is_country_publishable(normalized_country)
    or not public.is_supported_listing_currency(normalized_country, normalized_currency)
    or normalized_offer not in ('sale', 'rent')
    or normalized_category !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
    or length(coalesce(normalized_phone, '')) > 40
    or length(coalesce(normalized_whatsapp, '')) > 40
    or length(coalesce(normalized_email, '')) > 254
    or (normalized_email is not null and normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (normalized_phone is null and normalized_whatsapp is null and normalized_email is null)
    or media_count not between 1 and 20
  then
    raise exception 'invalid listing submission' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.categories c
    where c.slug = normalized_category and c.marketplace_kind = normalized_kind::text
      and c.parent_id is not null and c.is_active
  ) then
    raise exception 'active listing category not found' using errcode = '22023';
  end if;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    select * into media_intent
    from public.listing_upload_intents
    where id = (media_item ->> 'intentId')::uuid
      and user_id = p_actor_id
      and storage_path = media_item ->> 'path'
      and state = 'uploaded'
      and expires_at > now()
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'listing-images'
          and o.name = listing_upload_intents.storage_path
          and o.owner_id = listing_upload_intents.user_id::text
          and o.metadata ->> 'mimetype' = listing_upload_intents.mime_type
          and (o.metadata ->> 'size')::integer = listing_upload_intents.byte_size
      )
    for update;
    if not found then
      raise exception 'listing image is invalid, expired, or already attached' using errcode = '22023';
    end if;
    if media_paths ? media_intent.storage_path then
      raise exception 'duplicate listing image' using errcode = '22023';
    end if;
    media_paths := media_paths || jsonb_build_array(media_intent.storage_path);
  end loop;

  insert into public.listings (
    kind, seller_id, seller_name, contact_phone, contact_whatsapp, contact_email,
    title, description, price, currency, native_price, native_currency,
    accepts_offers, photos, location_id, country_code, latitude, longitude,
    public_latitude, public_longitude, public_location_label, public_location,
    category, listing_type, status, created_via, verified, submission_key,
    submitted_at, moderation_reason, expires_at, expiry_notice_sent_at
  ) values (
    normalized_kind, p_owner_id, coalesce(nullif(trim(actor.full_name), ''), actor.email),
    normalized_phone, normalized_whatsapp, normalized_email,
    normalized_title, normalized_description, normalized_price, normalized_currency,
    normalized_price, normalized_currency,
    coalesce((p_listing ->> 'negotiable')::boolean, false), media_paths,
    normalized_location, normalized_country, location_row.latitude, location_row.longitude,
    location_row.latitude, location_row.longitude, location_row.name,
    case when location_row.longitude is not null and location_row.latitude is not null
      then extensions.st_setsrid(extensions.st_makepoint(location_row.longitude::double precision, location_row.latitude::double precision), 4326)::extensions.geography
      else null
    end,
    normalized_category, normalized_offer,
    'available', 'single', false, p_submission_key, now(), null, null, null
  ) returning * into created;

  if normalized_kind = 'property' then
    insert into public.property_details (
      listing_id, property_type, bedrooms, bathrooms, size_sqm
    ) values (
      created.id,
      coalesce(nullif(p_detail ->> 'propertyType', ''), 'other')::public.property_type,
      nullif(p_detail ->> 'bedrooms', '')::integer,
      nullif(p_detail ->> 'bathrooms', '')::integer,
      nullif(p_detail ->> 'sizeSqm', '')::numeric
    );
  elsif normalized_kind = 'car' then
    insert into public.car_details (
      listing_id, brand, model, year, mileage, fuel_type, transmission, condition
    ) values (
      created.id, nullif(trim(p_detail ->> 'brand'), ''), nullif(trim(p_detail ->> 'model'), ''),
      nullif(p_detail ->> 'year', '')::integer, nullif(p_detail ->> 'mileage', '')::integer,
      nullif(p_detail ->> 'fuelType', '')::public.car_fuel_type,
      nullif(p_detail ->> 'transmission', '')::public.car_transmission,
      nullif(lower(trim(p_detail ->> 'condition')), '')
    );
  else
    insert into public.machinery_details (
      listing_id, machinery_type, brand, model, condition, year, usage_hours
    ) values (
      created.id,
      coalesce(nullif(p_detail ->> 'machineryType', ''), 'other')::public.machinery_type,
      nullif(trim(p_detail ->> 'brand'), ''), nullif(trim(p_detail ->> 'model'), ''),
      coalesce(nullif(p_detail ->> 'condition', ''), 'good')::public.machinery_condition,
      nullif(p_detail ->> 'year', '')::integer,
      nullif(p_detail ->> 'usageHours', '')::integer
    );
  end if;

  for media_item in select value from jsonb_array_elements(p_media)
  loop
    select * into media_intent from public.listing_upload_intents
    where id = (media_item ->> 'intentId')::uuid for update;
    insert into public.listing_media (
      listing_id, owner_id, storage_path, display_order, mime_type,
      byte_size, width_px, height_px, sha256_hex
    ) values (
      created.id, p_owner_id, media_intent.storage_path, media_index,
      media_intent.mime_type, media_intent.byte_size, media_intent.width_px,
      media_intent.height_px, media_intent.sha256_hex
    );
    update public.listing_upload_intents
    set state = 'attached', attached_at = now()
    where id = media_intent.id;
    media_index := media_index + 1;
  end loop;

  return jsonb_build_object('id', created.id, 'kind', created.kind, 'status', created.status);
end;
$function$ language plpgsql security definer set search_path = public, storage, extensions;

revoke all on function private.create_listing_submission_for_owner(uuid, uuid, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.create_v1_listing_submission(
  p_submission_key uuid,
  p_listing jsonb,
  p_detail jsonb,
  p_media jsonb
)
returns jsonb as $function$
begin
  return private.create_listing_submission_for_owner(
    auth.uid(), auth.uid(), p_submission_key, p_listing, p_detail, p_media
  );
end;
$function$ language plpgsql security definer set search_path = public, storage, extensions;

-- ---------------------------------------------------------------------------
-- V2 schema-registry submission, owner-parameterised.
--
-- The body is the Aug-8 implementation; only the delegation target changed, so
-- admin-served publication is validated against the same schema registry as
-- owner-served publication.
-- ---------------------------------------------------------------------------
create or replace function private.create_v2_listing_submission_for_owner(
  p_actor_id uuid,
  p_owner_id uuid,
  p_submission_key uuid,
  p_listing jsonb,
  p_detail jsonb,
  p_attributes jsonb,
  p_media jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, storage, extensions
as $function$
declare
  normalized_kind text := lower(trim(coalesce(p_listing ->> 'kind', '')));
  exact_offer text := lower(trim(coalesce(p_listing ->> 'listingType', '')));
  compatibility_offer text;
  exact_property_type text;
  exact_fuel_type text;
  exact_transmission text;
  exact_car_condition text;
  exact_machinery_type text;
  exact_machinery_condition text;
  legacy_listing jsonb;
  legacy_detail jsonb;
  existing_listing_id uuid;
  created_result jsonb;
  created_listing_id uuid;
begin
  if jsonb_typeof(coalesce(p_listing, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_detail, 'null'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(p_media, 'null'::jsonb)) <> 'array'
     or not public.is_valid_attribute_document(p_attributes) then
    raise exception 'invalid v2 listing submission envelope' using errcode = '22023';
  end if;

  if normalized_kind not in ('property', 'car', 'machinery') then
    raise exception 'unsupported v2 listing kind' using errcode = '22023';
  end if;

  if exact_offer not in ('sale', 'rent', 'lease', 'short_stay') then
    raise exception 'unsupported v2 offer type' using errcode = '22023';
  end if;

  compatibility_offer := case
    when exact_offer = 'sale' then 'sale'
    else 'rent'
  end;
  legacy_listing := p_listing || jsonb_build_object('listingType', compatibility_offer);

  -- Remember whether this is an idempotent retry before delegating. The V1
  -- boundary remains authoritative for account status and ownership checks.
  select id
  into existing_listing_id
  from public.listings
  where submission_key = p_submission_key;

  if normalized_kind = 'property' then
    if (p_detail - array['property_type','bedrooms','bathrooms','size_sqm']::text[]) <> '{}'::jsonb then
      raise exception 'unsupported property detail field' using errcode = '22023';
    end if;

    exact_property_type := nullif(lower(trim(coalesce(p_detail ->> 'property_type', ''))), '');
    if exact_property_type is null or exact_property_type <> all(array[
      'house','apartment','townhouse','cottage','office','retail','warehouse','factory','farm','stand'
    ]::text[]) then
      raise exception 'unsupported property type' using errcode = '22023';
    end if;

    legacy_detail := jsonb_build_object(
      'propertyType', case
        when exact_property_type = any(array['house','apartment']::text[]) then exact_property_type
        else 'other'
      end,
      'bedrooms', p_detail -> 'bedrooms',
      'bathrooms', p_detail -> 'bathrooms',
      'sizeSqm', p_detail -> 'size_sqm'
    );
  elsif normalized_kind = 'car' then
    if (p_detail - array['brand','model','year','mileage','fuel_type','transmission','condition']::text[]) <> '{}'::jsonb then
      raise exception 'unsupported vehicle detail field' using errcode = '22023';
    end if;

    exact_fuel_type := nullif(lower(trim(coalesce(p_detail ->> 'fuel_type', ''))), '');
    exact_transmission := nullif(lower(trim(coalesce(p_detail ->> 'transmission', ''))), '');
    exact_car_condition := nullif(lower(trim(coalesce(p_detail ->> 'condition', ''))), '');

    if exact_fuel_type is null or exact_fuel_type <> all(array[
      'petrol','diesel','electric','hybrid','plug_in_hybrid','lpg'
    ]::text[]) then
      raise exception 'unsupported vehicle fuel type' using errcode = '22023';
    end if;
    if exact_transmission is null or exact_transmission <> all(array[
      'manual','automatic','cvt','dct'
    ]::text[]) then
      raise exception 'unsupported vehicle transmission' using errcode = '22023';
    end if;
    if exact_car_condition is null or exact_car_condition <> all(array[
      'new','excellent','good','fair','for_parts'
    ]::text[]) then
      raise exception 'unsupported vehicle condition' using errcode = '22023';
    end if;

    legacy_detail := jsonb_build_object(
      'brand', p_detail -> 'brand',
      'model', p_detail -> 'model',
      'year', p_detail -> 'year',
      'mileage', p_detail -> 'mileage',
      'fuelType', case
        when exact_fuel_type = 'plug_in_hybrid' then 'hybrid'
        when exact_fuel_type = 'lpg' then 'petrol'
        else exact_fuel_type
      end,
      'transmission', case
        when exact_transmission in ('cvt', 'dct') then 'automatic'
        else exact_transmission
      end,
      'condition', exact_car_condition
    );
  else
    if (p_detail - array['machinery_type','brand','model','condition','year','usage_hours']::text[]) <> '{}'::jsonb then
      raise exception 'unsupported machinery detail field' using errcode = '22023';
    end if;

    exact_machinery_type := nullif(lower(trim(coalesce(p_detail ->> 'machinery_type', ''))), '');
    exact_machinery_condition := nullif(lower(trim(coalesce(p_detail ->> 'condition', ''))), '');

    if exact_machinery_type is null or exact_machinery_type <> all(array[
      'excavator','loader','bulldozer','grader','crane','forklift','tipper','tractor','generator','compressor'
    ]::text[]) then
      raise exception 'unsupported machinery type' using errcode = '22023';
    end if;
    if exact_machinery_condition is null or exact_machinery_condition <> all(array[
      'new','excellent','good','fair','for_parts'
    ]::text[]) then
      raise exception 'unsupported machinery condition' using errcode = '22023';
    end if;

    legacy_detail := jsonb_build_object(
      'machineryType', case
        when exact_machinery_type = 'tractor' then 'agricultural'
        when exact_machinery_type in ('generator','compressor','forklift') then 'industrial'
        when exact_machinery_type in ('tipper') then 'transport'
        else 'construction'
      end,
      'brand', p_detail -> 'brand',
      'model', p_detail -> 'model',
      'condition', case
        when exact_machinery_condition = 'for_parts' then 'needs_repair'
        else exact_machinery_condition
      end,
      'year', p_detail -> 'year',
      'usageHours', p_detail -> 'usage_hours'
    );
  end if;

  created_result := private.create_listing_submission_for_owner(
    p_actor_id,
    p_owner_id,
    p_submission_key,
    legacy_listing,
    legacy_detail,
    p_media
  );

  -- A repeated submission key is a read of the original result, never an edit
  -- channel for changing its attributes after publication.
  if existing_listing_id is not null then
    return created_result;
  end if;

  created_listing_id := (created_result ->> 'id')::uuid;

  update public.listings
  set attributes = p_attributes,
      listing_type = exact_offer
  where id = created_listing_id;

  if normalized_kind = 'property' then
    update public.property_details
    set property_type = exact_property_type
    where listing_id = created_listing_id;
  elsif normalized_kind = 'car' then
    update public.car_details
    set fuel_type = exact_fuel_type,
        transmission = exact_transmission,
        condition = exact_car_condition
    where listing_id = created_listing_id;
  else
    update public.machinery_details
    set machinery_type = exact_machinery_type,
        condition = exact_machinery_condition
    where listing_id = created_listing_id;
  end if;

  return created_result;
end;
$function$;

revoke all on function private.create_v2_listing_submission_for_owner(uuid, uuid, uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function private.create_v2_listing_submission(
  p_submission_key uuid,
  p_listing jsonb,
  p_detail jsonb,
  p_attributes jsonb,
  p_media jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, storage, extensions
as $function$
begin
  return private.create_v2_listing_submission_for_owner(
    auth.uid(), auth.uid(), p_submission_key, p_listing, p_detail, p_attributes, p_media
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Admin publication on behalf of a business.
--
-- Two origins are legitimate, and nothing else is: a business that has been
-- onboarded and holds an approved category, or an owner who asked for the
-- managed advertising service and whose request has been accepted. Without
-- that check an admin listing tool would be a way around the curated
-- marketplace boundary rather than part of it.
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_business_listing(
  p_owner_user_id uuid,
  p_submission_key uuid,
  p_listing jsonb,
  p_detail jsonb,
  p_attributes jsonb,
  p_media jsonb,
  p_reason text,
  p_managed_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, storage, extensions
as $function$
declare
  v_actor uuid := auth.uid();
  v_kind text := lower(trim(coalesce(p_listing ->> 'kind', '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_approval_id uuid;
  v_application_id uuid;
  v_managed_status text;
  v_managed_category text;
  v_managed_requester uuid;
  v_result jsonb;
  v_listing_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_owner_user_id is null then
    raise exception 'Choose the business this listing belongs to' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) < 3 then
    raise exception 'Record why this listing is being published on behalf of the business'
      using errcode = '22023';
  end if;
  if v_kind not in ('property', 'car', 'machinery') then
    raise exception 'Unsupported listing kind' using errcode = '22023';
  end if;

  select id, business_application_id
  into v_approval_id, v_application_id
  from public.business_category_approvals
  where user_id = p_owner_user_id
    and category = v_kind
    and status = 'approved';

  -- A named request is validated whenever it is named, not only when it is the
  -- caller's standing to publish. Publication marks the request published, and
  -- an unchecked identifier would let one business's publication close another
  -- owner's request.
  if p_managed_request_id is not null then
    select requester_user_id, category, status
    into v_managed_requester, v_managed_category, v_managed_status
    from public.managed_listing_requests
    where id = p_managed_request_id
    for update;

    if not found then
      raise exception 'Managed listing request not found' using errcode = '22023';
    end if;
    if v_managed_requester <> p_owner_user_id then
      raise exception 'That managed listing request belongs to a different account'
        using errcode = '22023';
    end if;
    if v_managed_category <> v_kind then
      raise exception 'That managed listing request is for a different category'
        using errcode = '22023';
    end if;
    if v_managed_status <> 'accepted' then
      raise exception 'Accept the managed listing request before publishing it'
        using errcode = '22023';
    end if;
  elsif v_approval_id is null then
    raise exception
      'This account is not approved to publish % listings. Onboard the business first, or publish against an accepted managed listing request.',
      v_kind
      using errcode = '42501';
  end if;

  v_result := private.create_v2_listing_submission_for_owner(
    v_actor, p_owner_user_id, p_submission_key, p_listing, p_detail, p_attributes, p_media
  );
  v_listing_id := (v_result ->> 'id')::uuid;

  if p_managed_request_id is not null then
    update public.managed_listing_requests
    set status = 'published',
        reviewer_message = v_reason,
        updated_at = now()
    where id = p_managed_request_id;
  end if;

  if v_application_id is not null then
    insert into public.business_review_events (
      application_id, category_approval_id, actor_user_id, action,
      previous_status, new_status, message
    ) values (
      v_application_id, v_approval_id, v_actor, 'listing_published_for_business',
      'approved', 'approved', v_reason
    );
  end if;

  perform public.record_admin_action(
    'business.publish_listing',
    v_listing_id::text,
    'listing',
    v_reason,
    jsonb_build_object('managed_request_id', p_managed_request_id),
    jsonb_build_object(
      'listing_id', v_listing_id,
      'owner_user_id', p_owner_user_id,
      'kind', v_kind,
      'status', v_result ->> 'status'
    )
  );

  return v_result || jsonb_build_object('owner_user_id', p_owner_user_id);
end;
$function$;

revoke all on function public.admin_create_business_listing(
  uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, uuid
) from public, anon, authenticated;
grant execute on function public.admin_create_business_listing(
  uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, uuid
) to authenticated;

comment on function private.create_listing_submission_for_owner(uuid, uuid, uuid, jsonb, jsonb, jsonb)
  is 'V1 listing transaction with the acting account and the owning account separated.';
comment on function public.admin_create_business_listing(
  uuid, uuid, jsonb, jsonb, jsonb, jsonb, text, uuid
) is 'Publishes a listing owned by an approved business or an accepted managed listing request, with an audit-log record.';

commit;
