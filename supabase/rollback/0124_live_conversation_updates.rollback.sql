-- 0124_live_conversation_updates.rollback.sql
-- Stop realtime delivery for inquiry inserts. This only removes publication
-- membership; it does not delete the inquiries table or any conversation data.

do $rollback$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inquiries'
  ) then
    alter publication supabase_realtime drop table public.inquiries;
  end if;
end
$rollback$;
