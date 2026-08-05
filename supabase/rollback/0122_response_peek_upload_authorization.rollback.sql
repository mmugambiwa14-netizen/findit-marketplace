-- 0122_response_peek_upload_authorization.rollback.sql
-- Disable new Response Peek uploads without deleting media, requests, events,
-- or already-approved Response Peeks. The promotion function remains backward
-- compatible for Main Peeks and harmless for Response Peeks once authorization
-- is unavailable.

revoke all on function public.authorize_response_peek_upload(
  uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid
) from public;

drop function if exists public.authorize_response_peek_upload(
  uuid, uuid, uuid, uuid, text, text, text, bigint, numeric, text, uuid
);
