# Supabase Setup

## Verified hosted checkpoint — 2026-07-26

Project `bwgklpxoetrrkutottdb` (`FindIt Staging`, `eu-west-2`, Postgres 17) is
linked. Migrations `0001`–`0030`, two private buckets and all four Edge
Functions are deployed. Auth uses a minimum 10-character mixed-case/digit
password policy, eight-character email OTPs, confirmation enabled, and exact
local/intended-staging redirect URLs. Hosted Auth, RLS, marketplace, admin,
business/dealer, messaging, notifications, storage, worker and search-scale
smokes pass.

Production must use a separate project and repeat the full setup/acceptance
sequence. Never copy staging service or worker secrets into production.

Status: local verification plus an accepted empty hosted staging checkpoint. It is not
a production provisioning guide. Last reviewed: 2026-07-26.

## Prerequisites

- Supported Node.js/npm version from the project tooling.
- Docker Desktop running.
- Supabase CLI installed and authenticated only when operating a remote
  project.
- A local `.env.local` containing non-secret public browser values described
  in `ENVIRONMENT_VARIABLES.md`. Never commit environment files or secrets.

## Local setup

From the repository root:

```powershell
npm.cmd ci
supabase start
supabase db reset --local --no-seed
supabase db lint --local
supabase test db
```

The current local configuration uses ports in the `55320`-`55329` range to
avoid the unrelated default-port project that may be running on a developer
machine. Obtain the local API URL and anon key from `supabase status --output
json`, place them in `.env.local`, then run:

```powershell
npm.cmd run validate:env
npm.cmd run dev
```

To run the repeatable local signup, confirmation, profile-trigger,
login/logout, recovery, and password-replacement smoke, set the local
publishable key for the current process and run:

```powershell
$env:FINDIT_SUPABASE_ANON_KEY='your-local-publishable-key'
npm.cmd run test:auth-local
```

The smoke creates a synthetic local account. Run the clean reset again after
capturing test evidence when a zero-row local baseline is required.

The Phase 3 owner-listing CRUD and active V1 admin smokes additionally need the
local secret key.
It refuses any non-local Supabase URL, creates and removes its own disposable
identity, and never prints credentials:

```powershell
$env:FINDIT_SUPABASE_ANON_KEY='your-local-publishable-key'
$env:FINDIT_SUPABASE_SECRET_KEY='your-local-secret-key'
npm.cmd run test:owner-listings-local
npm.cmd run test:services-local
npm.cmd run test:admin-local
npm.cmd run test:messaging-local
npm.cmd run test:notifications-local
npm.cmd run test:listing-expiry-local
npm.cmd run test:listing-creation-local
npm.cmd run test:media-lifecycle-local
```

Do not print, commit, or paste generated keys into documentation.

## Hosted staging Auth smoke

`npm run test:auth-hosted` is intentionally separate from the local Mailpit
flow. It requires an explicit staging opt-in and exact project-ref match,
creates one confirmed synthetic account, verifies the profile trigger, password
login, own-profile RLS, anonymous denial and logout, then removes the Auth and
profile fixtures. Provide all values only for the current process:

```powershell
$env:FINDIT_ALLOW_HOSTED_SMOKE='staging'
$env:FINDIT_EXPECTED_PROJECT_REF='your-approved-project-ref'
$env:FINDIT_SUPABASE_URL='https://your-approved-project-ref.supabase.co'
$env:FINDIT_SUPABASE_ANON_KEY='your-hosted-publishable-key'
$env:FINDIT_SUPABASE_SECRET_KEY='your-hosted-secret-key'
npm.cmd run test:auth-hosted
```

The script does not test email delivery, recovery links, OAuth, browser
redirects, refresh/revocation across devices, or existing-user migration.

`npm run test:listing-creation-hosted` reuses the listing smoke only after the
same explicit staging opt-in and exact project-ref match. It creates disposable
owner/admin/stranger identities, exercises hostile and valid hosted upload,
submission, moderation, signed download and atomic image replacement, then
removes its database, Auth and Storage fixtures. Use the same process-only
variables shown above.

## Intentional local limitations

`supabase/config.toml` enables Storage and the Edge runtime for the approved V1
image classes. Realtime and Analytics remain disabled. The `listing-images`
and `marketplace-images` buckets are private, capped at 5 MiB and restricted
to JPEG/PNG/WebP. `listing-image-upload` and `marketplace-image-upload` verify
JWTs and use local-only browser origins unless `FINDIT_ALLOWED_ORIGINS` is
supplied to the function runtime. `media-lifecycle-cleanup` and
`listing-expiry-worker` are internal-only functions: gateway JWT verification
is disabled so both legacy JWT and new opaque Supabase secret keys work, but
each function constant-time compares the bearer credential with its dedicated
`FINDIT_MEDIA_CLEANUP_WORKER_SECRET` or
`FINDIT_LISTING_EXPIRY_WORKER_SECRET` before claiming work. Local development
falls back to the local admin key only when the dedicated variable is absent.
The hosted scheduler credential must never be the Supabase database admin key.
Never expose or call either worker from a browser.
A hosted scheduler must invoke them at a
documented interval, keep the credential in a secret manager/Vault, and alert
on expired backlog, stale claims and retries. Do not mistake this local configuration for
a hosted deployment, advanced media processing, or support for retained/
deferred document and attachment classes.

## Remote/staging prerequisites

Before using a remote Supabase project, record the project owner, region,
Postgres version, redirect URLs, SMTP/OAuth/SMS providers, RLS acceptance
matrix, backup/PITR configuration, and immutable migration/data manifests.
Apply migrations only after the upgrade, rollback, and reconciliation gates in
`DEPLOYMENT_RUNBOOK.md` are met.

The current empty staging checkpoint is `FindIt Staging`
(`bwgklpxoetrrkutottdb`, `eu-west-2`, Postgres 17). Migrations `0001`–`0030`
and all four Edge Functions are deployed. Hosted `public,storage` schema lint,
public REST, anonymous function denial, dedicated maintenance-worker
authentication and the guarded Auth smoke pass. `supabase test db --linked`
currently stops before assertions because the managed CLI login role lacks
`USAGE` on the `extensions` schema containing pgTAP; local pgTAP remains the
authoritative 258-assertion matrix until a supported hosted runner credential
or provider fix is available.

Google and Apple provider setup is documented in
[`OAUTH_SETUP.md`](OAUTH_SETUP.md). Do not enable a frontend OAuth flag merely
because the Supabase setting was saved: the provider console callback, hosted
setting, complete browser round trip, profile creation and account-state denial
must all pass first.

## Verification boundary

The local suite previously proved clean application through migration `0029`,
schema lint, 258 RLS/database assertions, local reconciliation, and Auth/owner/service/
admin/business/messaging/notification/listing-upload API smokes. The listing,
service-photo and business-logo smokes exercise real Edge and Storage HTTP
paths through signed exact-byte downloads; product/service smokes also replace
attached media and verify detached-object privacy and cleanup. The lifecycle
claim/finalize/retry protocol, worker source contract and real local Edge/
Storage HTTP smoke pass, including browser-key denial, two-bucket deletion,
ledger finalization and an idempotent repeat run. Migration `0030` has been
applied to hosted staging, the linked schema lint is clean, and no migration is
pending; its clean local replay remains to be repeated after the local Docker
runtime is healthy. The listing-expiry Edge smoke
also proves browser/mixed-key denial, trusted notification creation, a safe
internal link and repeat-run idempotency. Targeted Chromium verifies recovery,
owner listings, public seller, V1 service, active V1 admin and business/dealer
workflows through the prior checkpoint; listing creation, messaging and
notification Chromium remain blocked because no in-app browser instance is
available. It does not prove a production upgrade, provider-backed restore,
hosted Storage/Edge deployment, SMTP/OAuth delivery, complete browser/device
coverage, or deployment workflow.
