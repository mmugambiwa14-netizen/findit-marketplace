# PeekaListing MFA Activation

The repository contains opt-in authenticator-app MFA, but the provider capability must remain disabled in production until the hosted Supabase project is configured and the complete enrollment/challenge flow is certified.

## Hosted activation

In Supabase Dashboard:

1. Open **Authentication → Multi-Factor Authentication**.
2. Enable **TOTP enrollment**.
3. Enable **TOTP verification**.
4. Keep phone and WebAuthn factors disabled unless separately implemented and tested.
5. Confirm the project permits at least one enrolled factor per user.

## Certification

Using a disposable staging account:

1. Sign in normally.
2. Open **Settings → Account security**.
3. Start enrollment.
4. Scan the QR code with an authenticator app.
5. Confirm enrollment with a valid six-digit code.
6. Sign out globally.
7. Sign back in using password and verify the application blocks all routes until the TOTP code succeeds.
8. Repeat with Google sign-in if Google OAuth is enabled.
9. Confirm an invalid code does not release the application.
10. Confirm sign-out remains available from the challenge screen.
11. Confirm the password-recovery route remains reachable through a valid recovery link.
12. Remove the factor in Settings and confirm later sessions no longer request a second factor.

## Rollback

If hosted MFA becomes unhealthy:

1. Do not remove the application gate first; that could let enrolled accounts bypass their expected second factor.
2. Restore provider availability or instruct affected users through a controlled account-recovery process.
3. Disable new enrollment only after existing enrolled-account recovery has been addressed.
4. Record the incident and affected factor IDs before any administrative factor removal.

MFA should not be advertised as available until the hosted certification above passes.
