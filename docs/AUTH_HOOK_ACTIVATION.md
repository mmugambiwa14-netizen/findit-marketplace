# PeekaListing Auth Hook Activation

## Purpose

The migration `20260805110000_reject_disposable_signup_emails.sql` installs `public.before_user_created_hook(jsonb)` and restricts execution to `supabase_auth_admin`.

Installing the function does not automatically activate it on a hosted Supabase project. Each hosted environment must enable the Before User Created hook explicitly.

## Local configuration

Add this block to the canonical `supabase/config.toml` when reconciling hosted URLs and PeekaListing email-template names:

```toml
[auth.hook.before_user_created]
enabled = true
uri = "pg-functions://postgres/public/before_user_created_hook"
```

Do not copy the historical `develop` configuration wholesale. It contains legacy deployment URLs and old product naming.

## Hosted staging activation

In the Supabase staging dashboard:

1. Open Authentication settings.
2. Open Auth Hooks.
3. Enable **Before User Created**.
4. Select PostgreSQL function.
5. Set the function URI to `pg-functions://postgres/public/before_user_created_hook`.
6. Save the configuration.

## Verification

After activation, verify all of the following:

- `user@mailinator.com` is rejected before an `auth.users` row is created.
- `user@subdomain.guerrillamail.com` is rejected.
- a normal permanent email is accepted.
- phone-only or OAuth sign-up without an email is not rejected by this hook.
- `anon` and `authenticated` cannot execute the hook directly.
- `anon` and `authenticated` cannot read `public.disposable_email_domains`.

## Rollback

Disable the hosted Before User Created hook before rolling back the migration. Do not leave the Auth service pointing at a removed function.
