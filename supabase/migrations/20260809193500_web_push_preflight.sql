begin;

-- The repository already had a bounded subscription client before full delivery
-- was introduced. Normalize that partial installation so the following
-- production migration is safe both on fresh and previously staged databases.
create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  active boolean not null default true,
  failure_count integer not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.web_push_subscriptions
  add column if not exists active boolean not null default true,
  add column if not exists failure_count integer not null default 0,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_failure_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists web_push_subscriptions_endpoint_uidx
  on public.web_push_subscriptions(endpoint);

-- Remove any earlier policy names so the canonical policies can be recreated by
-- the next migration without duplicate-object failures.
drop policy if exists web_push_subscriptions_own_select on public.web_push_subscriptions;
drop policy if exists web_push_subscriptions_own_insert on public.web_push_subscriptions;
drop policy if exists web_push_subscriptions_own_update on public.web_push_subscriptions;
drop policy if exists web_push_subscriptions_own_delete on public.web_push_subscriptions;

commit;
