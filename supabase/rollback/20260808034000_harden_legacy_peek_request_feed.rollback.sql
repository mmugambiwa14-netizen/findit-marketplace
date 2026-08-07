-- Roll back only the compatibility grant introduced by
-- 20260808034000_harden_legacy_peek_request_feed.sql.
-- The preceding v2 migration remains the authority for the hardened browser
-- feed and keeps the legacy implementation service-role only.

revoke execute on function public.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  from anon, authenticated;
revoke execute on function private.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  from anon, authenticated;

grant execute on function public.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to service_role;
grant execute on function private.peek_thread_page(uuid, uuid, text, text, integer, timestamptz, uuid, integer)
  to service_role;
