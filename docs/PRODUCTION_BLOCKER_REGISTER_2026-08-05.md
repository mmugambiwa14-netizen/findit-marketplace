# FindIt Production Blocker Register

Reviewed: 2026-08-05
Release candidate: `release/production-readiness-2026-08-05`
Authoritative product branch: `feature/listing-intelligence-foundation`
Production decision: **BLOCKED**

This is the release-control source of truth. A successful Vercel deployment is not production certification. Every P0 and P1 item below must have evidence attached to the exact final commit before production promotion.

## Severity

- **P0**: release and real-user onboarding prohibited.
- **P1**: must close before public launch unless explicitly removed from launch scope.
- **P2**: may be scheduled immediately after launch only with documented acceptance and a safe degraded mode.

## A. Repository and database blockers

### BR-001 — Reconcile competing migration repairs — P0 — Owner: engineering

PR #6 and the authoritative branch contain competing repairs around `20260805074500_database_lint_and_runtime_contract_repairs.sql` and `scripts/run-migration-database-certification.sh`.

Closure evidence:

- one reviewed implementation is selected or combined;
- the complete migration chain applies from an empty Supabase project;
- existing staging upgrade succeeds;
- schema and function locations match expected catalogs;
- rollback/checkpoint procedure is demonstrated;
- PR #6 is merged only after reconciliation.

### BR-002 — Authoritative Supabase pgTAP execution — P0 — Owner: engineering

The plain PostgreSQL harness is useful but cannot certify Supabase-specific grants. Docker/Supabase execution is still required.

Closure evidence:

- `supabase test db` runs every suite in `supabase/tests`;
- RLS and function privilege matrices pass;
- no suites are silently excluded;
- results are attached to the exact release commit;
- stale expectations are updated only after comparing them with migration intent and live catalog behavior.

### BR-003 — Private schema wrapper boundary — P0 — Owner: engineering/security

Prove that browser roles have only the minimum schema access necessary for public invoker wrappers.

Closure evidence:

- authenticated own-row writes succeed;
- anonymous and authenticated callers cannot create objects in `private`;
- internal private functions are not exposed through PostgREST;
- admin-only functions remain inaccessible;
- trigger protections still execute with the intended caller semantics.

### BR-004 — Seller/service contact harvesting boundary — P0 — Owner: engineering/security

Closure evidence:

- `anon` and ordinary `authenticated` queries cannot bulk-read phone, WhatsApp or email columns;
- public listing/service queries still work;
- contact reveal RPCs enforce authentication, publication/ownership, rate limits and audit logging;
- owners can manage their own contact data;
- adversarial tests cover new columns and future grant drift.

### BR-005 — Full immutable release CI — P0 — Owner: engineering/account owner

Current visible commit status proves Vercel deployment only.

Required checks on one unchanged final commit:

- locked clean install;
- lint;
- all typechecks;
- contract tests;
- behavioral tests;
- production audit;
- production build and bundle-secret scan;
- repository hygiene/source graph/SQL boundary;
- clean migration database;
- all pgTAP suites;
- dependency and workflow-pin checks;
- hosted smoke tests where secrets are available.

### BR-006 — Promote authoritative release to `main` safely — P0 — Owner: release owner

`main` remains the obsolete baseline. The backup branch `backup/main-pre-production-promotion-2026-08-05` preserves rollback.

Closure evidence:

- BR-001 through BR-005 pass;
- production approval is recorded;
- release candidate is promoted through PR, not force push;
- Vercel production is bound to certified `main`;
- rollback instructions and exact prior SHA are recorded.

## B. Authentication, MFA and abuse controls

### AU-001 — Hosted Supabase Auth production policy — P0 — Owner: account owner

Provider: Supabase Auth.

Configure and prove:

- canonical site URL and exact redirect allowlist;
- email confirmation;
- password policy and leaked-password protection;
- refresh-token/session settings;
- recovery and email-change templates;
- anonymous Auth disabled;
- phone signup disabled unless separately certified;
- production rate limits;
- generic anti-enumeration behavior.

### AU-002 — Mandatory admin/founder MFA — P0 — Owner: account owner + engineering

Enable TOTP MFA in Supabase and require an AAL2-equivalent session for admin actions. Enroll all founder/admin accounts before creating moderator accounts.

Also enforce MFA on GitHub, Vercel, Supabase, domain/DNS, business email and transactional email provider accounts. Store recovery codes offline.

### AU-003 — Hosted `before_user_created` hook — P1 — Owner: account owner

Enable and test the server-side signup hook used for disposable/fake-email rejection. Browser validation is not enforcement.

### AU-004 — CAPTCHA/bot defense — P1 — Owner: account owner + engineering

Recommended provider: Cloudflare Turnstile.

Protect signup, recovery and abuse-prone forms. Keep server-side IP/account cooldowns and database limits as the primary controls.

### AU-005 — OAuth production certification — P1 — Owner: account owner + engineering

Google OAuth may be enabled only after callback and account-linking tests. Keep Apple OAuth disabled until separately configured and certified.

### AU-006 — Password recovery and PKCE end-to-end — P0 — Owner: engineering/account owner

Prove same-device and cross-device recovery, expiry, one-time use, safe redirects, session handling and email template links on the final production origin.

## C. Email and SMS

### EM-001 — Transactional SMTP — P0 — Owner: account owner

Recommended provider: Postmark. Alternatives: Resend, Amazon SES, Mailgun or SendGrid.

Required setup:

- dedicated sending identity such as `account@<domain>` or `no-reply@<domain>`;
- sending-only API/SMTP credential;
- SPF and DKIM passing;
- DMARC monitoring, then quarantine/reject policy after validation;
- custom return path where supported;
- Supabase hosted SMTP host, port 587, username, secret, sender and rate limit;
- signup, reset, email-change and security-message delivery tests to Gmail and Outlook;
- bounce/complaint monitoring;
- secret stored only in provider/deployment secret stores.

### EM-002 — Business email — P1 — Owner: account owner

Recommended provider: Google Workspace. Alternative: Microsoft 365.

Create one paid administrator mailbox and aliases/groups for `support@`, `privacy@`, `legal@`, `security@`, `partnerships@` and `finance@`. Require MFA, disable legacy protocols and monitor forwarding rules.

### SM-001 — SMS scope decision — P1 if enabled; otherwise closed by exclusion — Owner: product owner

Recommended MVP decision: keep phone signup/OTP disabled. If enabled, certify a provider such as Infobip, Twilio or Vonage for the launch country, including delivery, sender registration, fraud controls, per-number/IP limits, cost alerts and fallback behavior.

## D. Hosting, domain, maps and secrets

### IN-001 — Production domain, DNS and TLS — P0 — Owner: account owner

Required:

- final domain ownership;
- production and staging subdomains;
- DNS records;
- HTTPS certificate;
- HSTS and CSP verification;
- SPA deep-link/recovery/admin route tests;
- exact origins in Supabase, OAuth, CORS and MapTiler restrictions.

### IN-002 — Environment separation — P0 — Owner: account owner + engineering

Use separate production and staging Supabase projects and separate Vercel environments. Inventory every variable and secret. Only browser-safe values may use `VITE_*`.

Never expose service-role keys, database passwords, SMTP secrets, VAPID private keys, OAuth secrets, cron secrets or provider management tokens.

### IN-003 — MapTiler production controls — P1 — Owner: account owner

Create separate browser keys per environment, restricted to exact origins. Set style ID, quota and cost alerts. Test reverse geocoding and degraded map behavior.

### IN-004 — Branch and deployment protection — P0 — Owner: repository owner

Protect `main` and the release branch: PR-only changes, required checks, no force push/deletion, resolved conversations, protected production environment and manual production approval.

## E. Backups, monitoring and operations

### OP-001 — Backup, PITR and isolated restore — P0 — Owner: account owner

Enable an appropriate Supabase backup/PITR plan. Define numeric RPO/RTO. Perform an isolated restore and verify row counts, checksums, foreign keys, Auth/profile relationships, RLS and Storage objects.

### OP-002 — Monitoring and incident alerts — P0 — Owner: account owner + engineering

Recommended baseline:

- Sentry for frontend and Edge Function failures;
- Better Stack, Checkly or UptimeRobot for uptime;
- Supabase database/Auth/Storage dashboards;
- Vercel deployment alerts;
- monitored `security@` and operational destination.

Alert on outage, 5xx rise, login/email failures, database saturation, worker failures, message failures, Peek processing failures and storage errors.

### OP-003 — Scheduled workers — P0 — Owner: engineering/account owner

Prove automatic execution, idempotency and alerting for notification delivery, recommendation maintenance, Peek cleanup/processing, cache invalidation, expiry and observability jobs. Manual execution is not certification.

### OP-004 — Incident and rollback runbook — P1 — Owner: product owner

Name the incident lead, release operator and rollback decision-maker. Document credential compromise, PII exposure, outage, failed migration, abusive content and provider outage procedures.

## F. Product and hosted acceptance

### QA-001 — Core hosted end-to-end acceptance — P0 — Owner: engineering/product owner

Test on the exact release build:

- signup, confirmation, login, logout and recovery;
- create/edit/publish/pause/expire listing and service;
- upload/remove media and recover drafts;
- search/filter/map/location denial;
- contact reveal and audit limits;
- buyer/seller messaging and unread behavior;
- Peek request, seller queue, fulfillment/decline, processing, binding and notification;
- reporting/moderation/admin actions;
- account deletion and retention behavior.

### QA-002 — Browser, device and accessibility acceptance — P1 — Owner: engineering/product owner

Cover iPhone Safari, Android Chrome, desktop Chrome/Safari/Firefox, keyboard-only, screen reader, reduced motion, safe areas, slow/interrupted networks and permission denial.

### QA-003 — Capacity and cost acceptance — P1 — Owner: product owner + engineering

Approve provider plans and run production-like load tests for search, details, messaging, notifications, recommendations and Peek media. Set bandwidth, database, storage, geocoding and processing cost alerts and degraded-mode thresholds.

### QA-004 — Peek media security and lifecycle — P0 if Peek launches — Owner: engineering/account owner

Prove server-enforced type/signature/size/duration limits, private storage, expiring signed URLs, reliable idempotent processing, moderation eligibility, abandoned-upload cleanup and retention/deletion.

### QA-005 — Push notification scope — P1 if enabled; otherwise close by exclusion — Owner: product owner

If enabled, configure VAPID, protect private keys, clean expired subscriptions, honor preferences and avoid sensitive lock-screen content. Otherwise disable the UI and launch claims.

## G. Legal and business operations

### LG-001 — Final legal documents and consent records — P0 — Owner: product owner/legal adviser

Finalize Terms, Privacy Policy, Cookie notice where applicable, Acceptable Use, prohibited-items policy, safety guidance, reporting/moderation, suspension/appeals, retention and deletion policies. Record version and acceptance time.

Obtain jurisdiction-specific review for the actual launch country, including applicable Turkish KVKK or Zimbabwe data-protection/consumer obligations where relevant.

### LG-002 — Data export and deletion operating proof — P1/P0 where legally required — Owner: product owner + engineering

Prove reauthentication, session revocation, profile/listing/media treatment, message/legal retention, audit record retention, export delivery and completion communication.

### LG-003 — Support and abuse operations — P1 — Owner: product owner

Define monitored response queues, severity targets, emergency escalation, evidence handling, moderation appeal handling and after-hours expectations.

## Release gate

Production promotion is permitted only when:

1. every P0 item is closed with evidence on the exact final commit;
2. every launch-scope P1 item is closed;
3. excluded P1/P2 features are disabled in code, configuration and marketing;
4. the release owner records a go/no-go decision and rollback SHA;
5. hosted acceptance is repeated after final DNS and provider configuration.
