# FindIt Email Templates

Reviewed: 2026-07-26

## Scope

FindIt currently sends email only through Supabase Auth. Marketplace
notifications are in-app and no Edge Function currently sends email.

All current Auth messages use the same restrained, table-based template:

- warm neutral background;
- white 600px content panel;
- classic Georgia heading;
- FindIt wordmark and teal rule;
- one clear action;
- security guidance;
- links to FindIt privacy, terms, or support pages.

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

## Rules for future email

Any future email-producing service must:

1. reuse this visual language and plain-language tone;
2. have one primary purpose and at most one primary button;
3. contain no marketing content unless the user separately opted in;
4. link to the production HTTPS site, privacy policy, and support path;
5. avoid attachments and remote tracking by default;
6. avoid placing secrets, passwords, full message content, or sensitive
   moderation evidence in the email;
7. add a repository template and test before the sending path is enabled.

## Production dependency

The hosted project still requires a production SMTP provider and verified
sender domain. Supabase's default mail service is suitable only for limited
testing. On 2026-07-26, `supabase config push` rejected template publication
because the current free-tier project uses the default email provider. No
template deployment was partially applied, and Google/email authentication
remained enabled. Configure custom SMTP or move to a compatible plan, rerun
`supabase config push`, then exercise confirmation, recovery, email-change and
security-notification delivery. Disable provider-side link tracking because
rewritten authentication links can break confirmation and recovery flows.

Subjects and message content should be reviewed with the legal policies before
launch.
