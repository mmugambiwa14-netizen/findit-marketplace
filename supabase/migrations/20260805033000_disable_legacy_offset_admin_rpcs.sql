-- Cursor-based admin RPCs replaced these offset endpoints. Keep the old
-- functions temporarily for migration history, but remove them from the API
-- surface so no new client can depend on them.
revoke execute on function public.admin_audit_rows(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_marketplace_rows(text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_report_rows(text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_support_request_rows(text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_tour_queue(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.admin_user_rows(text, text, text, integer, integer) from public, anon, authenticated;
