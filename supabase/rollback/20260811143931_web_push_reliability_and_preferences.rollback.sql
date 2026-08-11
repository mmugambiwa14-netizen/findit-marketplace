-- Data-preserving rollback capsule for
-- 20260811143931_web_push_reliability_and_preferences.sql.
--
-- The migration adds delivery state and user preferences to an already-used
-- push schema.  Dropping those tables would destroy device registrations and
-- delivery history, so this capsule disables the new producers/worker RPCs
-- while retaining the additive data.  Re-enable the migration by replaying
-- the forward migration after the rollback has been reviewed.

begin;

drop trigger if exists inquiries_notify_recipient on public.inquiries;
drop function if exists public.notify_new_inquiry();

drop trigger if exists app_alerts_enqueue_web_push on public.app_alerts;

revoke all on function public.refresh_web_push_delivery_job(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_web_push_delivery_attempts(integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.complete_web_push_delivery_attempt(bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.fail_web_push_delivery_attempt(bigint, uuid, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.retire_web_push_subscription(uuid, text)
  from public, anon, authenticated, service_role;

comment on table public.web_push_delivery_attempts is
  'Retained by the 20260811143931 rollback capsule for data preservation; worker delivery is disabled until the forward migration is reapplied.';

commit;
