begin;

drop function if exists private.request_abuse_subject(uuid);

-- Restore the immediately preceding implementations from migration history.
-- This capsule is intentionally explicit so rollback never widens public
-- privileges or reintroduces the client-key trust boundary silently.
create or replace function private.record_marketplace_view(text, uuid)
returns bigint language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_views bigint;
  v_viewer_id uuid := auth.uid();
begin
  if $1 = 'listing' then
    update public.listings set views = coalesce(views, 0) + 1
    where id = $2 and status in ('available', 'under_offer')
      and (v_viewer_id is null or seller_id <> v_viewer_id)
    returning views into v_views;
    if v_views is null then select coalesce(views, 0) into v_views from public.listings where id = $2 and status in ('available', 'under_offer'); end if;
  elsif $1 = 'service' then
    update public.services set views = coalesce(views, 0) + 1
    where id = $2 and status = 'active'
      and (v_viewer_id is null or provider_id <> v_viewer_id)
    returning views into v_views;
    if v_views is null then select coalesce(views, 0) into v_views from public.services where id = $2 and status = 'active'; end if;
  else
    raise exception 'unsupported marketplace parent type' using errcode = '22023';
  end if;
  return v_views;
end;
$function$;

create or replace function public.record_public_tour_view(p_tour_id uuid, p_viewer_key uuid)
returns table(recorded boolean, view_count bigint)
language plpgsql security definer set search_path = public
as $function$
declare inserted_count integer := 0;
begin
  if p_tour_id is null or p_viewer_key is null then raise exception 'invalid Peek view' using errcode = '22023'; end if;
  if not exists (select 1 from public.listing_tours t where t.id = p_tour_id and t.status = 'ready' and t.moderation_status = 'approved' and t.deleted_at is null and t.removed_at is null and t.published_at is not null and public.is_tour_public_eligible(t.id)) then raise exception 'Peek is unavailable' using errcode = 'P0002'; end if;
  insert into public.tour_view_events(tour_id, viewer_key, viewer_id) values (p_tour_id, p_viewer_key, auth.uid()) on conflict (tour_id, viewer_key, viewed_on) do nothing;
  get diagnostics inserted_count = row_count;
  return query select inserted_count = 1, (select count(*)::bigint from public.tour_view_events v where v.tour_id = p_tour_id);
end;
$function$;

revoke all on function private.record_marketplace_view(text, uuid) from public, anon, authenticated, service_role;
grant execute on function private.record_marketplace_view(text, uuid) to anon, authenticated, service_role;
revoke all on function public.record_public_tour_view(uuid, uuid) from public;
grant execute on function public.record_public_tour_view(uuid, uuid) to anon, authenticated;

commit;
