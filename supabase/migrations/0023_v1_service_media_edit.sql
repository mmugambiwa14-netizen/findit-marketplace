-- Atomic owner edit boundary for trusted V1 service images.

create or replace function public.replace_service_media(
  p_service_id uuid,
  p_keep_paths text[] default '{}'::text[],
  p_new_media jsonb default '[]'::jsonb
)
returns jsonb as $$
declare
  service_row public.services%rowtype;
  intent public.marketplace_image_upload_intents%rowtype;
  item jsonb;
  keep_paths text[] := coalesce(p_keep_paths, '{}'::text[]);
  new_media jsonb := coalesce(p_new_media, '[]'::jsonb);
  kept_count integer;
  free_order integer;
  media_paths jsonb;
  removed_paths text[];
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  select * into service_row
  from public.services
  where id = p_service_id
    and provider_id = auth.uid()
    and category <> 'legal'
  for update;
  if not found then
    raise exception 'service not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(new_media) <> 'array' then
    raise exception 'new service media must be an array' using errcode = '22023';
  end if;
  if cardinality(keep_paths) + jsonb_array_length(new_media) > 6 then
    raise exception 'a service can contain at most six images' using errcode = '22023';
  end if;
  if (select count(*) from unnest(keep_paths) path(value))
      <> (select count(distinct value) from unnest(keep_paths) path(value)) then
    raise exception 'kept service images must be unique' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(service_row.photos, '[]'::jsonb)) photo(path)
    where photo.path !~* '^[0-9a-f-]{36}/service_photo/staging/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ) then
    raise exception 'legacy service media requires migration before editing' using errcode = '55000';
  end if;

  select count(*) into kept_count
  from public.service_media sm
  where sm.service_id = p_service_id
    and sm.owner_id = auth.uid()
    and sm.storage_path = any(keep_paths);
  if kept_count <> cardinality(keep_paths) then
    raise exception 'a kept service image is not attached to this service' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements(new_media))
      <> (select count(distinct value ->> 'path') from jsonb_array_elements(new_media)) then
    raise exception 'new service images must be unique' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new_media) value
    where value ->> 'path' = any(keep_paths)
  ) then
    raise exception 'a service image cannot be both kept and newly attached' using errcode = '22023';
  end if;

  -- Validate and lock every new intent before changing any existing attachment.
  for item in select value from jsonb_array_elements(new_media)
  loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'intentId', '') !~* '^[0-9a-f-]{36}$'
      or coalesce(item ->> 'path', '') !~* '^[0-9a-f-]{36}/service_photo/staging/[0-9a-f-]{36}\.(jpg|png|webp)$' then
      raise exception 'new service image is invalid' using errcode = '22023';
    end if;

    select * into intent
    from public.marketplace_image_upload_intents
    where id = (item ->> 'intentId')::uuid
      and user_id = auth.uid()
      and storage_path = item ->> 'path'
      and purpose = 'service_photo'
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
      raise exception 'new service image is invalid, expired, or already attached' using errcode = '22023';
    end if;
  end loop;

  with removed as (
    delete from public.service_media sm
    where sm.service_id = p_service_id
      and sm.owner_id = auth.uid()
      and not (sm.storage_path = any(keep_paths))
    returning sm.storage_path
  )
  select coalesce(array_agg(storage_path), '{}'::text[])
    into removed_paths
  from removed;

  for item in select value from jsonb_array_elements(new_media)
  loop
    select slot into free_order
    from generate_series(0, 5) slot
    where not exists (
      select 1 from public.service_media sm
      where sm.service_id = p_service_id and sm.display_order = slot
    )
    order by slot
    limit 1;

    select * into intent
    from public.marketplace_image_upload_intents
    where id = (item ->> 'intentId')::uuid
    for update;

    insert into public.service_media (
      service_id, owner_id, storage_path, display_order, mime_type,
      byte_size, width_px, height_px, sha256_hex
    ) values (
      p_service_id, auth.uid(), intent.storage_path, free_order, intent.mime_type,
      intent.byte_size, intent.width_px, intent.height_px, intent.sha256_hex
    );

    update public.marketplace_image_upload_intents
    set state = 'attached', attached_at = now()
    where id = intent.id;
  end loop;

  select coalesce(jsonb_agg(sm.storage_path order by sm.display_order), '[]'::jsonb)
    into media_paths
  from public.service_media sm
  where sm.service_id = p_service_id;

  update public.services
  set photos = media_paths
  where id = p_service_id;

  return jsonb_build_object(
    'photos', media_paths,
    'removedPaths', to_jsonb(removed_paths)
  );
end;
$$ language plpgsql security definer set search_path = public, storage;

revoke all on function public.replace_service_media(uuid, text[], jsonb) from public;
grant execute on function public.replace_service_media(uuid, text[], jsonb) to authenticated;
