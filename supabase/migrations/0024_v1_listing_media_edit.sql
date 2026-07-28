-- Atomic owner edit boundary for trusted V1 product images.

create or replace function public.replace_listing_media(
  p_listing_id uuid,
  p_keep_paths text[] default '{}'::text[],
  p_new_media jsonb default '[]'::jsonb
)
returns jsonb as $$
declare
  listing_row public.listings%rowtype;
  intent public.listing_upload_intents%rowtype;
  item jsonb;
  keep_paths text[] := coalesce(p_keep_paths, '{}'::text[]);
  new_media jsonb := coalesce(p_new_media, '[]'::jsonb);
  kept_count integer;
  free_order integer;
  media_paths jsonb;
  removed_paths text[];
  next_status public.listing_status;
begin
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  select * into listing_row
  from public.listings
  where id = p_listing_id and seller_id = auth.uid()
  for update;
  if not found then
    raise exception 'listing not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(new_media) <> 'array' then
    raise exception 'new listing media must be an array' using errcode = '22023';
  end if;
  if cardinality(keep_paths) + jsonb_array_length(new_media) not between 1 and 20 then
    raise exception 'a listing must contain between one and twenty images' using errcode = '22023';
  end if;
  if (select count(*) from unnest(keep_paths) path(value))
      <> (select count(distinct value) from unnest(keep_paths) path(value)) then
    raise exception 'kept listing images must be unique' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(listing_row.photos, '[]'::jsonb)) photo(path)
    where photo.path !~* '^[0-9a-f-]{36}/staging/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ) then
    raise exception 'legacy listing media requires migration before editing' using errcode = '55000';
  end if;

  select count(*) into kept_count
  from public.listing_media lm
  where lm.listing_id = p_listing_id
    and lm.owner_id = auth.uid()
    and lm.storage_path = any(keep_paths);
  if kept_count <> cardinality(keep_paths) then
    raise exception 'a kept listing image is not attached to this listing' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements(new_media))
      <> (select count(distinct value ->> 'path') from jsonb_array_elements(new_media)) then
    raise exception 'new listing images must be unique' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new_media) value
    where value ->> 'path' = any(keep_paths)
  ) then
    raise exception 'a listing image cannot be both kept and newly attached' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(new_media)
  loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item ->> 'intentId', '') !~* '^[0-9a-f-]{36}$'
      or coalesce(item ->> 'path', '') !~* '^[0-9a-f-]{36}/staging/[0-9a-f-]{36}\.(jpg|png|webp)$' then
      raise exception 'new listing image is invalid' using errcode = '22023';
    end if;

    select * into intent
    from public.listing_upload_intents
    where id = (item ->> 'intentId')::uuid
      and user_id = auth.uid()
      and storage_path = item ->> 'path'
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
      raise exception 'new listing image is invalid, expired, or already attached' using errcode = '22023';
    end if;
  end loop;

  with removed as (
    delete from public.listing_media lm
    where lm.listing_id = p_listing_id
      and lm.owner_id = auth.uid()
      and not (lm.storage_path = any(keep_paths))
    returning lm.storage_path
  )
  select coalesce(array_agg(storage_path), '{}'::text[])
    into removed_paths
  from removed;

  for item in select value from jsonb_array_elements(new_media)
  loop
    select slot into free_order
    from generate_series(0, 19) slot
    where not exists (
      select 1 from public.listing_media lm
      where lm.listing_id = p_listing_id and lm.display_order = slot
    )
    order by slot
    limit 1;

    select * into intent
    from public.listing_upload_intents
    where id = (item ->> 'intentId')::uuid
    for update;

    insert into public.listing_media (
      listing_id, owner_id, storage_path, display_order, mime_type,
      byte_size, width_px, height_px, sha256_hex
    ) values (
      p_listing_id, auth.uid(), intent.storage_path, free_order, intent.mime_type,
      intent.byte_size, intent.width_px, intent.height_px, intent.sha256_hex
    );

    update public.listing_upload_intents
    set state = 'attached', attached_at = now()
    where id = intent.id;
  end loop;

  select coalesce(jsonb_agg(lm.storage_path order by lm.display_order), '[]'::jsonb)
    into media_paths
  from public.listing_media lm
  where lm.listing_id = p_listing_id;

  next_status := case
    when listing_row.status in ('available', 'under_offer', 'rented', 'paused')
      then 'pending_review'::public.listing_status
    else listing_row.status
  end;
  update public.listings
  set photos = media_paths,
      status = next_status,
      submitted_at = case when next_status = 'pending_review' then now() else submitted_at end,
      moderation_reason = case when next_status = 'pending_review' then null else moderation_reason end,
      expires_at = case when next_status = 'pending_review' then null else expires_at end,
      expiry_notice_sent_at = case when next_status = 'pending_review' then null else expiry_notice_sent_at end
  where id = p_listing_id;

  return jsonb_build_object(
    'photos', media_paths,
    'removedPaths', to_jsonb(removed_paths),
    'status', next_status
  );
end;
$$ language plpgsql security definer set search_path = public, storage;

create or replace function public.protect_listing_photo_mutation()
returns trigger as $$
begin
  if auth.uid() = old.seller_id
    and not public.is_admin()
    and current_user not in ('postgres', 'service_role')
    and new.photos is distinct from old.photos then
    raise exception 'listing photos require a trusted operation' using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists protect_listing_photo_mutation on public.listings;
create trigger protect_listing_photo_mutation
before update of photos on public.listings
for each row execute function public.protect_listing_photo_mutation();

revoke all on function public.replace_listing_media(uuid, text[], jsonb) from public;
grant execute on function public.replace_listing_media(uuid, text[], jsonb) to authenticated;
