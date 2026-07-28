# Google and Apple OAuth Setup

Reviewed: 2026-07-26

OAuth buttons are controlled independently from Supabase provider
configuration:

- `VITE_AUTH_GOOGLE_ENABLED`
- `VITE_AUTH_APPLE_ENABLED`

Both default to `false`. A provider button must remain hidden until the
corresponding Supabase provider is enabled and a complete browser callback test
passes.

## Current staging status

- **Google:** enabled in hosted Supabase and enabled for future hosted frontend
  builds. The Google Cloud web client uses the exact Supabase callback URL. The
  owner account is registered as a test user, and a real consent/callback run
  created one Supabase Auth user whose provider is `google`.
- **Apple:** intentionally disabled and hidden at the owner's request. Apple
  Developer Program enrollment and Apple provider credentials have not been
  configured.
- The Google consent screen is still in **Testing**. Only registered test users
  can sign in until the app has a public HTTPS frontend, accurate public
  branding/privacy links, and the Google consent screen is published.

## Shared staging values

- Supabase project: `bwgklpxoetrrkutottdb`
- Supabase callback URL:
  `https://bwgklpxoetrrkutottdb.supabase.co/auth/v1/callback`
- Application redirect URLs must also appear in Supabase Auth's redirect allow
  list. Use the final HTTPS frontend origin and its deployment base path.

Never place a Google client secret, Apple signing key, Apple-generated client
secret or Supabase service credential in a `VITE_` variable, repository,
GitHub variable or browser build.

## Google

1. Sign in to Google Cloud and select or create the FindIt project.
2. Configure Google Auth Platform branding and audience.
3. Request only `openid`, email and profile scopes.
4. Create an OAuth client with application type **Web application**.
5. Add the final frontend origin under Authorized JavaScript origins.
6. Add the exact Supabase callback URL above under Authorized redirect URIs.
7. Copy the client ID and client secret into Supabase Auth → Providers →
   Google, then enable the provider.
8. Verify the hosted provider setting:

   ```powershell
   $env:FINDIT_EXPECT_GOOGLE_OAUTH='true'
   npm run verify:oauth-providers
   ```

9. Complete new-user, returning-user, cancelled-consent and suspended-account
   browser tests.
10. Only then set `VITE_AUTH_GOOGLE_ENABLED=true` in the frontend host.

## Apple

Apple web OAuth requires an active Apple Developer Program team and a primary
App ID enabled for Sign in with Apple.

1. Create or select the primary App ID.
2. Create a Services ID for FindIt and enable Sign in with Apple.
3. Associate it with the primary App ID.
4. Register the final frontend domain and the exact Supabase callback URL.
5. Create a Sign in with Apple private key and securely download the `.p8`
   file. Record its Key ID and the Apple Team ID.
6. Generate the Apple client secret for the Services ID. Store the `.p8` key
   outside the repository.
7. Enter the Services ID and generated secret in Supabase Auth → Providers →
   Apple, then enable the provider.
8. Verify the hosted provider setting:

   ```powershell
   $env:FINDIT_EXPECT_APPLE_OAUTH='true'
   npm run verify:oauth-providers
   ```

9. Complete new-user, returning-user, Hide My Email,
   cancelled-consent and suspended-account browser tests.
10. Only then set `VITE_AUTH_APPLE_ENABLED=true` in the frontend host.

Apple web client secrets expire and must be regenerated at least every six
months. Store the `.p8` key securely, assign an owner and calendar a rotation
well before expiry.

## Release checks

For each enabled provider:

- Supabase `/auth/v1/settings` reports the provider enabled.
- Login and Register show exactly the enabled buttons.
- Provider consent returns to an allowed HTTPS application URL.
- A Supabase session is established.
- The `public.users` profile trigger creates or resolves one profile.
- A returning login resolves the same account.
- Logout clears the session.
- A suspended account cannot use protected marketplace operations.
- No provider token, client secret or signing key appears in the generated
  frontend assets.
