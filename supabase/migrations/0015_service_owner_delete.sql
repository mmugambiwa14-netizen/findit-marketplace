-- Phase 3 V1 service management completion.
-- Owners may delete only their own services while active; admins retain the
-- same trusted operational access used by the existing update policy.

drop policy if exists "services_owner_delete" on public.services;

create policy "services_owner_delete" on public.services
  for delete using (
    public.is_active_user() and (provider_id = auth.uid() or public.is_admin())
  );
