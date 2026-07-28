-- Roll back only the keyset admin read boundary. Legacy offset RPCs and all
-- canonical marketplace, report, Tour, support and audit data remain intact.

drop function if exists public.admin_tour_queue_page(text, text, integer, integer, integer, timestamptz, uuid);
drop function if exists public.admin_audit_rows_page(text, text, integer, timestamptz, uuid);
drop function if exists public.admin_support_request_rows_page(text, text, text, integer, timestamptz, uuid);
drop function if exists public.admin_report_rows_page(text, text, text, integer, timestamptz, uuid);
drop function if exists public.admin_user_rows_page(text, text, text, integer, timestamptz, uuid);
drop function if exists public.admin_marketplace_rows_page(text, text, text, integer, timestamptz, uuid);

drop index if exists public.idx_listing_tours_admin_cursor;
drop index if exists public.idx_support_requests_admin_cursor;
drop index if exists public.idx_audit_logs_admin_cursor;
drop index if exists public.idx_conversation_reports_admin_cursor;
drop index if exists public.idx_reports_admin_cursor;
drop index if exists public.idx_users_admin_cursor;
drop index if exists public.idx_services_admin_cursor;
drop index if exists public.idx_listings_admin_cursor;
