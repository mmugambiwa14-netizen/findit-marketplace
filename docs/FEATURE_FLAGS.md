# Feature Flags

Reviewed: 2026-07-31

Feature flags expose only implemented, provider-configured and accepted product
contracts. A flag never makes missing architecture safe.

## Required Zimbabwe-first V1 flags

| Flag | Production state | Dependency |
|---|---:|---|
| `VITE_FEATURE_BUSINESS_PROFILES` | `true` | Public projection and trusted profile media |
| `VITE_FEATURE_MESSAGING` | `true` | Conversation RPCs, participant checks and RLS |
| `VITE_FEATURE_ESSENTIAL_NOTIFICATIONS` | `true` | Notification queries, fanout jobs and worker |
| `VITE_FEATURE_GOOGLE_OAUTH` | `true` only after provider acceptance | Supabase Google provider and exact callbacks |
| `VITE_FEATURE_MAPS` | `true` | MapLibre GL JS 5.12.0 and protected MapTiler key |
| `VITE_FEATURE_MANUAL_LOCATION` | `true` | Active country/province/city hierarchy |
| `VITE_FEATURE_CURRENT_LOCATION` | `true` after registry certification | Explicit user consent, Supabase/PostGIS registry lookup and manual fallback |
| `VITE_FEATURE_REPORTING` | `true` | Marketplace report RPC and moderation |

The current-location control resolves device coordinates through the
first-party Supabase/PostGIS registry to a supported public country, first-level
administrative area and populated place. It does not persist exact coordinates
through the selector. Manual selection remains available and country choice is
never locked by the detected result.

## Peek release boundary

A released Peek environment aligns all of these layers:

- `VITE_FEATURE_TOURS=true`
- `VITE_FEATURE_TOURS_PREVIEW=false`
- `VITE_FEATURE_PREVIEW_FIXTURES=false`
- `VITE_PREVIEW_AUTH_BYPASS=false`
- `TOURS_BACKEND_ENABLED=true`
- `FINDIT_TOURS_WORKERS_ENABLED=true`
- approved `FINDIT_TOUR_PROCESSOR_MODE`
- `FINDIT_TOURS_RELEASE_ACCEPTED=true`
- valid `FINDIT_TOURS_ACCEPTANCE_ID`
- cleanup, cache, observability and notification worker secrets
- enabled staging/production database controls

Browser routes remain usable when optional Peek playback is unavailable; Peek
must never become a canonical listing-page dependency.

## Forced-off incomplete contracts

These must remain `false` until their complete customer, provider, database,
privacy and test boundaries are implemented:

- `VITE_FEATURE_CURRENCY_CONVERSION`
- `VITE_FEATURE_PHONE_VERIFICATION`
- `VITE_FEATURE_INTERNATIONAL_LISTING`
- `VITE_FEATURE_SERVICE_RADIUS`

The current release is Zimbabwe-first. Schema capability for more countries is
not equivalent to an approved international publishing flow.

## Deliberately deferred V1 capabilities

The production validator also requires these to remain false:

- payments
- subscriptions
- escrow
- premium listings
- AI moderation
- AI ban-evasion detection
- AI ticket triage
- AI support chat
- scheduled reminders
- marketing emails
- listing expiry
- listing freshness reminders
- Apple OAuth
- legal booking/payment commerce

Dormant tables or queues may remain fail-closed for future work. They do not
constitute an active feature.

## Maps activation

Maps use MapLibre GL JS `5.12.0` and MapTiler Cloud styles and tiles. Device
location does not use MapTiler geocoding. Before enabling a map deployment:

1. Create a separate MapTiler browser key for that environment.
2. Restrict it to the exact approved origins.
3. Set `VITE_MAPTILER_PUBLIC_KEY` and the approved
   `VITE_MAPTILER_STYLE_ID`.
4. Configure CSP for the pinned MapLibre runtime and MapTiler endpoints, or
   self-host the pinned runtime files.
5. Test map loading, permission denial, location-registry failure and list-view
   fallback.
6. Configure quota, abuse and cost alerts.

## Activation process

1. Approve scope and operational owner.
2. Implement server, storage, RLS and privacy boundaries.
3. Add source, SQL, API, scale and browser tests.
4. Configure provider keys and secrets in the correct environment.
5. Pass `npm run validate:env`, source contracts, typechecks and production
   build.
6. Enable in staging and observe workers, errors and costs.
7. Record acceptance before production activation.

No deferred capability may be activated by changing a browser variable alone.
