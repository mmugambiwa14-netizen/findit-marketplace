-- Roll back live conversation insert delivery.

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
