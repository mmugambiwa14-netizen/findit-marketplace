-- Make the buyer side of Peek Requests truthful and trackable.
--
-- The active browser moves to peek_thread_page_v2 for caller-relative state.
-- The legacy peek_thread_page identity remains executable for rollback and old
-- clients, but its privileged implementation is hardened to delegate to the
-- same safe v2 boundary. This preserves compatibility without preserving the
-- public-parent visibility regression in the restored Aug-4 implementation.

create index if not exists idx_peek_requests_requester_activity
  on public.peek_requests (requester_id, created_at desc, id desc)
  where status not in ('removed', 'merged');

create or replace function private.peek_thread_page_v2(
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
  requested_by_me boolean,
  supported_by_me boolean,
  created_at timestamptz,
  answered_at timestamptz,
  current_response_id uuid,
  next_supporter_count integer,
  next_created_at timestamptz,
  next_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if ((p_listing_id is not null)::integer + (p_service_id is not null)::integer) <> 1 then
    raise exception 'exactly one Peek Request parent is required' using errcode = '22023';
  end if;
  if p_filter not in ('all', 'answered', 'pending') then
    raise exception 'unsupported Peek Request filter' using errcode = '22023';
  end if;
  if p_sort not in ('most_wanted', 'newest') then
    raise exception 'unsupported Peek Request sort' using errcode = '22023';
  end if;
  if (p_cursor_id is null) <> (p_cursor_created_at is null) then
    raise exception 'incomplete Peek Request cursor' using errcode = '22023';
  end if;
  if p_sort = 'most_wanted'
     and p_cursor_id is not null
     and p_cursor_supporter_count is null then
    raise exception 'incomplete Peek Request demand cursor' using errcode = '22023';
  end if;

  if not private.is_peek_parent_public(p_listing_id, p_service_id) then
    return;
  end if;

  return query
  with eligible as (
    select request.*
    from public.peek_requests request
    where request.listing_id is not distinct from p_listing_id
      and request.service_id is not distinct from p_service_id
      and request.moderation_status = 'approved'
      and request.status in ('pending', 'answered')
      and (p_filter = 'all' or request.status::text = p_filter)
      and (
        request.status <> 'answered'
        or exists (
          select 1
          from public.listing_tours response
          where response.id = request.current_response_id
            and response.peek_kind = 'response'
            and response.status = 'published'
            and response.moderation_status = 'approved'
        )
      )
      and (
        p_cursor_id is null
        or (p_sort = 'newest'
          and (request.created_at, request.id) < (p_cursor_created_at, p_cursor_id))
        or (p_sort = 'most_wanted'
          and (request.supporter_count, request.created_at, request.id)
              < (p_cursor_supporter_count, p_cursor_created_at, p_cursor_id))
      )
  ),
  page as (
    select eligible.*
    from eligible
    order by
      case when p_sort = 'most_wanted' then eligible.supporter_count end desc,
      eligible.created_at desc,
      eligible.id desc
    limit v_limit + 1
  ),
  visible as (
    select page.*
    from page
    order by
      case when p_sort = 'most_wanted' then page.supporter_count end desc,
      page.created_at desc,
      page.id desc
    limit v_limit
  ),
  cursor_row as (
    select page.supporter_count, page.created_at, page.id
    from page
    order by
      case when p_sort = 'most_wanted' then page.supporter_count end desc,
      page.created_at desc,
      page.id desc
    offset v_limit
    limit 1
  )
  select
    visible.id,
    visible.listing_id,
    visible.service_id,
    visible.category,
    visible.body,
    visible.status,
    visible.supporter_count,
    'a buyer'::text,
    auth.uid() is not null and visible.requester_id = auth.uid(),
    auth.uid() is not null and exists (
      select 1
      from public.peek_request_supporters supporter
      where supporter.request_id = visible.id
        and supporter.user_id = auth.uid()
    ),
    visible.created_at,
    visible.answered_at,
    visible.current_response_id,
    cursor_row.supporter_count,
    cursor_row.created_at,
    cursor_row.id
  from visible
  left join cursor_row on true
  order by
    case when p_sort = 'most_wanted' then visible.supporter_count end desc,
    visible.created_at desc,
    visible.id desc;
end;
$function$;

revoke all on function private.peek_thread_page_v2(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.peek_thread_page_v2(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to anon, authenticated, service_role;

create or replace function public.peek_thread_page_v2(
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
  requested_by_me boolean,
  supported_by_me boolean,
  created_at timestamptz,
  answered_at timestamptz,
  current_response_id uuid,
  next_supporter_count integer,
  next_created_at timestamptz,
  next_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $wrapper$
  select * from private.peek_thread_page_v2($1, $2, $3, $4, $5, $6, $7, $8);
$wrapper$;

revoke all on function public.peek_thread_page_v2(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.peek_thread_page_v2(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to anon, authenticated, service_role;

comment on function public.peek_thread_page_v2(uuid, uuid, text, text, integer, timestamptz, uuid, integer) is
  'Privacy-safe bounded Peek Request feed with caller-relative request/support state.';

-- Keep the historical RPC safe for older clients. Its output stays unchanged;
-- it simply drops the two v2 caller-state columns.
create or replace function private.peek_thread_page(
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
  next_supporter_count integer,
  next_created_at timestamptz,
  next_id uuid
)
language sql
stable
security definer
set search_path = ''
as $legacy$
  select
    request_id,
    listing_id,
    service_id,
    category,
    body,
    status,
    supporter_count,
    requested_by_label,
    created_at,
    answered_at,
    current_response_id,
    next_supporter_count,
    next_created_at,
    next_id
  from private.peek_thread_page_v2($1, $2, $3, $4, $5, $6, $7, $8);
$legacy$;

revoke all on function private.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to anon, authenticated, service_role;
grant execute on function public.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to anon, authenticated, service_role;

-- Buyer activity ------------------------------------------------------------
-- Requested and supported requests share one bounded newest-first feed. The
-- requester's identity is never returned; the only relationship fields describe
-- the authenticated caller. Merged sources are hidden because their supporters
-- are copied to the surviving target during merge.

create or replace function private.my_peek_request_activity_page(
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  request_id uuid,
  parent_type text,
  parent_id uuid,
  parent_kind text,
  parent_title text,
  parent_public boolean,
  category public.peek_request_category,
  body text,
  status public.peek_request_status,
  supporter_count integer,
  requested_by_me boolean,
  supported_by_me boolean,
  decline_reason text,
  created_at timestamptz,
  answered_at timestamptz,
  current_response_id uuid,
  next_created_at timestamptz,
  next_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if v_user is null then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;
  if (p_cursor_id is null) <> (p_cursor_created_at is null) then
    raise exception 'incomplete Peek Request activity cursor' using errcode = '22023';
  end if;

  return query
  with related_ids as (
    select request.id, request.created_at
    from public.peek_requests request
    where request.requester_id = v_user
      and request.status not in ('removed', 'merged')

    union

    select request.id, request.created_at
    from public.peek_request_supporters supporter
    join public.peek_requests request on request.id = supporter.request_id
    where supporter.user_id = v_user
      and request.status not in ('removed', 'merged')
  ),
  eligible as (
    select related.id, related.created_at
    from related_ids related
    where p_cursor_id is null
       or (related.created_at, related.id) < (p_cursor_created_at, p_cursor_id)
    order by related.created_at desc, related.id desc
    limit v_limit + 1
  ),
  visible as (
    select eligible.id, eligible.created_at
    from eligible
    order by eligible.created_at desc, eligible.id desc
    limit v_limit
  ),
  cursor_row as (
    select eligible.created_at, eligible.id
    from eligible
    order by eligible.created_at desc, eligible.id desc
    offset v_limit
    limit 1
  )
  select
    request.id,
    case when request.listing_id is not null then 'listing'::text else 'service'::text end,
    coalesce(request.listing_id, request.service_id),
    case when request.listing_id is not null then listing.kind::text else 'service'::text end,
    coalesce(listing.title, service.title, 'Unavailable listing'::text),
    private.is_peek_parent_public(request.listing_id, request.service_id),
    request.category,
    request.body,
    request.status,
    request.supporter_count,
    request.requester_id = v_user,
    exists (
      select 1
      from public.peek_request_supporters supporter
      where supporter.request_id = request.id
        and supporter.user_id = v_user
    ),
    case when request.status = 'declined' then request.decline_reason else null end,
    request.created_at,
    request.answered_at,
    case
      when request.status = 'answered'
       and exists (
         select 1
         from public.listing_tours response
         where response.id = request.current_response_id
           and response.peek_kind = 'response'
           and response.status = 'published'
           and response.moderation_status = 'approved'
       )
      then request.current_response_id
      else null
    end,
    cursor_row.created_at,
    cursor_row.id
  from visible
  join public.peek_requests request on request.id = visible.id
  left join public.listings listing on listing.id = request.listing_id
  left join public.services service on service.id = request.service_id
  left join cursor_row on true
  order by request.created_at desc, request.id desc;
end;
$function$;

revoke all on function private.my_peek_request_activity_page(timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.my_peek_request_activity_page(timestamptz, uuid, integer)
  to authenticated, service_role;

create or replace function public.my_peek_request_activity_page(
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  request_id uuid,
  parent_type text,
  parent_id uuid,
  parent_kind text,
  parent_title text,
  parent_public boolean,
  category public.peek_request_category,
  body text,
  status public.peek_request_status,
  supporter_count integer,
  requested_by_me boolean,
  supported_by_me boolean,
  decline_reason text,
  created_at timestamptz,
  answered_at timestamptz,
  current_response_id uuid,
  next_created_at timestamptz,
  next_id uuid
)
language sql
stable
security invoker
set search_path = ''
as $wrapper$
  select * from private.my_peek_request_activity_page($1, $2, $3);
$wrapper$;

revoke all on function public.my_peek_request_activity_page(timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.my_peek_request_activity_page(timestamptz, uuid, integer)
  to authenticated, service_role;

comment on function public.my_peek_request_activity_page(timestamptz, uuid, integer) is
  'Authenticated bounded feed of Peek Requests the caller created or supports.';
