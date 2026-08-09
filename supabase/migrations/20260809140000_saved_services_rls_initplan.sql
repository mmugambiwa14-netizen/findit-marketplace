-- Initialize auth.uid() once per statement for the saved-services policies.
-- This preserves the existing owner predicates while keeping the catalogue
-- save path consistent with the rest of the optimized public RLS surface.

begin;

drop policy if exists saved_services_owner_read on public.saved_services;
create policy saved_services_owner_read
  on public.saved_services
  for select
  to authenticated
  using (public.is_active_user() and user_id = (select auth.uid()));

drop policy if exists saved_services_owner_insert on public.saved_services;
create policy saved_services_owner_insert
  on public.saved_services
  for insert
  to authenticated
  with check (
    public.is_active_user()
    and user_id = (select auth.uid())
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
  using (public.is_active_user() and user_id = (select auth.uid()));

commit;
