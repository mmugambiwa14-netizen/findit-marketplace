# Environment Variables

Reviewed: 2026-07-31

Never commit real credentials. Only variables prefixed with `VITE_` may enter a
browser build, and public browser keys must still be provider-restricted.

## Browser and build variables

| Name | Purpose | Current release expectation |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase API/Auth URL | Required; HTTPS in production |
| `VITE_SUPABASE_ANON_KEY` | Public publishable key protected by RLS | Required |
| `VITE_BASE_PATH` | Optional deployment subpath | Host-specific |
| `VITE_AUTH_GOOGLE_ENABLED` | Supabase Google provider switch | False until exact callback acceptance |
| `VITE_AUTH_APPLE_ENABLED` | Apple provider switch | False |
| `VITE_FEATURE_BUSINESS_PROFILES` | Business/dealer profiles | True |
| `VITE_FEATURE_MESSAGING` | Plain-text conversations | True |
| `VITE_FEATURE_ESSENTIAL_NOTIFICATIONS` | Essential notifications | True |
| `VITE_FEATURE_GOOGLE_OAUTH` | Shows Google controls | True only with provider enabled |
| `VITE_FEATURE_MAPS` | Search-results map | True for the certified production variant |
| `VITE_FEATURE_MANUAL_LOCATION` | Country/province/city selector | True; required fallback |
| `VITE_FEATURE_CURRENT_LOCATION` | Consent-gated device location to a supported public place | True after the Supabase/PostGIS registry is certified; independent of maps |
| `VITE_MAPTILER_PUBLIC_KEY` | MapTiler browser key | Required when maps are enabled |
| `VITE_MAPTILER_STYLE_ID` | Approved MapTiler map style | Defaults to `streets-v4` |
| `VITE_SENTRY_DSN` | Public Sentry browser DSN | Optional; monitoring stays dormant when unset |
| `VITE_SENTRY_ENVIRONMENT` | Sentry environment label | `staging` or `production` in Cloudflare workflows |
| `VITE_SENTRY_RELEASE` | Sentry release identifier | Git commit SHA in Cloudflare workflows |
| `VITE_FEATURE_REPORTING` | Marketplace reporting | True |
| `VITE_FEATURE_TOURS` | Peek UI | True only for an accepted Peek release |
| `VITE_FEATURE_TOURS_PREVIEW` | Development/staging preview | False in every production build |
| `VITE_FEATURE_PREVIEW_FIXTURES` | Preview fixtures | False in production |
| `VITE_PREVIEW_AUTH_BYPASS` | Local private-host preview bypass | False in every deployment |

The MapTiler key is intentionally a browser-visible public key, not a server
secret. It must be restricted in MapTiler to the exact approved origins. Use a
separate key per environment, set quota and cost alerts, and rotate it if an
unexpected origin is observed.

The renderer is pinned to MapLibre GL JS `5.12.0`. The current runtime loads the
exact versioned JavaScript and CSS from `unpkg.com`; production Content Security
Policy must allow only that pinned host plus MapTiler endpoints, or the pinned
assets should be copied to the approved first-party host before launch.

Minimum host policy for the current externally hosted runtime normally needs:

- `script-src` permitting the exact `https://unpkg.com` origin;
- `style-src` permitting the exact `https://unpkg.com` origin;
- `connect-src` permitting `https://api.maptiler.com` and Supabase;
- `img-src` permitting MapTiler data/blob images as required by the selected
  style;
- `worker-src blob:` for MapLibre workers.

Do not broaden these directives to wildcard internet access. Validate the final
header against the exact production build and style resources.

## Fail-closed customer capabilities

These variables must remain exactly `false` for the Zimbabwe-first V1 because a
complete product contract does not yet exist:

- `VITE_FEATURE_CURRENCY_CONVERSION`
- `VITE_FEATURE_PHONE_VERIFICATION`
- `VITE_FEATURE_INTERNATIONAL_LISTING`
- `VITE_FEATURE_SERVICE_RADIUS`
- `VITE_FEATURE_LISTING_EXPIRY`
- `VITE_FEATURE_LISTING_FRESHNESS_REMINDERS`
- `VITE_FEATURE_PAYMENTS`
- `VITE_FEATURE_SUBSCRIPTIONS`
- `VITE_FEATURE_ESCROW`
- `VITE_FEATURE_PREMIUM_LISTINGS`
- `VITE_FEATURE_AI_MODERATION`
- `VITE_FEATURE_AI_BAN_EVASION`
- `VITE_FEATURE_AI_TICKET_TRIAGE`
- `VITE_FEATURE_AI_SUPPORT_CHAT`
- `VITE_FEATURE_SCHEDULED_REMINDERS`
- `VITE_FEATURE_MARKETING_EMAILS`

`npm run validate:env` rejects an attempted production release that enables any
of these. A browser switch alone can never substitute for implementation,
provider, database, privacy and acceptance work.

## Edge and server variables

| Name | Purpose | Secret |
|---|---|---:|
| `SUPABASE_URL` | Project URL supplied to Edge Functions | No |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` | User-context validation | No |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Privileged internal work | Yes |
| `FINDIT_ALLOWED_ORIGINS` | Exact comma-separated browser origins | No |
| `FINDIT_ESSENTIAL_NOTIFICATIONS_WORKERS_ENABLED` | Notification worker activation | No |
| `FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET` | Notification scheduler bearer | Yes |
| `FINDIT_RECOMMENDATION_WORKERS_ENABLED` | Recommendation maintenance activation | No |
| `FINDIT_RECOMMENDATION_WORKER_SECRET` | Recommendation scheduler bearer | Yes |
| `FINDIT_REQUEST_BUDGET_SALT` | Opaque request-budget digest salt | Yes |
| `FINDIT_RECOMMENDATION_HEALTH_SECRET` | Recommendation health bearer | Yes |
| `FINDIT_CONTEXTUAL_HEALTH_SECRET` | Contextual health bearer | Yes |
| `TOURS_BACKEND_ENABLED` | Peek backend kill switch | No |
| `FINDIT_TOURS_WORKERS_ENABLED` | Peek workers activation | No |
| `FINDIT_TOURS_RELEASE_ACCEPTED` | Explicit release acceptance | No |
| `FINDIT_TOURS_ACCEPTANCE_ID` | Named acceptance record | No |
| `FINDIT_TOUR_PROCESSOR_MODE` | `github-actions` or `external` | No |
| `FINDIT_TOUR_PROCESSING_WORKER_SECRET` | External processor scheduler bearer | Yes |
| `FINDIT_TOUR_CLEANUP_WORKER_SECRET` | Cleanup scheduler bearer | Yes |
| `FINDIT_TOUR_CACHE_WORKER_SECRET` | Cache scheduler bearer | Yes |
| `FINDIT_TOUR_OBSERVABILITY_WORKER_SECRET` | Observability scheduler bearer | Yes |
| `TOUR_PROCESSOR_URL` | External processor endpoint | No |
| `TOUR_PROCESSOR_SECRET` | Processor HMAC secret | Yes |
| `TOUR_PROCESSING_CALLBACK_URL` | Processing callback | No |
| `TOUR_CACHE_PURGE_URL` | Optional external CDN purge endpoint | No |
| `TOUR_CACHE_PURGE_SECRET` | Optional purge credential | Yes |

Worker secrets must be independently random and stored only in Supabase and the
approved scheduler. No service-role or worker credential may use a `VITE_`
prefix.

## Hosted Auth hardening preflight

`npm run verify:hosted-auth-hardening` is read-only. It requires an explicit
project target and a process-only Supabase Management API token. Production
expectations include:

- `FINDIT_ALLOW_HOSTED_AUTH_PREFLIGHT` to explicitly authorize the read-only check;
- `FINDIT_EXPECT_AUTH_SITE_URL` and `FINDIT_EXPECT_AUTH_REDIRECT_URLS` for exact URL checks;
- `FINDIT_EXPECT_PASSWORD_MIN_LENGTH` and `FINDIT_EXPECT_LEAKED_PASSWORD_PROTECTION` for password policy;
- `FINDIT_EXPECT_TOTP_MFA`, `FINDIT_EXPECT_AUTH_CAPTCHA`, and `FINDIT_EXPECT_CUSTOM_SMTP` for account hardening;

- canonical HTTPS site URL and exact redirect allowlist;
- email confirmations enabled;
- password minimum length at least 12 with the approved character policy;
- leaked-password protection enabled;
- TOTP enrollment and verification enabled;
- CAPTCHA/bot protection enabled;
- custom SMTP and verified sender configured;
- Google OAuth published and callback-tested when shown;
- Apple OAuth false;
- anonymous Auth false;
- direct phone signup false.

The available repository connector does not modify these provider settings.
They must be configured by an authorized project owner and then verified with
the preflight command.

## Operations and test-only variables

Key safeguards include:

- `FINDIT_EXPECTED_PROJECT_REF` for exact-target protection;
- `FINDIT_ALLOW_HOSTED_SMOKE=staging` before destructive staging smoke;
- `FINDIT_SUPABASE_ACCESS_TOKEN` as a process-only Management API token;
- `FINDIT_SMOKE_ORIGIN` for exact hosted origin checks;
- `FINDIT_EXPECT_GOOGLE_OAUTH` and `FINDIT_EXPECT_APPLE_OAUTH` for provider
  assertions;
- explicit hosted backup and founder-session opt-ins documented by the related
  scripts.

Validation is always `npm run validate:env`. Production Peek additionally
requires the browser/backend/worker switches, processor mode, acceptance ID and
all relevant worker secrets to agree.
