-- Remove only the count-only unread-message projection introduced by
-- 20260808060000. The established inbox/message RPCs remain untouched.

drop function if exists public.message_unread_count();
drop function if exists private.message_unread_count();
