-- 0002_users.sql
-- Replaces: Base44-hosted User entity + Base44 auth.
-- public.users extends auth.users (Supabase Auth) 1:1 via shared id, and holds
-- every custom profile field the app already relies on (bio, verification,
-- phone OTP, ban state, etc). Nothing here changes what fields the app can read
-- -- it's the same User shape, just relational instead of Base44-hosted.

create table public.users (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text not null unique,
  full_name             text,
  role                  text not null default 'user' check (role in ('user', 'admin')),

  phone                 text,
  phone_verified        boolean not null default false,
  phone_otp_code        text,
  phone_otp_pending     text,
  phone_otp_expires     timestamptz,

  bio                   text,
  avatar_url            text,

  verified              boolean not null default false,
  verified_at           timestamptz,
  verified_full_name    text,

  super_admin           boolean not null default false,
  status                user_status not null default 'active',
  ban_reason            text,
  ban_until             timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_users_role on public.users(role);
create index idx_users_status on public.users(status);

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function set_updated_at();

-- Auto-create a public.users row whenever a new auth.users row is created,
-- mirroring Base44's "every authenticated user gets a User entity" behaviour.
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- AdminTeam — used to group support agents / admin permissions
-- ---------------------------------------------------------------------------
create table public.admin_teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  members      jsonb not null default '[]', -- array of user ids; kept simple to match original shape
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_admin_teams_updated_at
  before update on public.admin_teams
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- UserPresence — lightweight online/offline tracking
-- ---------------------------------------------------------------------------
create table public.user_presence (
  user_id      uuid primary key references public.users(id) on delete cascade,
  last_seen    timestamptz not null default now(),
  is_online    boolean not null default false
);

-- ---------------------------------------------------------------------------
-- AuditLog — every admin action, for accountability (see MIGRATION.md security notes)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id                  uuid primary key default gen_random_uuid(),
  admin_user_id       uuid not null references public.users(id),
  action_performed    text not null,
  target_record_id    text,
  target_record_type  text,
  ip_address          inet,
  before_values        jsonb,
  after_values         jsonb,
  created_at          timestamptz not null default now()
);

create index idx_audit_logs_admin on public.audit_logs(admin_user_id, created_at desc);
create index idx_audit_logs_target on public.audit_logs(target_record_type, target_record_id);
