# FindIt Architecture Review

Date: 2026-07-17  
Reviewed state: authoritative Phase 2B archive  
Related evidence: `FindIt_Technical_Audit.md` and
`PHASE_0_TO_2B_VERIFICATION.md`

> **Current-state addendum — 2026-07-26:** the detailed sections below retain
> the authoritative archive baseline. Since that baseline, the repository has
> 171 JS/JSX/TS/TSX source modules, 76 component modules, 32 page modules,
> 29 service modules, and 15 repository modules. Migrations `0001`–`0029`
> passed the clean local suite; migration `0030` is deployed and linted on
> hosted staging, with local replay pending Docker recovery. The schema has
> 49 RLS-enabled public tables, 64 public policies and
> 6 Storage policies, with 258
> focused database assertions passing. Supabase now owns Auth, all six active
> V1 admin pages, public Home/Search/listing-detail reads, active Location reads,
> Favourites, listing reports, owner/profile/seller, V1 services and lightweight
> business/dealer profiles. Lightweight Help/Contact Support now uses a
> purpose-built founder inbox rather than the retained legacy ticket suite.
> Minimal messaging is implemented behind its flag
> and passes the current build plus SQL/contracts/API smokes, but targeted
> browser acceptance is blocked because no in-app browser instance is
> available. Essential notifications now use trusted five-event Supabase RPCs
> with owner-only read state, safe links and a service-only expiry worker;
> build/SQL/contracts/API checks pass, while browser and deployed scheduling
> acceptance remain. V1 product creation and its minimum private listing-image
> path now use an atomic submission RPC, state-aware moderation, one Edge
> Function and signed Storage reads. Service-photo creation and business/dealer-
> logo management use the same shared trusted-image validation through a second
> purpose-bound Edge Function. Product and service edit forms now use atomic
> media replacement RPCs with staged-object cleanup. The shared upload boundary
> strips common JPEG/PNG/WebP privacy metadata and trailing payloads before
> hashing/storage; format contracts and real HTTP smokes pass. UI browser,
> full re-encoding/scanning and hosted operations remain. A recursive graph
> contract proves every module reachable from `src/App.jsx` is Base44-free,
> and the production build verifier currently finds zero Base44 across 109
> generated text assets. The remaining 79 Base44 client imports are classified
> dormant/future in `BASE44_DEPENDENCY_MAP.md`; they keep the SDK installed
> pending approved migration/archive work and are not evidence that these
> bounded replacements failed.
>
> The active route manifest is intentionally narrower than the archive:
> Home, Search, three listing details, seller/services/help, protected Post,
> My Listings, Favourites, Profile, Settings and gated V1 readiness routes,
> plus six admin destinations. Legal, payment, verification, bulk, analytics,
> and other non-V1 routes remain dormant source. `FINDIT_MVP_V1_SPECIFICATION.md`
> is authoritative for this scope; the older route tables below document the
> archive rather than the current launch surface.

## 1. Scope and confidence

The Phase 2B tree contains 294 source files, including 80 page modules and
173 component modules. The Base44 export contains 40 entity definitions, 59
function implementations, and three agent definitions. Twelve ordered
Supabase migrations are present.

The source and build configuration were inspected and the production bundle
was built. No production tenant, data export, deployed URL, configured
Supabase project, email/SMS/OAuth provider, or storage inventory was
available. Statements about live behavior are therefore marked unverified.

## 2. System context

FindIt is a Zimbabwe-focused React marketplace used by guests, registered
buyers/sellers, service providers, legal practitioners, support personnel,
administrators, and super-administrators.

The current architecture is intentionally hybrid:

1. React/Vite browser application.
2. Supabase Auth for the Phase 2A/2B login, session, registration, email
   confirmation, and password-recovery paths.
3. Base44 SDK for remaining user/profile reads, entity CRUD, uploads,
   integrations, 59 hosted functions, and three hosted AI agents.
4. Proposed Supabase Postgres schema/RLS in migrations `0001`-`0012`, not yet
   successfully applied or used by a Phase 3 service layer.

There is no separately deployed application server, checked-in Supabase Edge
Function tree, worker, scheduler, or provider-neutral integration layer.

## 3. Frontend architecture

### Entry and composition

- `src/main.jsx` mounts the SPA.
- `src/App.jsx` composes Auth, currency, TanStack Query, React Router, and
  toast providers.
- `AppLayout` serves public/user pages; `AdminLayout` serves administration.
- `ProtectedRoute` gates authenticated routes and uses Supabase database role
  predicates for admin routes.
- Page modules live under `src/pages`; feature and UI components live under
  `src/components`.

The organization is conventional and should be preserved. Migration should
replace infrastructure behind existing routes and components rather than
redesigning navigation or workflows.

### Routing

| Access | Active route families | Gate |
|---|---|---|
| Public auth | `/login`, `/register`, `/forgot-password`, `/reset-password` | None |
| Public marketplace | `/`, `/search`, three listing details, seller, services/service detail, help | `AppLayout` |
| Registered user | Post listing/service, My Services, Favourites, Profile, My Listings, Settings; messaging/business/notifications only behind readiness flags | Supabase-backed `ProtectedRoute` plus `AppLayout` |
| Admin | overview, marketplace, users, reports, categories, audit log | `ProtectedRoute requiredRole="admin"` plus `AdminLayout`; Supabase role predicates and audited operations |
| Dormant source | Legal, payment, verification, bulk, analytics, support-suite, location-admin and other non-V1 routes | Not registered by `App.jsx`; retained for classified future/deferred work |
| Retained but unrouted | Several legacy support/detail pages | No active route; production use unknown |

`BrowserRouter` requires the production host to rewrite unknown paths to
`index.html`. No hosting configuration proves this behavior.

### State management

| State | Mechanism | Persistence / risk |
|---|---|---|
| Auth session/profile | `AuthContext` plus `authService` | Supabase session; profile from `public.users`; outages currently look like guest state |
| Server/entity data | TanStack Query around Supabase services for migrated public listing/Location/Favourite/Report paths and Base44 for retained paths | Hybrid until the remaining domain slices are cut over |
| Currency | `CurrencyContext` | Truthful USD-only V1 compatibility contract; no remote rate/profile write |
| Forms/wizards | Local React state, selected React Hook Form/Zod | Listing/bulk flows hold substantial transient state |
| Realtime | Base44 entity subscriptions | Replacement is Phase 3/6 and unverified |
| Theme/responsive state | Browser hooks/UI libraries | Must be preserved; not migration-critical |

No Redux-style application store is present. The existing context/query/local
state split does not need redesign merely to migrate platforms.

## 4. Backend and service architecture

### Current runtime boundaries

- `src/api/base44Client.js` constructs the Base44 SDK client using app ID,
  access token, function version, and app base URL from `app-params.js`.
- `src/services/authService.js` owns Supabase Auth. Listing, Location,
  Favourite and Report services/repositories own the migrated public slice.
- `src/lib/supabaseClient.js` creates a browser Supabase client using the
  public URL and anon key.
- `src/repositories/` contains four explicit Supabase data boundaries; pages
  do not import the Supabase client directly.
- Base44 functions remain the server-side boundary for privileged actions,
  notification/email/SMS side effects, analytics, automation, and selected
  orchestration.

### Service migration direction

Phase 3 should introduce narrow domain services/adapters behind the existing
page contracts. Ordinary owner operations may call RLS-protected tables.
Privileged, transactional, multi-row, financial, provider, and side-effecting
operations require reviewed RPCs/Edge Functions or another server boundary.

No generic browser "service role" emulation is acceptable. The Supabase
service-role key must never be shipped to the client.

## 5. Entity and database architecture

Phase 1 proposes a relational replacement for the 40 Base44 entities:

- Identity/operations: users, admin teams, presence, audit.
- Locations: locations and neighbourhoods.
- Marketplace: normalized listings plus car/property/machinery details,
  engagement, inquiries, alerts, reviews, ratings, and business profiles.
- Services/legal: services, bookings/disputes, practitioners,
  specializations, legal bookings, practitioner reviews.
- Verification/moderation, payments, support, and content tables.

Car, Property, and Machinery share `listings` and category detail tables, with
compatibility views intended to restore the old shapes. Email-shaped legacy
relationships become UUID foreign keys.

At the reviewed archive checkpoint, all twelve migrations applied cleanly,
database lint passed, all then-current 41 exposed tables enabled RLS,
compatibility views used `security_invoker`, protected user fields were
enforced, and 22 focused pgTAP assertions passed. The current metrics are in
the dated addendum above. The database is not production-accepted: the complete
role/action/column matrix, production-like upgrade, ETL/reconciliation,
rollback and restore evidence remain incomplete.

`service_bookings.practitioner_id` remains intentionally unconstrained because
the legacy value may identify different provider types. Production data and a
product decision are required before choosing a target relationship.

## 6. Authentication flow

### Implemented Phase 2A/2B flow

Registration:

1. `Register.jsx` validates email, password, confirmation, and phone.
2. `authService.signUp` sends phone/full-name metadata to Supabase Auth.
3. Migration `0012` copies phone into `public.users` from the auth-user
   creation trigger; the local Auth API smoke flow verifies it.
4. The UI displays a link-confirmation state and offers resend.

Login/session:

1. `Login.jsx` calls Supabase email/password or OAuth sign-in.
2. `AuthContext` reads the Supabase session and corresponding `public.users`
   row.
3. Suspended/banned profile status renders `AccountBlocked` in the UI.
4. Ordinary protected routes trust the context; admin routes additionally
   query Supabase `is_admin()` / `is_super_admin()` predicates.

Password recovery:

1. `ForgotPassword.jsx` requests a Supabase recovery email and always shows a
   non-enumerating success message.
2. `ResetPassword.jsx` requires a matching `PASSWORD_RECOVERY` event before
   calling `updateUser({password})`; an ordinary session is insufficient.

Logout clears the Supabase session and optionally redirects.

### Auth architecture gap

The Base44 client reads a separate `base44_access_token`. Supabase login and
signup do not create that token. The app therefore has two independent
identity planes during the hybrid phase. Admin gating, phone verification,
listing creation, profile updates, and many data workflows can attempt
Base44-authenticated calls after only a Supabase session exists.

This gap blocks claiming that the intermediate application preserves working
behavior. It must be resolved by a coordinated, testable migration strategy,
not by assuming that both environment configurations imply shared identity.

## 7. Authorization flow

Authorization currently has three layers:

1. UI route checks in `ProtectedRoute`.
2. Base44 server/entity authorization for existing runtime operations.
3. Proposed Postgres RLS and helper functions for future Supabase operations.

The UI is not a security boundary. The proposed database policies require
hardening and live role/action tests before any browser service cutover.
Suspended/banned enforcement must also exist at the server/database boundary,
because the current Supabase session remains valid when the UI shows the
blocked-account screen.

## 8. Storage

Uploads currently use Base44 `UploadFile`/extraction integrations. Callers
include listing photos/documents, identity and verification files,
practitioner credentials, business logos, bulk inputs, and support
attachments.

The active V1 image paths now have two checked-in private buckets, six object
policies, purpose-bound upload/media metadata, actual-byte JPEG/PNG/WebP
validation, size/dimension/hash/ownership checks and signed delivery after
publication. Malware/content scanning or an approved image-only exception,
full re-encoding, derivatives, cleanup/retention, hosted
operations and object reconciliation are not complete. Product photos,
service photos and business/dealer logos are covered; retained/deferred upload
classes remain on the legacy path. Sensitive identity/credential
material must not be moved into the listing bucket.

Storage remains a partially completed Phase 4 domain. Continued Base44 use by
retained/deferred asset classes is planned, not evidence that the verified V1
image slices failed.

## 9. Notifications and asynchronous work

The app includes in-app alerts, support messages, email templates, follower
and listing notifications, verification/admin notifications, ticket emails,
phone OTP, listing expiry, and reminder/marketing concepts.

These depend on Base44 functions/agents or unimplemented providers. There is
no independent queue, transactional outbox, scheduler, retry/dead-letter
policy, idempotency layer, or delivery telemetry. Phase 6 must preserve both
the visible state and the side effects/failure behavior.

## 10. Integrations

| Integration | Current evidence | Planned state |
|---|---|---|
| Base44 | SDK, config, app token, 40 entity contracts, 59 functions, three agents; Vite plugin removed | Remove remaining runtime only after verified replacements |
| Supabase | Browser client, Auth plus seven services/four repositories, 12 locally applied migrations | Bounded paths verified locally; production acceptance pending |
| Google/Apple OAuth | Buttons and Supabase provider calls | Provider configuration and redirects unverified |
| Email | Supabase auth email plus Base44 notification functions | Staging SMTP/auth templates plus independent transactional provider |
| SMS | Base44 phone OTP functions | Rate-limited independent provider; design blocked |
| Maps/geocoding | Leaflet and helper calls | Provider/key/quota/terms behavior unverified |
| Payments/mobile money | UI/schema/contracts retained; flags default off | Phase 5, server-only intents/webhooks/reconciliation |
| AI | Oppah, support agent, Tintin and function call sites | Phase 6; keep feature flags off until privacy/safety/cost controls exist |

## 11. Feature flags

`src/lib/featureFlags.js` keeps payment, subscriptions, escrow, premium
listings, AI moderation/triage/support, scheduled reminders, and marketing
features fail-closed by default. `docs/FEATURE_FLAGS.md` accurately records the
design intent at this phase. A flag does not substitute for a replacement
implementation or behavior verification.

## 12. Deployment and operations

The Vite production bundle compiles. The repository does not contain verified
CI/CD, infrastructure as code, host rewrites, environment promotion,
Supabase migration deployment, Edge Function deployment, secrets management,
monitoring/alerting, backup/PITR, restore drills, incident runbooks, or rollback
automation.

Production readiness is therefore blocked independently of frontend build
success.

## 13. Decisions to preserve

- Preserve routes, layouts, page hierarchy, field meanings, and user-visible
  workflows.
- Keep Base44 runtime dependencies until their specific phase has a verified
  replacement; do not delete them based on package/import counts alone.
- Keep payments and AI code feature-flagged rather than removing it.
- Use additive, ordered migrations and reviewed forward fixes.
- Introduce adapters and domain services incrementally, with contract tests.
- Keep privileged and side-effecting operations behind a server/database
  security boundary.
- Do not transform production data until mappings and reconciliation are
  approved.

## 14. Document 2 target architecture contract

Document 2 makes the intended separation explicit:

`Page -> Hooks -> Services -> Repositories -> Supabase client -> PostgreSQL`

The reviewed tree partially implements that target. Pages do not call
Supabase directly; domain services/repositories cover Auth and the public
listing/Location/Favourite/Report plus creation/media, owner/profile/seller/services/admin/business and feature-gated messaging/notification slices. Another 79 files
still call the Base44 client directly. Those calls are scheduled migration
inputs, not evidence that the verified bounded replacements should be redone.

Future cutovers should proceed one domain at a time: repositories own data
access and query shapes, services own business rules and orchestration, hooks
own reusable UI state, and pages compose workflows. Authorization remains in
RLS/trusted server operations rather than any of these browser layers.

The approved V1 model uses one normal account role, admin capabilities, and
business/dealer profile types; lawyer functionality is outside V1. Remaining
policies and screens must be reconciled to that model during their cutovers.
See `USER_ROLE_RECOMMENDATIONS.md`, `DOCUMENT_2_COMPLIANCE_REVIEW.md`,
`docs/SECURITY_REVIEW.md`, `docs/ENVIRONMENT_VARIABLES.md`, and
`docs/STORAGE_MIGRATION_INVENTORY.md`.

## 15. Conclusion

The archive is a real Phase 2B migration state, not an untouched Base44
export. Phase 0 repository discovery is now complete and the local database,
Auth and bounded public marketplace evidence are recorded. Production tenant
observation, the complete authorization matrix, hybrid owner/admin cutover,
data reconciliation, provider/staging behavior and operations remain explicit
acceptance blockers rather than undocumented assumptions.
