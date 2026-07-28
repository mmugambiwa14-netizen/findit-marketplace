update public.marketplace_feature_controls set enabled = false, updated_at = now()
where feature_key = 'tours';

drop policy if exists "tour_source_authorized_insert" on storage.objects;
drop function if exists public.has_active_tour_upload_intent(text);

drop function if exists public.complete_tour_upload(uuid, uuid);
drop function if exists public.authorize_tour_upload(uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid);

do $$
begin
  if exists (select 1 from public.listing_tour_upload_intents) then
    raise exception 'Tour upload intent records must be retained or exported before rollback';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'tour-sources') then
    raise exception 'Tour source objects must be retained or exported before bucket rollback';
  end if;
end $$;

drop table if exists public.listing_tour_upload_intents;
delete from storage.buckets where id = 'tour-sources';
