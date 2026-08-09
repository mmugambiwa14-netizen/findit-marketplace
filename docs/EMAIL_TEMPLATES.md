# PeekaListing Email Templates

Reviewed: 2026-08-09

## Scope

PeekaListing uses Supabase Auth for account and security messages, plus a
server-only transactional dispatcher for essential marketplace notifications.
The dispatcher is queue-based and only sends after the account owner configures
a verified sender and provider credentials.

Every email type uses the same restrained, table-based professional template:

- warm neutral background;
- white 600px content panel;
- classic Georgia heading;
- PeekaListing wordmark and teal rule;
- one clear action;
- security guidance;
- links to PeekaListing privacy, terms, or support pages.

The HTML is intentionally compatible with traditional email clients. It does
not use JavaScript, external fonts, tracking pixels, gradients, or decorative
images.

## Covered messages

Authentication:

- sign-up confirmation;
- password recovery;
- invitation;
- magic-link sign-in;
- email change confirmation;
- reauthentication code.

Security notifications:

- password changed;
- email changed;
- phone changed;
- sign-in method linked;
- sign-in method removed;
- verification method enrolled;
- verification method removed.

Templates live in `supabase/templates/` and are referenced by
`supabase/config.toml`.

Marketplace notification jobs are stored in `public.email_delivery_jobs` and
are consumed by `supabase/functions/transactional-email-dispatch/index.ts`.
The UI preference controls in Settings determine which non-security messages
may be delivered. Account recovery and security messages remain essential.

## Rules for future email

Any future email-producing service must:

1. reuse this visual language and plain-language tone;
2. have one primary purpose and at most one primary button;
3. contain no marketing content unless the user separately opted in;
4. link to the production HTTPS site, privacy policy, and support path;
5. avoid attachments and remote tracking by default;
6. avoid placing secrets, passwords, full message content, or sensitive
   moderation evidence in the email;
7. add a repository template and test before the sending path is enabled;
8. keep all provider keys, dispatch tokens, and service-role credentials on
   the server or in the deployment secret store, never in `VITE_*` variables.

## Production dependency

The hosted project still requires a verified sender domain and a provider such
as Resend for the transactional dispatcher. Supabase's default mail service
is suitable only for limited testing. The repository templates and subjects
are ready, but hosted Auth template publication still requires the account
owner to configure compatible custom SMTP or a compatible plan and publish the
configuration. Then exercise confirmation, recovery, email-change and
security-notification delivery. Disable provider-side link tracking because
rewritten authentication links can break confirmation and recovery flows.

Before enabling the GitHub dispatch job, configure these server-side values:

- `EMAIL_DISPATCH_TOKEN`;
- `RESEND_API_KEY`;
- `EMAIL_FROM`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `FINDIT_APP_URL`.

Set the matching `FINDIT_EMAIL_DISPATCH_TOKEN` GitHub environment secret and
enable `FINDIT_TRANSACTIONAL_EMAIL_WORKERS_ENABLED` only after the provider
test succeeds. Existing queued jobs are retained until dispatch is enabled.

Subjects and message content should be reviewed with the legal policies before
launch.
