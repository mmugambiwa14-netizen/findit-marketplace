begin;

-- Older staging deployments created three narrower policies before the
-- canonical owner policy was introduced. Remove those duplicates so RLS does
-- not evaluate multiple permissive policies for the same operation.
drop policy if exists email_preferences_owner_insert
  on public.email_notification_preferences;
drop policy if exists email_preferences_owner_select
  on public.email_notification_preferences;
drop policy if exists email_preferences_owner_update
  on public.email_notification_preferences;

commit;
