create table if not exists public.account_deletion_receipts (
  user_id uuid primary key references public.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  completed_at timestamptz not null default now(),
  retained_record_notice text not null default 'Certain transaction, safety, moderation, dispute, and audit records are retained in anonymised form.'
);

alter table public.account_deletion_receipts enable row level security;
revoke all on public.account_deletion_receipts from public, anon, authenticated;

create or replace function public.prepare_own_account_deletion(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_super_admin boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if upper(trim(coalesce(p_confirmation, ''))) <> 'DELETE' then raise exception 'Type DELETE to confirm'; end if;

  select role, super_admin into v_role, v_super_admin from public.users where id = v_user_id for update;
  if not found then raise exception 'Account not found'; end if;
  if v_role = 'admin' or coalesce(v_super_admin, false) then raise exception 'Administrator accounts must be transferred before deletion'; end if;

  update public.listings set status = 'unavailable', contact_phone = null, contact_whatsapp = null, contact_email = null, updated_at = now() where seller_id = v_user_id;
  update public.services set status = 'unavailable', contact_phone = null, contact_whatsapp = null, contact_email = null, updated_at = now() where provider_id = v_user_id;
  update public.business_profiles
     set company_name = 'Deleted business', registration_number = null, issuing_body = null,
         phone = null, email = null, website = null, city = null, address = null,
         description = null, avatar_url = null, avatar_storage_path = null,
         social_links = '{}'::jsonb, verified = false, updated_at = now()
   where user_id = v_user_id;

  delete from public.saved_listings where user_id = v_user_id;
  delete from public.follows where follower_id = v_user_id or seller_id = v_user_id;
  delete from public.app_alerts where user_id = v_user_id;
  delete from public.contact_reveal_events where user_id = v_user_id;
  delete from public.user_presence where user_id = v_user_id;
  delete from public.peek_request_supporters where user_id = v_user_id;
  delete from public.web_push_subscriptions where user_id = v_user_id;
  -- Email preferences are introduced after the original account-deletion
  -- migration in some deployed histories. Keep deletion idempotent across a
  -- clean migration and those older hosted databases.
  if to_regclass('public.email_notification_preferences') is not null then
    execute 'delete from public.email_notification_preferences where user_id = $1'
      using v_user_id;
  end if;

  update public.users
     set email = 'deleted-' || replace(v_user_id::text, '-', '') || '@deleted.invalid',
         full_name = 'Deleted user', phone = null, phone_verified = false,
         phone_otp_code = null, phone_otp_pending = null, phone_otp_expires = null,
         bio = null, avatar_url = null, verified = false, verified_at = null,
         verified_full_name = null, status = 'banned', ban_reason = 'Account deleted by user',
         ban_until = null, updated_at = now()
   where id = v_user_id;

  insert into public.account_deletion_receipts(user_id, requested_at, completed_at)
  values (v_user_id, now(), now())
  on conflict (user_id) do update set requested_at = excluded.requested_at, completed_at = excluded.completed_at;

  return jsonb_build_object('deleted', true, 'user_id', v_user_id, 'completed_at', now(), 'retained_records_anonymised', true);
end;
$$;

revoke all on function public.prepare_own_account_deletion(text) from public, anon;
grant execute on function public.prepare_own_account_deletion(text) to authenticated;
