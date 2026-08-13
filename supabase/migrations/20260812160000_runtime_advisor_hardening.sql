begin;

-- Cover the remaining high-write business-review foreign key.
create index if not exists business_applications_reviewed_by_idx
  on public.business_applications (reviewed_by);

-- Initialize both auth helpers once per statement instead of once per row.
drop policy if exists saved_services_owner_read on public.saved_services;
create policy saved_services_owner_read
  on public.saved_services
  for select to authenticated
  using ((select public.is_active_user()) and user_id = (select auth.uid()));

drop policy if exists saved_services_owner_insert on public.saved_services;
create policy saved_services_owner_insert
  on public.saved_services
  for insert to authenticated
  with check (
    (select public.is_active_user())
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
  for delete to authenticated
  using ((select public.is_active_user()) and user_id = (select auth.uid()));

-- Older staging history briefly exposed these obsolete preference RPCs. The
-- active client uses get/update_notification_preferences instead. Revoke only
-- when the legacy signatures exist so clean installs remain portable.
do $migration$
begin
  if to_regprocedure('public.get_web_push_notification_preferences()') is not null then
    execute 'revoke all on function public.get_web_push_notification_preferences() from public, anon, authenticated, service_role';
  end if;
  if to_regprocedure('public.update_web_push_notification_preferences(boolean, boolean, boolean, boolean, boolean)') is not null then
    execute 'revoke all on function public.update_web_push_notification_preferences(boolean, boolean, boolean, boolean, boolean) from public, anon, authenticated, service_role';
  end if;
end;
$migration$;

commit;
