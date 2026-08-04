-- 0121_seller_peek_request_queue.sql
-- Seller-wide Buyer Peek Requests queue with bounded keyset pagination.

create or replace function public.seller_peek_request_queue(
  p_cursor_score bigint default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  request_id uuid,
  listing_id uuid,
  service_id uuid,
  parent_type text,
  parent_kind text,
  parent_title text,
  category public.peek_request_category,
  body text,
  supporter_count integer,
  created_at timestamptz,
  pending_seconds bigint,
  queue_score bigint,
  next_score bigint,
  next_created_at timestamptz,
  next_id uuid
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_owner uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_now timestamptz := statement_timestamp();
begin
  if v_owner is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
  with owned as (
    select
      r.id,
      r.listing_id,
      r.service_id,
      case when r.listing_id is not null then 'listing' else 'service' end::text as parent_type,
      coalesce(l.kind::text, 'service') as parent_kind,
      coalesce(l.title, s.title) as parent_title,
      r.category,
      r.body,
      r.supporter_count,
      r.created_at,
      greatest(0, extract(epoch from (v_now - r.created_at))::bigint) as pending_seconds,
      (
        greatest(r.supporter_count, 1)::bigint * 1000000
        + least(greatest(0, extract(epoch from (v_now - r.created_at))::bigint), 2592000)
      )::bigint as queue_score
    from public.peek_requests r
    left join public.listings l on l.id = r.listing_id
    left join public.services s on s.id = r.service_id
    where r.status = 'pending'
      and r.moderation_status = 'approved'
      and r.merged_into_id is null
      and (
        (r.listing_id is not null and l.seller_id = v_owner and l.status in ('available', 'under_offer', 'paused'))
        or (r.service_id is not null and s.provider_id = v_owner and s.status = 'active')
      )
  ),
  eligible as (
    select * from owned o
    where p_cursor_id is null
       or o.queue_score < p_cursor_score
       or (o.queue_score = p_cursor_score and o.created_at > p_cursor_created_at)
       or (o.queue_score = p_cursor_score and o.created_at = p_cursor_created_at and o.id > p_cursor_id)
  ),
  page as (
    select * from eligible
    order by queue_score desc, created_at asc, id asc
    limit v_limit + 1
  ),
  visible as (
    select * from page
    order by queue_score desc, created_at asc, id asc
    limit v_limit
  ),
  cursor_row as (
    select queue_score, created_at, id from page
    order by queue_score desc, created_at asc, id asc
    offset v_limit limit 1
  )
  select
    v.id, v.listing_id, v.service_id, v.parent_type, v.parent_kind, v.parent_title,
    v.category, v.body, v.supporter_count, v.created_at, v.pending_seconds, v.queue_score,
    c.queue_score, c.created_at, c.id
  from visible v
  left join cursor_row c on true
  order by v.queue_score desc, v.created_at asc, v.id asc;
end;
$function$;

revoke all on function public.seller_peek_request_queue(bigint, timestamptz, uuid, integer) from public, anon;
grant execute on function public.seller_peek_request_queue(bigint, timestamptz, uuid, integer) to authenticated;

comment on function public.seller_peek_request_queue(bigint, timestamptz, uuid, integer) is
  'Owner-scoped pending Buyer Peek Requests ranked by supporter demand and waiting age, with bounded keyset pagination.';
