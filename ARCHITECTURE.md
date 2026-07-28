# FindIt Architecture

Status: current implementation and target-direction record; not a production
architecture approval. Last reviewed: 2026-07-26.

## System shape

FindIt is a React/Vite single-page marketplace. The browser application uses
React Router for public, authenticated, and administrative routes; TanStack
Query for remote data; and local/context state for authentication and UI
preferences.

| Layer | Current implementation | Target state |
|---|---|---|
| Web application | React/Vite SPA under `src/`; active graph only | Retain stable V1 routes and UX |
| Authentication | Supabase Auth plus `public.users` profile | Production SMTP/session acceptance |
| Authorisation | Supabase RLS and protected role/domain RPCs | Repeat the accepted staging matrix in production |
| Data access | All active marketplace, admin, messaging, notification and profile routes use Supabase repositories/services; no Base44 source caller remains | Domain services/repositories with stable page contracts |
| Database | Twenty-nine Supabase migrations, 49 tables, 4 views, 64 public policies and 6 Storage policies; clean reset, lint and 258 pgTAP assertions pass. Future legal and deferred-commerce tables are browser-fail-closed while service-role reconciliation remains. The earlier 13-migration checkpoint has a disposable restore rehearsal | Stable, production-upgrade-tested schema with imported-data reconciliation and current provider recovery evidence |
| Server operations | Four hosted Edge Functions, protected domain RPCs and two GitHub scheduler jobs | Add production monitoring/alert destinations |
| Storage | Two hosted private buckets with signed delivery, metadata sanitization, trusted attachment and lifecycle cleanup | Repeat in production; add scanning only if approved |
| Deployment/operations | Supabase staging and GitHub workflows configured; private-repo Pages plan blocked | Select frontend host/domain and separate production environment |

## Current runtime boundaries

`src/lib/supabaseClient.js` is the SDK client boundary. `src/services/
authService.js` owns the current Supabase Auth calls. `AuthContext` exposes a
stable application-facing auth shape; `ProtectedRoute` performs fresh
Supabase database role checks for admin routes. Public listing/search services
preserve stable page-facing contracts while repositories own explicit
PostgREST projections and predicates.

Dormant/future marketplace, legal, payment, verification, rich support, bulk
and AI source modules were removed. Git commit `55a5807` is the recovery archive.
The current source/package/export/config elimination gate and generated-output
scan prevent Base44 from returning.

## Trust boundaries

- Browser code may use the Supabase anon key and must never receive a
  service-role, provider, or storage-administration secret.
- RLS is required for ordinary table access; privileged, transactional,
  provider, financial, and side-effecting operations require a reviewed
  server boundary.
- `public.users` extends `auth.users` by the same UUID. The V1 public/owner
  mutation policies and admin predicates require an active account; broader
  legacy Base44 workflows still require their own cutover and acceptance.
- The minimum V1 listing-image path is operational locally. Browser roles
  cannot mint trusted upload intents; the Edge Function inspects bytes and the
  database/Storage policies enforce ownership and publication state. No other
  asset class is approved for migration yet.

## Migration direction

1. Complete production provider, SMTP, redirect, account-transition and
   session-lifecycle acceptance for the Supabase-only V1 identity boundary.
2. Preserve the active-route/build Base44 gates while migrating or archiving
   retained dormant/future modules.
3. Extend the verified Phase 4 listing-image pattern only after approving the
   privacy, validation and lifecycle requirements for each additional asset class.
4. Keep payments and AI disabled; the V1 production gate and database now fail
   closed until a future reviewed server/provider contract exists.
5. Deploy and monitor the local notification/media workers, then replace
   retained functions, email, SMS, integrations, and scheduled work
   with reviewed server-side implementations.

The historical archive assessment is retained in `ARCHITECTURE_REVIEW.md`.
Current readiness and acceptance evidence live in `PROJECT_STATUS.md`,
`QA_STATUS.md`, and `PRODUCTION_READINESS_REPORT.md`.
