# Custom SMTP setup

Auth email — signup confirmation, password recovery, email-change and security
notifications — must go through a dedicated SMTP provider before the app takes
real traffic. Supabase's built-in shared SMTP is throttled to a few dozen emails
an hour and is the first thing that breaks under a launch: it caps how fast new
users can confirm and reset, independent of your compute tier.

This is a **hosted-project** setting. The local stack deliberately keeps using
Mailpit so the Phase 2 auth smoke test (`scripts/phase2-auth-smoke-local.mjs`)
can read confirmation emails; enabling external SMTP in `supabase/config.toml`
would redirect local email away from Mailpit and break that test. Configure the
hosted project instead, in one of the two ways below.

## 1. Choose a provider and a sender identity

Any transactional SMTP provider works (SES, SendGrid, Postmark, Mailgun,
Resend). Pick one and create an API key scoped to sending only. You need:

- **SMTP host** (e.g. `email-smtp.eu-west-1.amazonaws.com`, `smtp.sendgrid.net`)
- **SMTP port** — 587 (STARTTLS) is the default this config uses
- **SMTP user** — provider-specific (`apikey` for SendGrid, an SMTP credential
  for SES)
- **SMTP password / API key** — the secret; never commit it
- **Sender address** — a `no-reply@` address on a domain you control, e.g.
  `no-reply@findit.co.zw`. Do **not** send from a free-mailbox address
  (`@gmail.com`) — it fails DMARC and lands in spam.
- **Sender name** — `FindIt`

## 2. Configure DNS for deliverability (do this before going live)

Without these, provider-sent mail is marked spam or rejected. On the sender
domain:

- **SPF** — a TXT record authorising the provider to send for the domain
  (the provider gives you the exact `include:` value).
- **DKIM** — the CNAME/TXT records the provider issues, so mail is signed.
- **DMARC** — a TXT record at `_dmarc.<domain>`, start with
  `v=DMARC1; p=none; rua=mailto:dmarc@<domain>` to monitor, then tighten to
  `p=quarantine` once SPF/DKIM pass cleanly.

Verify the domain in the provider console until it shows fully authenticated
before sending real mail.

## 3. Apply the SMTP settings to the hosted project

### Option A — Supabase dashboard (simplest)

Authentication -> Emails -> SMTP Settings. Enter the host, port 587, user,
password, sender address and sender name from step 1, and enable. Then raise the
email rate limit under Authentication -> Rate Limits to match your provider's
throughput (the repo pins the local reference at 100/hour in
`supabase/config.toml`).

### Option B — `supabase config push` (config as code)

Set the secrets in the deploy environment, then push. The block is env-driven so
nothing secret is committed:

```bash
export FINDIT_SMTP_HOST=smtp.your-provider.example
export FINDIT_SMTP_USER=apikey
export FINDIT_SMTP_PASS=<provider api key>          # from the secret store
export FINDIT_SMTP_ADMIN_EMAIL=no-reply@your-domain.example
export FINDIT_SMTP_SENDER_NAME=FindIt

supabase link --project-ref <hosted-project-ref>
supabase config push
```

with this block enabled in `supabase/config.toml` **for the push only** (the
committed copy keeps it commented so local `supabase start` stays on Mailpit):

```toml
[auth.email.smtp]
enabled = true
host = "env(FINDIT_SMTP_HOST)"
port = 587
user = "env(FINDIT_SMTP_USER)"
pass = "env(FINDIT_SMTP_PASS)"
admin_email = "env(FINDIT_SMTP_ADMIN_EMAIL)"
sender_name = "env(FINDIT_SMTP_SENDER_NAME)"
```

The `.env.example` server-only section lists these variables. `FINDIT_SMTP_PASS`
lives in the deploy secret store, never in a committed file — the same rule as
every other server secret in `docs/ENVIRONMENT_VARIABLES.md`.

## 4. Verify

Run the production Auth preflight, which reads the live hosted config and fails
closed unless a SMTP host and sender are set:

```bash
FINDIT_AUTH_PREFLIGHT_MODE=production \
FINDIT_ALLOW_HOSTED_AUTH_PREFLIGHT=production \
FINDIT_EXPECT_CUSTOM_SMTP=true \
FINDIT_EXPECT_AUTH_RATE_LIMIT_MAX=200 \
FINDIT_SUPABASE_ACCESS_TOKEN=<token> \
FINDIT_EXPECTED_PROJECT_REF=<ref> \
  npm run verify:hosted-auth-hardening
```

`scripts/lib/auth-config-policy.mjs` reports `customSmtp` and fails the preflight
if it is not configured, so a deploy that forgets SMTP is caught before release.
Then send yourself a real signup and a real password reset against the hosted
project and confirm both arrive from the sender address and pass SPF/DKIM (check
the received-message headers).

## Why the rate limit was raised

`supabase/config.toml` sets `email_sent = 100` (up from Supabase's shared-SMTP
default). That value only bites once real SMTP is in place; the hosted project's
own rate-limit setting is what governs production and should be set to match the
provider's sustained throughput. `email_sent` is a spam/cost control, not a
brute-force control — the anti-abuse limits are `sign_in_sign_ups` and
`token_verifications`, which stay tight.
