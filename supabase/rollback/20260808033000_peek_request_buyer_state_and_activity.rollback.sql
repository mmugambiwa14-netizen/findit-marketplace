-- Roll back browser Peek Request reads to the prior identity without deleting
-- request, supporter, response, or notification data.

drop function if exists public.my_peek_request_activity_page(timestamptz, uuid, integer);
drop function if exists private.my_peek_request_activity_page(timestamptz, uuid, integer);
drop function if exists public.peek_thread_page_v2(uuid, uuid, text, text, integer, timestamptz, uuid, integer);
drop function if exists private.peek_thread_page_v2(uuid, uuid, text, text, integer, timestamptz, uuid, integer);

drop index if exists public.idx_peek_requests_requester_activity;

grant execute on function public.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to anon, authenticated, service_role;
grant execute on function private.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to anon, authenticated, service_role;
