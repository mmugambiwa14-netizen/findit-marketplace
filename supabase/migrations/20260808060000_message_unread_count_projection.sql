-- Lightweight unread-message count for the global navigation badge.
--
-- The full inbox projection joins listings, users, latest messages and eligible
-- Peeks. The global badge needs none of those fields, so keep its hot polling
-- path on the conversations table and the existing participant inbox indexes.

create or replace function private.message_unread_count()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  unread_total bigint;
begin
  if current_user_id is null or not public.is_active_user() then
    raise exception 'active account required' using errcode = '42501';
  end if;

  select count(*)::bigint
  into unread_total
  from (
    select conversation.id
    from public.conversations conversation
    where conversation.buyer_id = current_user_id
      and conversation.last_message_sender_id is not null
      and conversation.last_message_sender_id <> current_user_id
      and coalesce(conversation.last_message_at, conversation.created_at) > coalesce(
        conversation.buyer_last_seen_at,
        '-infinity'::timestamptz
      )

    union all

    select conversation.id
    from public.conversations conversation
    where conversation.seller_id = current_user_id
      and conversation.last_message_sender_id is not null
      and conversation.last_message_sender_id <> current_user_id
      and coalesce(conversation.last_message_at, conversation.created_at) > coalesce(
        conversation.seller_last_seen_at,
        '-infinity'::timestamptz
      )
  ) unread_conversations;

  return coalesce(unread_total, 0);
end;
$$;

revoke all on function private.message_unread_count() from public, anon, authenticated, service_role;
grant execute on function private.message_unread_count() to authenticated, service_role;

create or replace function public.message_unread_count()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select private.message_unread_count();
$$;

revoke all on function public.message_unread_count() from public, anon, authenticated, service_role;
grant execute on function public.message_unread_count() to authenticated, service_role;
comment on function public.message_unread_count() is 'findit:20260808060000-authenticated-boundary';
