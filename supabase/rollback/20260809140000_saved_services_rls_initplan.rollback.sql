-- Roll back only the predicate optimization; keep the saved-services table
-- and user data intact.

begin;

drop policy if exists saved_services_owner_read on public.saved_services;
create policy saved_services_owner_read
  on public.saved_services
  for select
  to authenticated
  using (public.is_active_user() and user_id = auth.uid());

drop policy if exists saved_services_owner_insert on public.saved_services;
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

drop policy if exists saved_services_owner_delete on public.saved_services;
create policy saved_services_owner_delete
  on public.saved_services
  for delete
  to authenticated
  using (public.is_active_user() and user_id = auth.uid());

commit;
