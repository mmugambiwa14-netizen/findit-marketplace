-- 0119_peek_thread_write_api.rollback.sql

drop function if exists public.bind_response_peek(uuid, uuid[]);
drop function if exists public.merge_peek_request(uuid, uuid);
drop function if exists public.decline_peek_request(uuid, text);
drop function if exists public.withdraw_peek_request_support(uuid);
drop function if exists public.support_peek_request(uuid);
drop function if exists public.create_peek_request(uuid, uuid, public.peek_request_category, text);
drop function if exists private.assert_peek_parent_owner(uuid, uuid, uuid);
