-- 0120_response_peek_playback.sql
-- Explicit public playback metadata for a published Response Peek identity.

create or replace function public.public_response_peek_metadata(p_tour_id uuid)
returns table (
  tour_id uuid,
  parent_type text,
  parent_id uuid,
  playback_storage_path text,
  thumbnail_storage_path text,
  duration_seconds integer,
  width integer,
  height integer,
  published_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    t.id,
    case when t.listing_id is not null then 'listing' else 'service' end,
    coalesce(t.listing_id, t.service_id),
    t.playback_storage_path,
    t.thumbnail_storage_path,
    t.duration_seconds,
    t.width,
    t.height,
    t.published_at
  from public.listing_tours t
  where t.id = p_tour_id
    and t.peek_kind = 'response'
    and t.status = 'published'
    and t.moderation_status = 'approved'
    and t.playback_storage_path is not null
    and t.thumbnail_storage_path is not null
    and private.is_peek_parent_public(t.listing_id, t.service_id)
    and exists (
      select 1
      from public.peek_requests r
      where r.current_response_id = t.id
        and r.status = 'answered'
        and r.moderation_status = 'approved'
        and r.listing_id is not distinct from t.listing_id
        and r.service_id is not distinct from t.service_id
    )
  limit 1;
$function$;

revoke all on function public.public_response_peek_metadata(uuid) from public;
grant execute on function public.public_response_peek_metadata(uuid) to anon, authenticated;

comment on function public.public_response_peek_metadata(uuid) is
  'Returns private-storage metadata only for a currently public approved Response Peek. Signed URLs remain an Edge Function concern.';
