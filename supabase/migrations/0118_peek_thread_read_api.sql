-- 0118_peek_thread_read_api.sql
-- Peek Threads phase 3: bounded public thread retrieval.
--
-- This is a read model over peek_requests + the existing listing_tours table.
-- It does not introduce a second video entity or mint playback URLs. Playback
-- continues through tour-playback-access after an explicit user action.

create or replace function public.peek_thread_page(
  p_listing_id uuid default null,
  p_service_id uuid default null,
  p_filter text default 'all',
  p_sort text default 'most_wanted',
  p_cursor_supporter_count integer default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  request_id uuid,
  listing_id uuid,
  service_id uuid,
  category public.peek_request_category,
  body text,
  status public.peek_request_status,
  supporter_count integer,
  requested_by_label text,
  created_at timestamptz,
  answered_at timestamptz,
  current_response_id uuid,
  response_captured_at timestamptz,
  response_duration_seconds integer,
  response_thumbnail_path text,
  next_supporter_count integer,
  next_created_at timestamptz,
  next_id uuid
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if ((p_listing_id is not null)::integer + (p_service_id is not null)::integer) <> 1 then
    raise exception 'exactly one Peek Thread parent is required' using errcode = '22023';
  end if;

  if p_filter not in ('all', 'answered', 'pending') then
    raise exception 'unsupported Peek Thread filter' using errcode = '22023';
  end if;

  if p_sort not in ('most_wanted', 'newest') then
    raise exception 'unsupported Peek Thread sort' using errcode = '22023';
  end if;

  if not private.is_peek_parent_public(p_listing_id, p_service_id) then
    return;
  end if;

  return query
  with eligible as (
    select
      r.id,
      r.listing_id,
      r.service_id,
      r.category,
      r.body,
      r.status,
      r.supporter_count,
      r.created_at,
      r.answered_at,
      r.current_response_id,
      t.created_at as response_captured_at,
      t.duration_seconds as response_duration_seconds,
      t.thumbnail_path as response_thumbnail_path
    from public.peek_requests r
    left join public.listing_tours t
      on t.id = r.current_response_id
     and t.peek_kind = 'response'
     and t.status = 'published'
     and t.moderation_status = 'approved'
    where r.listing_id is not distinct from p_listing_id
      and r.service_id is not distinct from p_service_id
      and r.moderation_status = 'approved'
      and r.status in ('pending', 'answered')
      and (
        p_filter = 'all'
        or (p_filter = 'answered' and r.status = 'answered')
        or (p_filter = 'pending' and r.status = 'pending')
      )
      -- An answered request is not publicly useful unless its current Response
      -- Peek is still published and approved. Never downgrade it to pending;
      -- simply hide it until moderation or processing restores the evidence.
      and (r.status <> 'answered' or t.id is not null)
      and (
        p_cursor_id is null
        or (
          p_sort = 'newest'
          and (r.created_at, r.id) < (p_cursor_created_at, p_cursor_id)
        )
        or (
          p_sort = 'most_wanted'
          and (r.supporter_count, r.created_at, r.id)
              < (p_cursor_supporter_count, p_cursor_created_at, p_cursor_id)
        )
      )
  ),
  page as (
    select e.*
    from eligible e
    order by
      case when p_sort = 'most_wanted' then e.supporter_count end desc,
      e.created_at desc,
      e.id desc
    limit v_limit + 1
  ),
  visible as (
    select p.*
    from page p
    order by
      case when p_sort = 'most_wanted' then p.supporter_count end desc,
      p.created_at desc,
      p.id desc
    limit v_limit
  ),
  cursor_row as (
    select p.supporter_count, p.created_at, p.id
    from page p
    order by
      case when p_sort = 'most_wanted' then p.supporter_count end desc,
      p.created_at desc,
      p.id desc
    offset v_limit
    limit 1
  )
  select
    v.id,
    v.listing_id,
    v.service_id,
    v.category,
    v.body,
    v.status,
    v.supporter_count,
    'a buyer'::text,
    v.created_at,
    v.answered_at,
    v.current_response_id,
    v.response_captured_at,
    v.response_duration_seconds,
    v.response_thumbnail_path,
    c.supporter_count,
    c.created_at,
    c.id
  from visible v
  left join cursor_row c on true
  order by
    case when p_sort = 'most_wanted' then v.supporter_count end desc,
    v.created_at desc,
    v.id desc;
end;
$function$;

revoke all on function public.peek_thread_page(
  uuid, uuid, text, text, integer, timestamptz, uuid, integer
) from public;

grant execute on function public.peek_thread_page(
  uuid, uuid, text, text, integer, timestamptz, uuid, integer
) to anon, authenticated;

comment on function public.peek_thread_page(
  uuid, uuid, text, text, integer, timestamptz, uuid, integer
) is
  'Bounded public Peek Thread page. Returns request metadata and Response Peek identity only; playback remains explicit and separately authorized.';
