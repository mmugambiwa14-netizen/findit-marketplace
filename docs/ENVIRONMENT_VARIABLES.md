# Environment Variables

Reviewed: 2026-07-30

Never commit real values. Only `VITE_` variables may enter browser builds.

## Browser/build variables

| Name | Purpose | Required | Secret | Example |
|---|---|---:|---:|---|
| `VITE_SUPABASE_URL` | Supabase API/Auth URL | Yes | No | `https://project-ref.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Public publishable/anon key protected by RLS | Yes | No | `sb_publishable_...` |
| `VITE_BASE_PATH` | Optional Vite/Router deployment subpath | Host-specific | No | `/findit-marketplace/` |
| `VITE_AUTH_GOOGLE_ENABLED` | Shows Google login only after provider acceptance | No; default `false` | No | `false` |
| `VITE_AUTH_APPLE_ENABLED` | Shows Apple login only after provider acceptance | No; default `false` | No | `false` |
| `VITE_FEATURE_BUSINESS_PROFILES` | V1 business/dealer profiles | Production `true` | No | `true` |
| `VITE_FEATURE_MESSAGING` | V1 text-only messaging | Production `true` | No | `true` |
| `VITE_FEATURE_ESSENTIAL_NOTIFICATIONS` | V1 operational notifications | Production `true` | No | `true` |
| `VITE_FEATURE_TOURS` | Peek UI exposure | Accepted release `true` | No | `true` |
| `VITE_FEATURE_TOURS_PREVIEW` | Staging-only placeholder | Production `false` | No | `false` |
| `VITE_FEATURE_PAYMENTS` | Deferred payments | Production `false` | No | `false` |
| `VITE_FEATURE_SUBSCRIPTIONS` | Deferred subscriptions | Production `false` | No | `false` |
| `VITE_FEATURE_ESCROW` | Deferred escrow | Production `false` | No | `false` |
| `VITE_FEATURE_PREMIUM_LISTINGS` | Deferred premium listings | Production `false` | No | `false` |
| `VITE_FEATURE_AI_MODERATION` | Deferred AI moderation | Production `false` | No | `false` |
| `VITE_FEATURE_AI_BAN_EVASION` | Deferred AI detection | Production `false` | No | `false` |
| `VITE_FEATURE_AI_TICKET_TRIAGE` | Deferred AI triage | Production `false` | No | `false` |
| `VITE_FEATURE_AI_SUPPORT_CHAT` | Deferred AI support | Production `false` | No | `false` |
| `VITE_FEATURE_SCHEDULED_REMINDERS` | Deferred reminders | Production `false` | No | `false` |
| `VITE_FEATURE_MARKETING_EMAILS` | Deferred marketing | Production `false` | No | `false` |

## Edge/server variables

| Name | Purpose | Required | Secret |
|---|---|---:|---:|
| `SUPABASE_URL` | Project URL supplied to Edge Functions | Yes | No |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` | User-context validation | Yes | No |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Privileged internal database/storage work | Yes | Yes |
| `FINDIT_ALLOWED_ORIGINS` | Exact comma-separated upload origins | Hosted | No |
| `FINDIT_MEDIA_CLEANUP_WORKER_SECRET` | Scheduler bearer for cleanup worker | Hosted | Yes |
| `FINDIT_LISTING_EXPIRY_WORKER_SECRET` | Scheduler bearer for expiry worker | Hosted | Yes |
| `FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED` | Enables bounded essential-notification fan-out workers | Production notifications | No |
| `FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET` | Scheduler bearer for saved-listing notification fan-out | Worker enabled | Yes |
| `FINDIT_RECOMMENDATION_WORKERS_ENABLED` | Enables recommendation partition, aggregate and retention maintenance | Recommendation maintenance enabled | No |
| `FINDIT_RECOMMENDATION_WORKER_SECRET` | Dedicated scheduler bearer for recommendation maintenance | Worker enabled | Yes |
| `FINDIT_REQUEST_BUDGET_SALT` | Salt for opaque recommendation request-budget caller digests | Hosted recommendation services | Yes |
| `FINDIT_RECOMMENDATION_HEALTH_SECRET` | Dedicated bearer for recommendation service health endpoint | Hosted recommendation health checks | Yes |
| `FINDIT_CONTEXTUAL_HEALTH_SECRET` | Dedicated bearer for contextual ecosystem health endpoint | Hosted contextual health checks | Yes |
| `TOURS_BACKEND_ENABLED` | Server-side Tour kill switch | Tours environments | No |
| `FINDIT_TOURS_WORKERS_ENABLED` | Enables processing, cleanup, cache, and observability schedules | Tours enabled | No |
| `FINDIT_TOURS_RELEASE_ACCEPTED` | Explicit production acceptance gate | Production Tours | No |
| `FINDIT_TOURS_ACCEPTANCE_ID` | Named staging acceptance record | Accepted production Tours | No |
| `FINDIT_TOUR_PROCESSOR_MODE` | `github-actions` first-party worker or `external` callback provider | Tours enabled | No |
| `FINDIT_TOUR_PROCESSING_WORKER_SECRET` | External processing dispatcher bearer | External processor mode | Yes |
| `FINDIT_TOUR_CLEANUP_WORKER_SECRET` | Tour cleanup scheduler bearer | Tours enabled | Yes |
| `FINDIT_TOUR_CACHE_WORKER_SECRET` | Cache invalidation scheduler bearer | Tours enabled | Yes |
| `FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET` | Operational alert evaluator bearer | Tours enabled | Yes |
| `TOUR_PROCESSOR_URL` | External transcoding job endpoint | External processor mode | No |
| `TOUR_PROCESSOR_SECRET` | Dispatch and callback HMAC secret | External processor mode | Yes |
| `TOUR_PROCESSING_CALLBACK_URL` | FindIt callback endpoint | External processor mode | No |
| `TOUR_CACHE_PURGE_URL` | Optional CDN purge endpoint | Optional | No |
| `TOUR_CACHE_PURGE_SECRET` | Optional CDN purge credential | With purge URL | Yes |

Recommendation maintenance is intentionally independent from listing delivery. The scheduled job remains disabled until `FINDIT_RECOMMENDATION_WORKERS_ENABLED=true` is configured in GitHub Actions and the same randomly generated bearer is stored as `FINDIT_RECOMMENDATION_WORKER_SECRET` in both GitHub Actions and Supabase Edge Function secrets. Failure of this worker may delay projection backfills, partition preparation, popularity refreshes or retention cleanup, but it must never make listing routes unavailable.

## Operations/test-only variables

| Name | Purpose |
|---|---|
| `FINDIT_SUPABASE_URL` | Explicit smoke/backup target |
| `FINDIT_SUPABASE_ANON_KEY` | Public smoke key |
| `FINDIT_SUPABASE_SECRET_KEY` | Admin fixture key; process-only |
| `FINDIT_SUPABASE_ACCESS_TOKEN` | Supabase Management API token; process-only and never printed or persisted |
| `FINDIT_ALLOW_HOSTED_SMOKE=staging` | Required destructive-safety opt-in |
| `FINDIT_ALLOW_STAGING_FOUNDER_SESSION=staging` | Allows guarded Phase 3 certification to create and immediately sign out a one-time staging founder session for audited policy operations |
| `FINDIT_ALLOW_STAGING_TIMEOUT_LOCK=staging` | Allows the Phase 3 certification to hold a bounded 15-second projection-table lock on the exact staging target |
| `FINDIT_ALLOW_HOSTED_BACKUP=staging` | Required hosted-backup opt-in |
| `FINDIT_EXPECTED_PROJECT_REF` | Exact target guard |
| `FINDIT_SMOKE_ORIGIN` | Exact hosted upload origin |
| `FINDIT_BACKUP_DIRECTORY` | Explicit logical-backup output path |
| `FINDIT_MAILPIT_URL` | Local Auth email test endpoint |
| `FINDIT_EXPECT_GOOGLE_OAUTH` | Expected hosted Google provider status |
| `FINDIT_EXPECT_APPLE_OAUTH` | Expected hosted Apple provider status |
| `FINDIT_RECOMMENDATION_SMOKE_URL` | Explicit Supabase project URL for recommendation hosted smoke |
| `FINDIT_RECOMMENDATION_SMOKE_ORIGIN` | Browser origin expected in recommendation CORS checks |
| `FINDIT_RECOMMENDATION_SMOKE_LISTING_ID` | Published listing id used for hosted recommendation and contextual smoke |

## Hosted Auth hardening preflight

`npm run verify:hosted-auth-hardening` performs a read-only request to the exact
Supabase project Auth configuration and fails closed when the declared policy is
not met. It never changes provider configuration and must not run in ordinary PR
CI because its Management API token is privileged.

| Name | Production expectation |
|---|---|
| `FINDIT_ALLOW_HOSTED_AUTH_PREFLIGHT=production` | Explicit read-only production opt-in; must equal the selected mode |
| `FINDIT_AUTH_PREFLIGHT_MODE=production` | Enforces the complete production policy |
| `FINDIT_EXPECTED_PROJECT_REF` | Exact production project reference |
| `FINDIT_SUPABASE_ACCESS_TOKEN` | Process-only Management API token |
| `FINDIT_EXPECT_AUTH_SITE_URL` | Final canonical HTTPS frontend origin |
| `FINDIT_EXPECT_AUTH_REDIRECT_URLS` | Exact comma-separated HTTPS callback and recovery allowlist; no loopback URLs |
| `FINDIT_EXPECT_EMAIL_CONFIRMATIONS=true` | Sign-up confirmation remains enabled |
| `FINDIT_EXPECT_PASSWORD_MIN_LENGTH=12` | Minimum accepted password length |
| `FINDIT_EXPECT_PASSWORD_REQUIRED_CHARACTERS` | Strongest selected character-class policy from hosted Auth settings |
| `FINDIT_EXPECT_LEAKED_PASSWORD_PROTECTION=true` | Compromised-password rejection enabled; requires a compatible Supabase plan |
| `FINDIT_EXPECT_TOTP_MFA=true` | TOTP enrollment and verification both enabled |
| `FINDIT_EXPECT_AUTH_CAPTCHA=true` | Auth bot protection enabled with an approved provider |
| `FINDIT_EXPECT_CUSTOM_SMTP=true` | Custom SMTP host and sender configured |
| `FINDIT_EXPECT_GOOGLE_OAUTH=true` | Use only after public Google consent and production callback acceptance |
| `FINDIT_EXPECT_APPLE_OAUTH=false` | Apple remains outside the current release scope |
| `FINDIT_EXPECT_ANONYMOUS_AUTH=false` | Anonymous Auth disabled |
| `FINDIT_EXPECT_PHONE_SIGNUP=false` | Direct phone signup disabled until an approved SMS onboarding path exists |

Audit and staging modes use the same evaluator but require their matching
`FINDIT_ALLOW_HOSTED_AUTH_PREFLIGHT` value. Missing production expectations,
missing provider fields, weak password settings, redirect drift, default mail,
disabled MFA, disabled CAPTCHA, or provider-state mismatches fail the command.

Google and Apple OAuth secrets are server/provider credentials and never use a
`VITE_` prefix. For local-only Auth containers the documented variables are
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` and
`SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`; hosted credentials belong in Supabase
Auth provider settings. See `OAUTH_SETUP.md`.

`OPENAI_API_KEY`, Twilio, experimental S3, payment, AI, scanning, SMTP and
observability secrets are not application requirements while their
features/providers are disabled. Add them only with an approved provider,
owner, rotation policy and corresponding documentation.

Validation is `npm run validate:env`. A closed production build requires HTTPS, all three existing MVP flags on, the essential-notification fan-out worker enabled, all deferred browser flags off, and both Tour flags off. Recommendation maintenance remains independently opt-in and requires its dedicated secret whenever enabled. A Peek-enabled production build additionally requires `FINDIT_TOURS_RELEASE_ACCEPTED=true`, a valid `FINDIT_TOURS_ACCEPTANCE_ID`, the browser and backend Peek flags enabled, a declared processor mode, and the complete cleanup, cache, observability, and notification fan-out worker configuration above. `github-actions` mode runs the repository-owned FFmpeg processor with a scoped Supabase secret; `external` mode additionally requires the dispatch, callback, and HMAC configuration.