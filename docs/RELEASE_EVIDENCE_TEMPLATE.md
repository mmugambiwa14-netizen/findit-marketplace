# FindIt Production Release Evidence

Release commit: `<sha>`
Release date: `<date>`
Release operator: `<name>`
Decision: `GO | NO-GO`
Rollback commit/branch: `<sha or branch>`

## Required automated evidence

- [ ] Clean locked install
- [ ] Lint
- [ ] All typechecks
- [ ] Contract tests
- [ ] Behavioral tests
- [ ] Production audit
- [ ] Production build
- [ ] Bundle secret scan
- [ ] Repository hygiene/source graph/SQL boundary
- [ ] Empty-database migration chain
- [ ] Existing-staging upgrade
- [ ] Full Supabase pgTAP suite
- [ ] Dependency and workflow pin checks
- [ ] Hosted smoke tests

Attach immutable workflow run URLs and artifact checksums.

## Required hosted configuration evidence

- [ ] Production/staging Supabase separation
- [ ] Auth URL and redirect allowlist
- [ ] Leaked-password protection
- [ ] Admin/founder TOTP MFA enrollment
- [ ] CAPTCHA/bot protection
- [ ] Custom SMTP and verified sender domain
- [ ] OAuth callback tests
- [ ] Production domain, DNS, TLS, CSP and HSTS
- [ ] Map key origin restrictions and alerts
- [ ] Backup/PITR plan
- [ ] Isolated restore exercise
- [ ] Monitoring and alert delivery
- [ ] Scheduled worker execution
- [ ] Branch and deployment protection

Do not include secrets in this document. Use screenshots or redacted provider exports where appropriate.

## Hosted product acceptance

- [ ] Auth lifecycle
- [ ] Listing/service lifecycle
- [ ] Media lifecycle
- [ ] Search/map/location denial
- [ ] Contact reveal privacy and limits
- [ ] Messaging and unread behavior
- [ ] Peek request and fulfillment lifecycle
- [ ] Notifications
- [ ] Reports/moderation/admin actions
- [ ] Account deletion/export/retention
- [ ] Browser/device/accessibility matrix
- [ ] Load, capacity and cost thresholds

## Legal and operations

- [ ] Final legal documents published and versioned
- [ ] Consent records verified
- [ ] Support and abuse queues monitored
- [ ] Incident/rollback roles assigned
- [ ] Launch-scope exclusions disabled in UI, configuration and marketing

## Final approval

Known accepted risks:

`<none or detailed list>`

Go/no-go rationale:

`<decision record>`
