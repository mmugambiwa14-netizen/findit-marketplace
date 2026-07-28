update public.marketplace_feature_controls set enabled = false, updated_at = now()
where feature_key = 'tours';

do $$
begin
  if exists (select 1 from public.listing_tours) then
    raise exception 'Tour records must be retained or exported before schema rollback';
  end if;
end $$;

drop trigger if exists trg_listing_tour_slots_integrity on public.listing_tour_slots;
drop trigger if exists trg_listing_tours_parent_owner on public.listing_tours;
drop trigger if exists trg_listing_tour_slots_updated_at on public.listing_tour_slots;
drop trigger if exists trg_listing_tours_updated_at on public.listing_tours;

drop function if exists public.enforce_listing_tour_slot_integrity();
drop function if exists public.enforce_listing_tour_parent_owner();
drop function if exists public.resolve_tour_parent_owner(uuid, uuid);
drop function if exists public.set_backend_feature_enabled(text, boolean, jsonb);
drop function if exists public.is_backend_feature_enabled(text);
drop function if exists public.tour_processing_max_attempts();
drop function if exists public.validate_tour_feature_configuration(jsonb);

drop table if exists public.listing_tour_events;
drop table if exists public.listing_tour_slots;
drop table if exists public.listing_tours;
delete from public.marketplace_feature_controls where feature_key = 'tours';
drop table if exists public.marketplace_feature_controls;
