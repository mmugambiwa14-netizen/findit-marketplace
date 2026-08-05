-- 20260804065236_live_conversation_updates.sql
-- Publish message inserts so authenticated participants can refresh an open
-- conversation immediately. Existing RLS remains the authorization boundary.

do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inquiries'
  ) then
    alter publication supabase_realtime add table public.inquiries;
  end if;
end
$migration$;
