begin;

-- Safely converge earlier/partial Web Push installations onto the production
-- subscription shape without dropping existing endpoints.
alter table public.web_push_subscriptions
  add column if not exists active boolean not null default true,
  add column if not exists failure_count integer not null default 0,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_failure_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.web_push_subscriptions enable row level security;

drop policy if exists web_push_subscriptions_own_select on public.web_push_subscriptions;
drop policy if exists web_push_subscriptions_own_insert on public.web_push_subscriptions;
drop policy if exists web_push_subscriptions_own_update on public.web_push_subscriptions;
drop policy if exists web_push_subscriptions_own_delete on public.web_push_subscriptions;

create policy web_push_subscriptions_own_select
  on public.web_push_subscriptions for select to authenticated using (user_id=auth.uid());
create policy web_push_subscriptions_own_insert
  on public.web_push_subscriptions for insert to authenticated with check (user_id=auth.uid());
create policy web_push_subscriptions_own_update
  on public.web_push_subscriptions for update to authenticated
  using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy web_push_subscriptions_own_delete
  on public.web_push_subscriptions for delete to authenticated using (user_id=auth.uid());

-- The foreground listener consumes the same canonical notification rows. Add
-- the table to Supabase Realtime once, preserving any existing publication.
do $publication$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime' and schemaname='public' and tablename='notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$publication$;

commit;
