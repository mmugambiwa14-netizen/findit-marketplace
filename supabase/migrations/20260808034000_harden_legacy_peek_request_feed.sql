-- Preserve rollback compatibility for existing Peek Request clients without
-- preserving the weaker legacy privileged implementation.
--
-- The public wrapper keeps its original result shape and permissions, while the
-- private implementation delegates to the v2 feed and deliberately omits the
-- new caller-relative booleans. This restores the explicit public-parent
-- visibility check and answered-response publication checks for old clients.

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
as $function$
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
  from private.peek_thread_page_v2(
    $1, $2, $3, $4, $5, $6, $7, $8
  );
$function$;

revoke all on function private.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function private.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to anon, authenticated, service_role;

revoke all on function public.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to anon, authenticated, service_role;

comment on function private.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer) is
  'Legacy Peek Request feed implementation. Delegates to hardened v2 and omits caller-relative fields.';
