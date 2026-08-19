begin;

drop function if exists private.record_public_tour_view_impl(uuid, uuid);

-- Restore the immediately preceding rate-limited implementation.
create or replace function public.record_public_tour_view(p_tour_id uuid, p_viewer_key uuid)
returns table(recorded boolean, view_count bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_viewer_id uuid := auth.uid();
  v_subject text := private.request_abuse_subject(v_viewer_id);
  v_digest text;
  v_server_viewer_key uuid;
  v_inserted_count integer := 0;
begin
  if p_tour_id is null then
    raise exception 'invalid Peek view' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.listing_tours t
    where t.id = p_tour_id
      and t.status = 'ready'
      and t.moderation_status = 'approved'
      and t.deleted_at is null
      and t.removed_at is null
      and t.published_at is not null
      and public.is_tour_public_eligible(t.id)
  ) then
    raise exception 'Peek is unavailable' using errcode = 'P0002';
  end if;

  perform private.require_abuse_rate_limit(
    'peek.view.day', v_subject, 200, 86400,
    'Peek view rate exceeded; try again later', '42900'
  );

  v_digest := md5(v_subject || ':' || p_tour_id::text || ':' || current_date::text);
  v_server_viewer_key := (
    substr(v_digest, 1, 8) || '-' || substr(v_digest, 9, 4) || '-4' ||
    substr(v_digest, 14, 3) || '-8' || substr(v_digest, 18, 3) || '-' ||
    substr(v_digest, 21, 12)
  )::uuid;

  insert into public.tour_view_events(tour_id, viewer_key, viewer_id)
  values (p_tour_id, v_server_viewer_key, v_viewer_id)
  on conflict (tour_id, viewer_key, viewed_on) do nothing;
  get diagnostics v_inserted_count = row_count;

  return query
  select v_inserted_count = 1,
         (select count(*)::bigint
          from public.tour_view_events v
          where v.tour_id = p_tour_id);
end;
$function$;

revoke all on function public.record_public_tour_view(uuid, uuid) from public;
grant execute on function public.record_public_tour_view(uuid, uuid)
  to anon, authenticated;

commit;
