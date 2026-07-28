-- 0012_capture_phone_on_signup.sql
-- Phase 2B. Additive only -- does not alter 0002_users.sql, per the
-- migration principle "only remove/change code confidently classified as
-- safe; prefer additive changes" (see ../../MIGRATION.md principle #5).
--
-- Register.jsx (Phase 2B) collects a phone number at signup and passes it
-- as auth.users.raw_user_meta_data.phone via supabase.auth.signUp({ options:
-- { data: { phone } } }). The existing handle_new_auth_user() trigger from
-- 0002 only copied full_name into public.users -- this replaces that
-- function (same trigger, no new trigger needed) to also copy phone.
--
-- Note: this does NOT set phone_verified -- that stays false until the
-- separate RequirePhoneVerification OTP flow (unrelated to this migration,
-- unchanged) confirms it.

create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
