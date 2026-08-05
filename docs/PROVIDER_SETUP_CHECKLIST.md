# FindIt Owner Provider Setup Checklist

Never place passwords, private keys, recovery codes or management tokens in this file or in GitHub issues.

## 1. Domain and DNS

- [ ] Purchase/confirm the final FindIt domain.
- [ ] Enable registrar account MFA and domain lock.
- [ ] Create production and staging DNS names.
- [ ] Attach the production domain to Vercel.
- [ ] Verify TLS, HSTS, CSP, SPA deep links and recovery links.
- [ ] Add the exact production origin to Supabase Auth redirects, OAuth callbacks and MapTiler restrictions.

## 2. Business email

Recommended: Google Workspace. Alternative: Microsoft 365.

- [ ] Create one administrator mailbox.
- [ ] Enforce MFA and save recovery codes offline.
- [ ] Add aliases/groups: support, privacy, legal, security, partnerships and finance.
- [ ] Disable legacy mail protocols.
- [ ] Review forwarding and administrator accounts.

## 3. Transactional email

Recommended: Postmark. Alternatives: Resend or Amazon SES.

- [ ] Create a dedicated sending identity/subdomain.
- [ ] Add provider SPF and DKIM records.
- [ ] Add DMARC monitoring record.
- [ ] Create a sending-only SMTP credential.
- [ ] Configure hosted Supabase SMTP.
- [ ] Match Supabase rate limits to provider limits.
- [ ] Test signup, reset and email-change delivery.
- [ ] Confirm SPF, DKIM and DMARC alignment in received headers.
- [ ] Configure bounce and complaint alerts.

## 4. Supabase production

- [ ] Use a separate production project from staging.
- [ ] Enable leaked-password protection.
- [ ] Enable TOTP MFA.
- [ ] Enroll all founder/admin accounts.
- [ ] Configure exact site URL and redirects.
- [ ] Keep anonymous Auth disabled.
- [ ] Keep phone signup disabled for MVP unless separately certified.
- [ ] Enable the `before_user_created` hook after its migration is deployed.
- [ ] Configure CAPTCHA/Turnstile.
- [ ] Configure Google OAuth only after callback testing.
- [ ] Keep Apple OAuth disabled until certified.
- [ ] Review Auth, database, Storage and Edge Function limits.
- [ ] Enable the selected backup/PITR plan.
- [ ] Perform an isolated restore test.

## 5. Vercel

- [ ] Separate Preview, Staging and Production environment variables.
- [ ] Bind Production to certified `main` only after release approval.
- [ ] Protect the Production environment with manual approval.
- [ ] Confirm no server secret uses a `VITE_` prefix.
- [ ] Configure deployment and failure alerts.

## 6. GitHub

- [ ] Enable account MFA.
- [ ] Protect `main` and the release branch.
- [ ] Require release CI checks.
- [ ] Block force pushes and branch deletion.
- [ ] Require resolved PR conversations.
- [ ] Enable Dependabot and secret scanning where the plan permits.
- [ ] Review installed GitHub Apps and tokens.

## 7. Maps

Provider: MapTiler.

- [ ] Create separate browser keys for staging and production.
- [ ] Restrict each key to exact origins.
- [ ] Set approved production style ID.
- [ ] Configure usage and cost alerts.
- [ ] Test map failure and reverse-geocoding failure states.

## 8. Monitoring

Recommended: Sentry plus Better Stack or Checkly.

- [ ] Create production and staging projects.
- [ ] Configure source maps without exposing secrets.
- [ ] Route alerts to a monitored destination.
- [ ] Add uptime checks for homepage, health endpoints and auth-critical routes.
- [ ] Configure alerts for database saturation, Auth/email failures, Storage failures, worker failures and 5xx spikes.

## 9. SMS

Recommended MVP setting: disabled.

- [ ] Confirm phone signup and SMS OTP are disabled in Supabase and UI.
- [ ] Remove any launch claim that SMS is available.

If SMS is required later, certify delivery, sender registration, fraud limits and costs with Infobip, Twilio or Vonage before enabling it.

## 10. Legal and operations

- [ ] Publish final Terms and Privacy Policy.
- [ ] Publish Acceptable Use and prohibited-items rules.
- [ ] Publish reporting, moderation, suspension and appeals rules.
- [ ] Define retention, export and deletion procedures.
- [ ] Assign release, incident and rollback owners.
- [ ] Monitor support, privacy, legal and security addresses.
