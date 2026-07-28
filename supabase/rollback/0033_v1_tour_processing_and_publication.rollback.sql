update public.marketplace_feature_controls set enabled = false, updated_at = now()
where feature_key = 'tours';

drop function if exists public.public_tour_metadata(uuid, uuid);
drop function if exists public.is_tour_public_eligible(uuid);
drop function if exists public.is_tour_parent_public(uuid, uuid);
drop function if exists public.fail_tour_processing(uuid, uuid, text, text, boolean);
drop function if exists public.finalize_tour_processing(uuid, uuid, numeric, integer, integer, bigint, text, text, text, text);
drop function if exists public.authorize_tour_processing_callback(uuid, uuid, text);
drop function if exists public.heartbeat_tour_processing(uuid, uuid, integer);
drop function if exists public.mark_tour_processing_dispatched(uuid, uuid, text, text);
drop function if exists public.claim_tour_processing_jobs(integer, timestamptz);

drop index if exists public.idx_listing_tours_owner_created;
drop index if exists public.idx_listing_tours_service_created;
drop index if exists public.idx_listing_tours_listing_created;
drop index if exists public.idx_listing_tours_public_candidate;
drop index if exists public.idx_listing_tours_processing_queue;

do $$
begin
  if exists (select 1 from storage.objects where bucket_id in ('tour-playback', 'tour-thumbnails')) then
    raise exception 'derived Tour objects must be retained or exported before bucket rollback';
  end if;
end $$;

delete from storage.buckets where id in ('tour-playback', 'tour-thumbnails');


-- Restore the 0032 upload completion boundary. Rolling back processing must not
-- remove the already-migrated direct-upload completion function.
create or replace function public.complete_tour_upload(
  p_user_id uuid,
  p_intent_id uuid
)
returns uuid as $$
declare
  intent public.listing_tour_upload_intents%rowtype;
  object_row storage.objects%rowtype;
  affected integer;
begin
  if not public.is_backend_feature_enabled('tours') then
    raise exception 'Tours backend is disabled' using errcode = '55000';
  end if;

  select * into intent
  from public.listing_tour_upload_intents
  where id = p_intent_id and user_id = p_user_id
  for update;
  if not found then
    raise exception 'Tour upload intent not found' using errcode = 'P0002';
  end if;
  if intent.state in ('uploaded', 'processing', 'completed') then
    return intent.tour_id;
  end if;
  if intent.state <> 'authorized' or intent.expires_at <= now() then
    raise exception 'Tour upload intent is not active' using errcode = '22023';
  end if;

  select * into object_row
  from storage.objects
  where bucket_id = 'tour-sources'
    and name = intent.source_storage_path
    and owner_id = p_user_id::text;
  if not found then
    raise exception 'Tour source object is missing' using errcode = '22023';
  end if;
  if coalesce((object_row.metadata ->> 'size')::bigint, -1) <> intent.declared_byte_size
    or coalesce(object_row.metadata ->> 'mimetype', '') <> intent.declared_mime_type then
    raise exception 'Tour source object metadata mismatch' using errcode = '22023';
  end if;

  update public.listing_tour_upload_intents
  set state = 'uploaded', uploaded_at = now()
  where id = intent.id and state = 'authorized';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Tour upload completion raced with another operation' using errcode = '40001';
  end if;

  update public.listing_tours
  set status = 'uploaded', uploaded_at = now(), failure_code = null, failure_message = null
  where id = intent.tour_id and status = 'upload_authorized';

  insert into public.listing_tour_events (
    tour_id, actor_id, actor_type, event_type, previous_status, next_status
  ) values (
    intent.tour_id, p_user_id, 'owner', 'upload_completed', 'upload_authorized', 'uploaded'
  );

  return intent.tour_id;
end;
$$ language plpgsql security definer set search_path = public, storage;

revoke all on function public.complete_tour_upload(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_tour_upload(uuid, uuid) to service_role;
