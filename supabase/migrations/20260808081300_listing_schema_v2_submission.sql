-- 20260808081300_listing_schema_v2_submission.sql
--
-- Activates the versioned listingSchema storage seam without replacing the
-- mature V1 listing transaction. V2 delegates creation, media attachment,
-- curated-publishing checks and idempotency to the existing private V1
-- implementation, then persists the exact schema-registry values atomically.
--
-- The legacy detail enums are widened to text because the registry already has
-- legitimate values that the original enums cannot represent. The enum types
-- themselves remain in place so V1 compatibility coercion keeps working for
-- older clients during the transition.

begin;

-- Preserve V1 assignment semantics after the normalized columns become text.
-- These casts are assignment-only: they do not make enum/text comparisons
-- implicit elsewhere in queries.
do $casts$
begin
  if not exists (
    select 1 from pg_cast
    where castsource = 'public.property_type'::regtype
      and casttarget = 'text'::regtype
  ) then
    create cast (public.property_type as text) with inout as assignment;
  end if;

  if not exists (
    select 1 from pg_cast
    where castsource = 'public.car_fuel_type'::regtype
      and casttarget = 'text'::regtype
  ) then
    create cast (public.car_fuel_type as text) with inout as assignment;
  end if;

  if not exists (
    select 1 from pg_cast
    where castsource = 'public.car_transmission'::regtype
      and casttarget = 'text'::regtype
  ) then
    create cast (public.car_transmission as text) with inout as assignment;
  end if;

  if not exists (
    select 1 from pg_cast
    where castsource = 'public.machinery_type'::regtype
      and casttarget = 'text'::regtype
  ) then
    create cast (public.machinery_type as text) with inout as assignment;
  end if;

  if not exists (
    select 1 from pg_cast
    where castsource = 'public.machinery_condition'::regtype
      and casttarget = 'text'::regtype
  ) then
    create cast (public.machinery_condition as text) with inout as assignment;
  end if;
end;
$casts$;

-- The three convenience views are the only schema objects bound directly to
-- these enum-typed detail columns. Recreate them in the same transaction after
-- widening so callers never observe a missing view.
drop view public.cars;
drop view public.properties;
drop view public.machinery;

alter table public.property_details
  alter column property_type type text using property_type::text;

alter table public.car_details
  alter column fuel_type type text using fuel_type::text,
  alter column transmission type text using transmission::text;

alter table public.machinery_details
  alter column machinery_type type text using machinery_type::text,
  alter column condition type text using condition::text;

-- Accept the union of historical V1 values and the current registry values.
-- V2 itself is stricter and accepts only current registry values; the wider
-- checks keep old rows and old V1 clients readable during the migration.
alter table public.property_details
  add constraint property_details_property_type_v2_values
  check (
    property_type is null
    or property_type = any(array[
      'house','apartment','land','commercial','other',
      'townhouse','cottage','office','retail','warehouse','factory','farm','stand'
    ]::text[])
  );

alter table public.car_details
  add constraint car_details_fuel_type_v2_values
  check (fuel_type is null or fuel_type = any(array[
    'petrol','diesel','electric','hybrid','plug_in_hybrid','lpg'
  ]::text[])),
  add constraint car_details_transmission_v2_values
  check (transmission is null or transmission = any(array[
    'manual','automatic','cvt','dct'
  ]::text[]));

alter table public.machinery_details
  add constraint machinery_details_type_v2_values
  check (
    machinery_type is null
    or machinery_type = any(array[
      'construction','agricultural','industrial','transport','other',
      'excavator','loader','bulldozer','grader','crane','forklift','tipper',
      'tractor','generator','compressor'
    ]::text[])
  ),
  add constraint machinery_details_condition_v2_values
  check (
    condition is null
    or condition = any(array[
      'new','excellent','good','fair','needs_repair','for_parts'
    ]::text[])
  );

create view public.cars with (security_invoker = true) as
  select l.*, cd.brand, cd.model, cd.year, cd.mileage, cd.fuel_type, cd.transmission, cd.condition
  from public.listings l join public.car_details cd on cd.listing_id = l.id
  where l.kind = 'car';

create view public.properties with (security_invoker = true) as
  select l.*, pd.property_type, pd.bedrooms, pd.bathrooms, pd.size_sqm
  from public.listings l join public.property_details pd on pd.listing_id = l.id
  where l.kind = 'property';

create view public.machinery with (security_invoker = true) as
  select l.*, md.machinery_type, md.brand, md.model, md.condition, md.year, md.usage_hours
  from public.listings l join public.machinery_details md on md.listing_id = l.id
  where l.kind = 'machinery';

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

  created_result := private.create_v1_listing_submission(
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

revoke all on function private.create_v2_listing_submission(uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.create_v2_listing_submission(uuid, jsonb, jsonb, jsonb, jsonb)
  to authenticated, service_role;

create or replace function public.create_v2_listing_submission(
  p_submission_key uuid,
  p_listing jsonb,
  p_detail jsonb,
  p_attributes jsonb,
  p_media jsonb
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $wrapper$
  select private.create_v2_listing_submission($1, $2, $3, $4, $5);
$wrapper$;

revoke all on function public.create_v2_listing_submission(uuid, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.create_v2_listing_submission(uuid, jsonb, jsonb, jsonb, jsonb)
  to authenticated, service_role;

comment on function public.create_v2_listing_submission(uuid, jsonb, jsonb, jsonb, jsonb)
  is 'findit:listing-schema-v2-authenticated-boundary';

commit;
