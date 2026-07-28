-- Conservative rollback for 0035. Disable Tours before removing lifecycle workers.
update public.marketplace_feature_controls set enabled = false, updated_at = now()
where feature_key = 'tours';

drop trigger if exists trg_listing_tours_delete_invalidation on public.listing_tours;
drop trigger if exists trg_listing_tours_state_invalidation on public.listing_tours;
drop trigger if exists trg_tour_slots_invalidation on public.listing_tour_slots;
drop trigger if exists trg_services_tour_invalidation on public.services;
drop trigger if exists trg_listings_tour_invalidation on public.listings;
drop trigger if exists trg_listing_tours_cleanup_before_delete on public.listing_tours;
drop trigger if exists trg_listing_tours_enqueue_cleanup on public.listing_tours;

drop function if exists public.finalize_tour_cache_invalidation(bigint, uuid, boolean, text);
drop function if exists public.claim_tour_cache_invalidations(integer, timestamptz);
drop function if exists public.emit_tour_delete_invalidation();
drop function if exists public.emit_tour_state_invalidation();
drop function if exists public.emit_tour_slot_invalidation();
drop function if exists public.emit_service_tour_parent_invalidation();
drop function if exists public.emit_listing_tour_parent_invalidation();
drop function if exists public.finalize_tour_cleanup_job(uuid, uuid, boolean, text, timestamptz);
drop function if exists public.claim_tour_cleanup_jobs(integer, timestamptz);
drop function if exists public.enqueue_tour_cleanup_before_delete();
drop function if exists public.enqueue_tour_cleanup_on_state_change();

do $$
begin
  if exists (select 1 from public.tour_asset_cleanup_queue where state <> 'completed') then
    raise exception 'cannot rollback 0035 while Tour cleanup jobs are pending';
  end if;
  if exists (select 1 from public.tour_cache_invalidations where processed_at is null) then
    raise exception 'cannot rollback 0035 while cache invalidations are pending';
  end if;
end $$;

drop table if exists public.tour_cache_invalidations;
drop table if exists public.tour_asset_cleanup_queue;
alter table public.listing_tours
  drop column if exists source_deleted_at,
  drop column if exists playback_deleted_at,
  drop column if exists thumbnail_deleted_at;
