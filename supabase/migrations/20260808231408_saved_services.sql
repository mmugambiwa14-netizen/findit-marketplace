-- Saved service catalogue items.
--
-- Services are a separate catalogue from listings, so they cannot use the
-- listing-only saved_listings table. Keep this boundary explicit and apply
-- the same owner-only/RLS guarantees as saved listings.

begin;

create table public.saved_services (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, service_id)
);

create index idx_saved_services_user_keyset
  on public.saved_services(user_id, created_at desc, id desc);

alter table public.saved_services enable row level security;

revoke all on table public.saved_services from anon;
grant select, insert, delete on table public.saved_services to authenticated;

create policy saved_services_owner_read
  on public.saved_services
  for select
  to authenticated
  using (public.is_active_user() and user_id = auth.uid());

create policy saved_services_owner_insert
  on public.saved_services
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.services
      where public.services.id = saved_services.service_id
        and public.services.status = 'active'
        and public.services.category <> 'legal'
    )
  );

create policy saved_services_owner_delete
  on public.saved_services
  for delete
  to authenticated
  using (public.is_active_user() and user_id = auth.uid());

commit;
