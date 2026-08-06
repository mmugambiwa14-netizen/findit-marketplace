# FindIt — Base44 Migration Log

## Final V1 engineering checkpoint — 2026-07-26

The approved V1 code migration is complete. Base44 SDK/source/export/config
dependencies are removed and enforced absent. Supabase staging has migrations
`0001`–`0030`, two private buckets and four Edge Functions. All guarded hosted
domain, storage and worker suites pass. Broad typecheck, lint, 78 contracts,
production audit and build/budget gates pass.

Production launch remains gated by frontend hosting/domain, browser/device
acceptance, SMTP, optional OAuth, monitoring, native recovery/PITR and the
fresh-launch versus legacy-data decision. See `PROJECT_STATUS.md`; historical
phase notes below remain the audit trail.

This is the living record of the migration off Base44. Every entry below
documents: what was removed/added, why, what replaced it, any schema impact,
and what (if anything) remains to be done. Update this file in the same
commit/step as the change it describes — it should never fall behind the
actual codebase.

Related docs: [`docs/DATABASE.md`](../DATABASE.md) ·
[`docs/FEATURE_FLAGS.md`](../FEATURE_FLAGS.md) ·
[`FindIt_Technical_Audit.md`](FindIt_Technical_Audit.md) (original audit) ·
[`PHASE_0_TO_2B_VERIFICATION.md`](PHASE_0_TO_2B_VERIFICATION.md) ·
[`ARCHITECTURE_REVIEW.md`](ARCHITECTURE_REVIEW.md) ·
[`FEATURE_INVENTORY.md`](FEATURE_INVENTORY.md) ·
[`BASE44_DEPENDENCY_MAP.md`](BASE44_DEPENDENCY_MAP.md) ·
[`BEHAVIOUR_BASELINE.md`](BEHAVIOUR_BASELINE.md) ·
[`MIGRATION_RISKS.md`](MIGRATION_RISKS.md) ·
[`DOCUMENT_2_COMPLIANCE_REVIEW.md`](DOCUMENT_2_COMPLIANCE_REVIEW.md) ·
[`docs/SECURITY_REVIEW.md`](../SECURITY_REVIEW.md) ·
[`docs/ENVIRONMENT_VARIABLES.md`](../ENVIRONMENT_VARIABLES.md) ·
[`docs/STORAGE_MIGRATION_INVENTORY.md`](../STORAGE_MIGRATION_INVENTORY.md) ·
[`DOCUMENT_3_PRODUCTION_READINESS_REVIEW.md`](DOCUMENT_3_PRODUCTION_READINESS_REVIEW.md) ·
[`BUG_INVENTORY.md`](BUG_INVENTORY.md) ·
[`TECHNICAL_DEBT.md`](../../TECHNICAL_DEBT.md) ·
[`QA_STATUS.md`](../../QA_STATUS.md) ·
[`REPOSITORY_FILE_CLASSIFICATION.md`](REPOSITORY_FILE_CLASSIFICATION.md)

> **2026-07-18 authoritative verification:** the earlier entries below are
> retained as implementation history. Their words "complete" and "done" did
> not originally include a successful SQL apply or live browser/auth
> verification. Those local gates now pass for the current database and core
> Supabase Auth paths. The
> corrected current statuses are in the table below, the historical evidence
> is in `PHASE_0_TO_2B_VERIFICATION.md`, and the Phase 0-3 closure evidence is
> in `PHASE_0_TO_3_CLOSURE_AUDIT.md`. Phase 2C began only after clean-local
> validation. Phase 3 now includes verified authenticated owner-listing,
> profile/settings, public seller, services, and active V1 administration
> slices. Phase 2D's source/local boundary is now closed with zero runtime
> `base44.auth.*` operations; production provider/session acceptance and the
> separately classified Base44 data/function workflows remain.

> **2026-07-17 specification Document 2 review:** target architecture,
> security, environment, RBAC, storage, performance, and UI requirements were
> checked against the same authoritative baseline. The review adds discovery
> documentation only; no application, SQL, dependency, or auth-flow change is
> claimed. Documents 3-4 have now been reviewed; production/staging evidence
> remains outstanding.

> **2026-07-17 specification Document 3 review:** the whole repository was
> classified and production-readiness, bug, debt, QA, deployment, backup/DR,
> and observability records were added. Bounded lint, dependency, SQL/RLS, and
> local Supabase configuration fixes are recorded below. The release checks
> now include a non-secret `validate:env` guard that rejects missing,
> placeholder, malformed, or production-insecure browser configuration. A
> clean database reset, database lint, 22 initial focused pgTAP assertions, and
> local Auth API smoke flow then passed. The current Phase 1 suite has since
> expanded to 95 assertions. Document 4 handover reports now exist, while
> most browser/workflow/deployment acceptance evidence remains outstanding.

---

## Migration principles (agreed direction)

1. Preserve functionality first — eliminate Base44, don't redesign the product.
2. Disable instead of delete for payments/AI/subscriptions/escrow — feature
   flags and dormant schema, not deletion.
3. Introduce a proper service layer; the frontend never talks to Supabase
   directly.
4. Preserve routing, layout, navigation, and UX unless there's a clear
   technical reason to change it.
5. Only remove code confidently classified as unreachable/duplicate/obsolete/
   unused. When uncertain, archive (see "Archived files" below) rather than
   delete.
6. Database: replace email-based references with UUID foreign keys, add
   indexes/constraints/normalization — without redesigning business workflows.
7. Every replacement should be more secure than the Base44 original (RLS,
   server-side auth checks, upload validation, rate limiting, audit logging).
8. Performance and bundle-size improvements where practical, without changing
   functionality.

---

## Status

| Phase | Status | Notes |
|---|---|---|
| 0 — Discovery | Complete | Audit, route, feature, dependency, data, storage and MVP-scope documents reflect the authoritative Phase 2B archive and the final V1 repository. Missing Base44 production exports are recorded as an external data decision, not hidden implementation work. |
| 1 — Database foundation | Complete for V1 | Migrations `0001`–`0030` deploy to `FindIt Staging`; hosted schema lint and targeted RLS/API suites pass. All 49 public tables have RLS. Native isolated restore/PITR and a separate production project remain release operations. |
| 2 — Auth cutover | Complete for V1 backend/source | Supabase Auth is the only identity boundary. Signup, confirmation/profile creation, sign-in, authorization, logout and recovery boundaries pass hosted targeted inspection. Production SMTP and deployed-browser lifecycle acceptance remain launch gates. |
| 3 — Service layer + frontend cutover | Complete for approved V1 | Public and owner listings, profiles, favourites, services, admin, business/dealer profiles, minimal messaging, essential notifications and Contact Support use Supabase services/repositories. No Base44 source or runtime dependency remains. |
| 4 — Storage & uploads | Complete for approved V1 | Two private buckets, six Storage policy declarations, metadata/intent ledgers and two authenticated upload Edge Functions protect product, service and business/dealer images. Hosted creation, replacement, moderation, signed reads and cleanup pass. Scanner/full re-encoding/derivatives are documented future hardening. |
| 5 — Payments (re-enable path) | V1 safe deferral complete | Payments, subscriptions, escrow and premium functionality default off, have no active route/module graph, and are rejected by the production environment gate if enabled. Stripe browser packages were removed. Migration `0029` removes all `anon`/`authenticated` policies and table grants from retained reconciliation tables while preserving service-role access. |
| 6 — Notifications, email, SMS, AI | Approved V1 scope complete | Five essential event classes, owner read state, safe links and the idempotent listing-expiry worker pass hosted checks. Email, SMS, marketing notifications and AI are intentionally deferred. GitHub scheduling cannot operate until the account-level Actions startup restriction is resolved. |
| 7 — Security & performance pass | Complete for approved V1 | Production audit, lint, full/scoped typechecks, 78 contracts, generated-output/Base44 scan, bundle budgets, schema lint, hosted adversarial suites and 130-fixture stable search pass. Browser/device/accessibility and production monitoring remain launch acceptance. |
| 8 — Testing & deployment | Engineering complete; production launch blocked | GitHub `main` and Supabase staging are provisioned; all migrations and four Edge Functions are deployed and hosted domain suites pass. GitHub Actions terminates valid workflows as `startup_failure` before jobs, and private-repository Pages is unsupported on the current plan. Frontend hosting/domain, SMTP, browser matrix, monitoring and native recovery remain external launch gates. |

Document 2 compliance is tracked separately from phase completion in
`DOCUMENT_2_COMPLIANCE_REVIEW.md`; its dated checkpoints should be read with
this final status, `ARCHITECTURE.md` and `docs/SECURITY_REVIEW.md`.

Document 3 production acceptance is tracked in
`DOCUMENT_3_PRODUCTION_READINESS_REVIEW.md` and `QA_STATUS.md`. Approved V1
engineering migration is complete and the broad typecheck passes. Production
launch is still rejected until the external release gates in
`PRODUCTION_READINESS_REPORT.md` are closed.

---

## Approved V1 scope reconciliation and launch-surface gate

**Date:** 2026-07-17  
**Scope:** product-scope reconciliation plus a bounded, reversible frontend
runtime gate. No database row, Supabase migration, storage object, provider,
or production environment was changed.

**What changed:**

- `FINDIT_MVP_V1_SPECIFICATION.md` is now the authoritative product scope.
  The supporting feature, database, role, admin, UI/UX, flow, screen,
  component, design, and migration plans were reconciled to lightweight
  Business Profiles/dealer pages, minimal plain-text messaging, essential
  notifications, stronger Search, six final admin destinations including
  Categories, and total exclusion of legal features from V1.
- `src/App.jsx` now registers only the approved implemented route surface plus
  three required-MVP migration-readiness routes. Pricing, market insights,
  agent/dealer directories, valuation, bulk tools, transaction history,
  verification, legal, payment/subscription, analytics, support-suite, content,
  and other non-V1 admin routes are no longer registered. Dormant source was
  preserved.
- Business Profiles, messaging, and essential notifications have explicit
  default-off migration-readiness flags. They are required for V1 launch but
  cannot expose the legacy Base44-backed screens before Supabase acceptance.
  Production environment validation requires all three flags to be `true`.
- Marketplace navigation now uses Home, Search, Post, Favourites, and Account
  on mobile, with a restrained desktop Browse/Services/Post/Account surface.
  All admin navigation variants share one configuration containing the six
  implemented V1 destinations, including the protected Categories page.
- The app shell no longer subscribes to legacy support messages or AppAlert
  realtime events, plays notification sounds, or calls Base44 pending-counts
  merely to render navigation.
- Home no longer claims verified sellers or “Zimbabwe's #1,” links to a dealer
  directory, repeats Hot/New promotional sections, or uses rotating/gradient
  hero decoration. Help no longer promises payments, premium packages,
  verification, price alerts, or a guaranteed moderation response time.

**Verification at the launch-surface checkpoint:** `npm run lint` and
`npm run build` pass. Development environment validation passes with isolated
non-secret local values. Local rendered-browser checks confirm the revised
Home and Help surfaces and that `/pricing` returns the Not Found screen.

The later first repository slice exposed that the broad `npm run typecheck`
claim was inaccurate: it currently fails on the untyped legacy UI/dependency
graph. `npm run typecheck:migration` now provides a passing, explicit gate for
the migrated Supabase client, auth service, listing mapper/service, and
repository while the broad baseline remains tracked debt.

**Still incomplete:** Home, Search, public details, shared Favourite controls,
location reads, and listing reports are cut over, but owner listing writes and
the remaining data-backed marketplace screens still require repository/service cutover. Public Business/Dealer pages, minimal messaging, and essential
notifications are required MVP work, not completed features. Authenticated,
mobile, full direct-route/network, shared-provider, and production tests remain.

---

## Phase 3 — first public listing read adapter

**Date:** 2026-07-17  
**Scope:** Home's latest Property, Car, and Machinery reads only. This is a
bounded implementation checkpoint, not completion of the public
location/listing/search/detail vertical slice.

**What changed:**

- Added `src/repositories/publicListingsRepository.js` with an explicit public
  projection, `available` status filter, deterministic `created_at`/`id`
  ordering, per-kind limit, location relation, and normalized detail joins.
- Added `src/services/publicListingsService.js` and
  `src/services/listingMappers.js`. The mapper preserves the legacy card
  contract (`created_date`, human-readable `location_id`, `make`,
  `equipment_hours`, and coordinate shape) without leaking database structure
  into pages. Verification is deliberately not inferred or exposed in V1.
- Replaced the three direct Base44 queries in `src/pages/Home.jsx` with the
  service boundary. No SQL, database row, storage object, or production
  environment changed.
- Added four Node contract tests and a scoped migration typecheck command.

**Verification:** the exact PostgREST relationship projection returns 200
against the local migrated schema; the database currently has no listing
fixture rows. `npm run test:contracts` passes 4/4, `npm run lint` passes,
`npm run typecheck:migration` passes, and the production build passes. The
broad `npm run typecheck` remains failed due to the pre-existing legacy
JavaScript/UI graph and is recorded in `QA_STATUS.md`.

**Still incomplete:** representative/exported data, Base44-vs-Supabase contract
reconciliation, query plans, rollback evidence, error-state browser QA,
Search, details, saved-listing interactions, seller/business identity, view
counts, and all owner writes. Shared listing cards still import Base44 for
Favourites and seller-type lookup, so Home is not yet Base44-independent as a
complete runtime graph.

---

## Phase 3 — public Search, details, Favourites, and reports checkpoint

**Date:** 2026-07-17  
**Scope:** anonymous public marketplace discovery/evaluation plus the existing
authenticated Favourite/report actions. Owner listing writes and broader
profile/admin domains are not part of this checkpoint.

**What changed:**

- Added server-side public Search over the complete Supabase result set with
  explicit projections, exact counts, 24-row pages, deterministic ordering,
  category/detail/location/price filters, title/location suggestions, recent
  searches, and URL-persisted state.
- Added active Zimbabwe location repository/service reads and removed the
  Base44 location calls from the shared hierarchical selector.
- Cut Property, Car, and Machinery public detail reads to the listing service.
  Removed unsupported verification badges and client-side view mutations from
  these surfaces rather than displaying unverifiable trust signals.
- Added owner-scoped Favourite repository/service reads and writes for shared
  listing cards and all three details. Added the same control to Machinery
  cards without nesting an interactive button inside a listing link.
- Migrated listing-report state and submission to the existing Supabase
  `reports` table and RLS policies, including the legacy `car` to database
  `vehicle` type mapping.
- Removed the Base44 Vite plugin and its package. Standard Vite now owns the
  `@` alias and route-level lazy loading prevents dormant Base44 pages from
  initializing on migrated public routes. The Base44 SDK package remains for
  the deliberately retained callers outside the migrated active slices.
- Reduced Currency context to the truthful V1 USD-only contract; no stale or
  unverified exchange rate is shown or persisted.

**Verification:** local PostgREST checks return 200 for Property, Car,
Machinery and Location projections. A clean in-app Chromium session preserves
Search type/query/sort state, corrects an out-of-range empty page, opens the
full filter sheet with the correct default price range, updates the debounced
query URL, and renders a missing public detail without Base44 SDK errors. Lint,
six contract tests, and `typecheck:migration` pass. The local database has no
representative listing fixtures, so populated result rendering, >100-row
pagination, authenticated Favourite/report behavior, query plans, and
Base44-to-Supabase data reconciliation remain unaccepted.

**2026-07-25 scale addendum:** `test:search-scale-local` creates 130 disposable
public property listings and detail rows, then uses the anonymous real API
boundary to prove exact counts, deterministic 24-row pagination across six
pages, no duplicates, discovery beyond the original 100-row cutoff and
server-side detail/price filters. Teardown leaves zero matching listing/Auth
fixtures. Populated browser acceptance, production-volume query plans/latency
and Base44-to-Supabase data reconciliation remain.

---

## Phase 3 — owner listings, account profile, and public seller checkpoint

**Date:** 2026-07-18  
**Scope:** authenticated owner listing management, truthful account settings,
and the minimal public seller identity required to evaluate an offer.

**What changed:**

- Added owner-listing repository/service contracts for one bounded query plus
  owner edit, publish/pause, renew and delete operations. `MyListings` and its
  edit dialog no longer call Base44 or subscribe to its hosted entity stream.
- Added profile repository/service contracts. Settings now persists full name
  and seller bio, performs real password reauthentication/update, and labels
  email/phone/avatar capabilities truthfully instead of reporting fake saves.
- Added migration `0014_public_seller_profile.sql`, a security-definer RPC that
  returns only id, full name, bio and avatar for active sellers. Email, phone,
  role, status, verification and ban fields stay private.
- Rebuilt the public seller page around that projection and public active
  listings, removing follows, ratings, verification and unrelated complexity.

**Verification:** the owner-listing local smoke passes authenticated read,
detail join, edit, publish, delete and detail cascade. The Auth smoke still
passes after the password service change. A clean reset through migration
`0014`, schema lint, 68 database assertions, 17 contract tests, scoped
typecheck, lint and configured build pass. Authenticated Chromium verifies
owner listing publish/logout and the production-bundle guest seller page with
name, bio, one listing and contact actions. The browser check also caught a
minifier-sensitive inline JSDoc return; the repository now uses a typed local
whose return is present in the minified chunk.

---

## Phase 3 — active V1 services marketplace checkpoint

**Date:** 2026-07-18  
**Scope:** public service discovery/evaluation and authenticated provider
create/manage operations. Bookings, disputes, service favourites,
verification, uploads and all lawyer/legal features are outside V1.

**What changed:**

- Added explicit service repository/service contracts for public browse,
  debounced server-side search, detail, owner list, create, edit, status and
  delete operations.
- Migrated `Services`, `ServiceDetail`, `CreateService`, `MyServices`, the
  management card and edit dialog from Base44 to those Supabase boundaries.
- Removed unsupported V1 service verification badges, fake view increments,
  the schema-incompatible service-favourite UI and Base44 uploads. Service
  photos remain optional until the trusted storage phase.
- Kept the legal service enum as dormant future architecture while excluding
  legal from every V1 public, owner and create query/contract.
- Added migration `0015_service_owner_delete.sql` with active-owner/admin RLS
  and regression assertions for owner success and unrelated-user denial.

**Verification:** a clean reset applies all 15 migrations, SQL lint passes and
the database suite passes 72 assertions. The 21-contract suite, scoped
typecheck, lint, local service API smoke and configured production build pass.
Chromium verifies the public card/search/detail flow, contact actions, legal
category/result exclusion, authenticated owner list/pause refresh, and the
four-category V1 creation form. Disposable fixtures were removed.

**Still incomplete at this checkpoint:** minimal messaging, essential notifications, listing
creation/uploads and final
data reconciliation/acceptance remain Phase 3 work.

---

## Phase 3 — active V1 administration checkpoint

**Date:** 2026-07-18  
**Scope:** the six approved solo-founder destinations: Overview, Marketplace,
Users, Reports, Categories and Audit Log. Dormant legal, verification,
payments, subscriptions, analytics, content and support-suite admin source is
not exposed or claimed as migrated.

**What changed:**

- Added migration `0016_v1_admin_operations.sql`, the founder-managed
  `categories` taxonomy, audit reason/result/correlation evidence and narrow
  `SECURITY DEFINER` operations that re-check admin or super-admin authority.
- Added server-paginated admin repository/service/contracts for overview,
  product/service moderation, users, reports, categories and audit history.
- Role changes accept only `user`/`admin`, require a super admin and block
  self-role changes. Account status controls require a reason, block
  self-lockout, create the essential account-status notification and protect
  super admins from ordinary admins.
- Product/service publish, pause and removal actions are atomic and audited.
  Report decisions resolve related records consistently. Category IDs, slugs,
  parents and marketplace kinds are immutable; top-level categories cannot be
  deactivated; V1 exposes no delete operation.
- Replaced Base44 data/function calls in all six active admin pages and added
  the protected `/admin/categories` route. Revenue, verification, legal and
  support-suite links were removed from the active overview.

**Verification:** a clean reset applies 16 migrations, database lint reports
no schema errors and 95 pgTAP assertions pass. The 29-contract suite, scoped
typecheck, lint, authenticated local admin API smoke and configured production
build pass. Headless Chromium signs in as a real local super admin, renders all
six pages, exercises service pause and report review through the UI, confirms
required-reason gating, verifies self-account and protected-taxonomy controls,
and sees both actions with reasons in the audit log. At 390 px the sidebar is
80 px, all six links retain accessible names and the overview has no viewport
overflow. Disposable users/data and browser tooling were removed.

**Still incomplete:** shared-provider admin lifecycle/re-auth evidence,
blocked-user browser expiry/restore, production reconciliation and the
remaining Phase 3 MVP domains.

---

## Phase 3 — lightweight business/dealer profile checkpoint

**Date:** 2026-07-18  
**Implemented:** migration `0017_v1_business_profiles.sql` enforces one profile
per owner, excludes legal-firm activation, validates HTTP(S) website/social
links, requires a contact path, derives `business|dealer` presentation without
creating a role, and hides profiles owned by suspended or banned users. The
active owner page and public `/business/:id` and `/dealer/:id` routes use
explicit Supabase repository/service contracts. Dealer pages search only the
owner's active vehicle inventory with URL-persisted search; business pages
group active product and service inventory. Verification, subscriptions,
analytics, staff, payments, financing and a separate dealer dashboard are
absent.

**Verification:** clean application of all 17 migrations, clean SQL lint, all
95 pgTAP assertions, 35/35 source contract assertions, the repeatable local
business-profile API smoke, lint, scoped typecheck, configured build, and
desktop/390px Chromium owner/public/search/contact checks pass. Chromium caught
and drove the correction of undersized mobile contact targets. Logo editing is
truthfully unavailable until the trusted storage slice; an existing logo
reference remains display-compatible.

**Remaining at that checkpoint:** close targeted messaging browser acceptance,
then essential notifications, listing creation/trusted uploads, Phase 2D auth
closure, reconciliation, and release acceptance. Later entries below record
the completed local listing/storage and Phase 2D source gates.

---

## Phase 3 — minimal messaging implementation checkpoint

**Date:** 2026-07-18  
**Implemented but still feature-gated:** migration `0018_v1_messaging.sql`
adds one conversation per buyer/listing, participant-only message/inbox/thread
RPCs, plain-text validation, a 2,000-character limit, 10-per-minute and
200-per-day sender limits, per-participant unread positions, block/unblock,
24-month retention metadata, conversation reporting, and founder report review
and closure. Direct client message writes are denied. The active inbox, thread,
listing contact dialog and admin Reports page no longer use Base44 and expose
no attachments, receipts, presence, typing, reactions, groups, media, sounds or
AI. Direct WhatsApp/Call/Email contact remains available to guests.

**Verified:** clean application of 18 migrations, clean SQL lint, 95/95 pgTAP
assertions, 40/40 source contracts, lint, scoped typecheck, the repeatable
messaging API smoke and the existing admin smoke pass. The messaging smoke
proves buyer/seller/stranger isolation, one-conversation reuse, unread state,
plain-text projection, direct-insert denial, block/report, rate limiting,
suspended-user denial, founder queue visibility and admin conversation closure.

**Blocked acceptance:** the current configured production build now passes.
Targeted desktop/mobile browser acceptance could not run because the in-app
browser runtime reported no available browser instance. No unrelated browser
automation was substituted. `VITE_FEATURE_MESSAGING` therefore remains false.
The disposable browser database users/data, checked-in helper scripts and the
temporary `C:\tmp\findit-playwright` package directory were removed.

---

## Phase 3 — essential notifications implementation checkpoint

**Date:** 2026-07-21  
**Implemented but still feature-gated:** migration
`0019_v1_essential_notifications.sql` preserves legacy alerts while exposing
only listing-approved, listing-rejected, listing-expiry, report-resolved and
account-status events through trusted Supabase RPCs. Authenticated clients
cannot create or directly mutate alert rows. Owners receive server-paginated
rows, an unread count and narrow single/all read-state operations; links are
restricted to approved internal routes and event source keys are idempotent.
Listing expiries are server-managed, and a service-role-only worker creates
three-day notices and expires due listings.

The active Notification Center and navigation bell now use the notification
repository/service boundary. The UI has one chronological view, clear loading/error/
empty states, safe navigation and no deletion, realtime, sound, marketing,
social, price-drop or recommendation behavior. Admin listing approval/rejection,
final report decisions, and account suspension/restoration create the approved
events transactionally. `My Listings` displays the server expiry date.

**Verified:** all 19 migrations apply cleanly; schema lint, 117/117 pgTAP
assertions, 44/44 source contracts, scoped typecheck, lint and the configured
production build pass. The adversarial notification smoke verifies trusted
creation, all five event classes, safe links, expiry idempotency, owner read
state and owner/reporter/stranger isolation. The existing admin and messaging
smokes also pass after their RPC overrides. All disposable rows are removed.

**Current acceptance state:** `VITE_FEATURE_ESSENTIAL_NOTIFICATIONS` remains
false because no in-app browser instance is available for authenticated
desktop/mobile acceptance. The service-only expiry worker also requires an
owned, monitored daily schedule in the deployment environment before
activation. Migration `0021` has since removed the owner publish bypass:
products now enter `pending_review`, and only the protected admin transition
can approve or reject them.

---

## Phase 3/4 — V1 product listing creation and trusted media checkpoint

**Date:** 2026-07-22  
**Implemented:** migrations `0020`–`0021` add explicit `pending_review`,
`rejected`, `paused` and `unavailable` product states; an idempotent atomic
listing/detail/media submission RPC; protected owner transitions; state-aware
admin moderation; a server-only upload authorization ledger; listing-media
metadata; and deterministic Zimbabwe launch locations. Direct product and
detail inserts are no longer available to browser roles, and an owner edit to
live content automatically returns the listing to review.

The active `/create` route is now a five-step V1 product flow for category,
details/price, approximate location, images/contact and review. It removes
phone OTP, paid packages, verification documents, auctions, variants and exact
map/address collection from the active path. Device-local drafts never persist
signed preview URLs. `My Listings` submits/resubmits, pauses, resumes and marks
products unavailable through the protected transition contract. The active
admin marketplace only approves or rejects pending products and pauses live
products.

One private `listing-images` bucket and the `listing-image-upload` Edge
Function provide the minimum trusted V1 image path. The server inspects actual
JPEG/PNG/WebP bytes and dimensions, caps files at 5 MiB/8000 px/40 MP, computes
SHA-256, generates an owner-scoped key, rate-limits authorization, confirms
stored owner/MIME/size metadata, and returns a short-lived signed preview.
Pending and paused media remain private; approved media can be signed through
Storage policy. Allowed browser origins come from
`FINDIT_ALLOWED_ORIGINS`, with local-only defaults.

Migration `0022` and the `marketplace-image-upload` Edge Function extend the
same trusted binary validator and private signed-delivery pattern to service
photos and business/dealer logos. Purpose-bound intents prevent cross-class
attachment; service images are limited to six, profiles to one logo, and
direct browser metadata bypasses are denied.

Migrations `0023`–`0024` add atomic edit-media replacement for services and
products. Each operation validates every keep/new reference before mutation,
prevents direct browser photo-array bypass, cleans detached objects, retains
the 6/20-image limits and returns live product media changes to review.

**Verified locally:** a clean 24-migration rebuild, database lint, 206 pgTAP
assertions, 55 source contracts, lint, scoped typecheck and production build
pass. Real HTTP smokes prove authentication, purpose/hostile-origin denial,
fake PNG denial, valid upload, idempotent product submission, unpublished
isolation, publication-aware exact-byte signed download and cleanup. Auth,
owner-listing, services, admin, business/dealer, messaging and notification
regression smokes pass. Browser UI acceptance remains blocked because the
in-app browser has no available instance.

**Remaining:** full pixel re-encoding, malware/content
scanning or an approved image-only risk
exception, derivatives/CDN policy, abandoned-object cleanup, object migration
manifest/reconciliation, deployed Edge Function/secrets/observability and the
full-page product edit experience.

---

## Phase 3 — lightweight Help and Contact Support checkpoint

**Date:** 2026-07-22  
**Implemented:** migration `0025_v1_contact_support.sql` adds a purpose-built
`support_requests` founder inbox instead of activating the retained Base44
ticket/chat/agent model. The public `/help/contact` form accepts only category,
contact email, a 20–4000 character message and an optional listing/report
reference. It returns an opaque reference ID and accepts no attachments.

The submission RPC is available to guests and signed-in active users, applies
serialized per-email/account limits, validates the same bounded contract as the
client and exposes no request lookup. The table has RLS with no browser table
policy; admins use narrow search/pagination and resolution RPCs. Resolution
requires a reason and writes an audit event without copying the contact email
or message into the audit log. The existing Reports destination exposes a
small founder-only Support requests view; customers receive confirmation only,
not a ticket portal, chat, priority, assignment or response-time promise.

**Verified locally:** the corrected clean 27-migration rebuild and schema lint
pass. The complete suite passes 241 pgTAP assertions and 66 source contracts;
lint, scoped typecheck and the production build pass. The real admin API smoke
proves guest submission, direct-table denial, ordinary-user admin denial,
founder search/resolution, audit creation and zero leftover fixtures.

**Remaining:** production gateway/CAPTCHA controls are required to supplement
per-email limits against rotating-address abuse. Browser/mobile accessibility
acceptance and an explicit founder monitoring/response procedure remain launch
gates; no automated email delivery is claimed.

---

## Phase 4/7 — image lifecycle and function privilege checkpoint

**Date:** 2026-07-22  
**Implemented:** migration `0026_v1_image_lifecycle_cleanup.sql` extends both
private upload-intent ledgers with an idempotent service-only cleanup protocol.
Only expired, unattached intents are claimed; claiming makes them non-attachable
before object deletion, stale claims recover after 15 minutes, failures retain
the expired state with retry backoff and safe error code, and successful work
keeps a minimal cleaned ledger. The internal `media-lifecycle-cleanup` Edge
Function authenticates with the configured server secret, processes at most
100 objects across both buckets and returns counts/correlation without paths.

Adversarial tests exposed an older default-privilege flaw: revoking `PUBLIC`
had not removed Supabase's explicit `anon`/`authenticated` grants. Migration
`0027_v1_function_execute_hardening.sql` removes browser execution from the
notification-construction helper, listing-expiry worker and every other
internal/service function, then restates the exact public/authenticated/service
matrix.

**Verified locally:** all 27 migrations apply cleanly, schema lint passes, and
the nine SQL files pass 241 assertions. The 66 source contracts, lint and
migration-scoped typecheck pass. Attached-media exclusion, non-attachable claim
state, stale-claim recovery, retry backoff, cleaned finalization and the exact
function allowlists are covered.

**Verified at the real local boundary (2026-07-25):**
`test:media-lifecycle-local` now passes after a preserved-data Supabase stack
restart. It denies browser-key and mixed-key gateway calls, removes expired
objects from both private buckets, finalizes both ledgers and proves an
idempotent zero-claim repeat run.

**Remaining:** hosted scheduling, secret/Vault setup, alerts, scanner or
approved image-only exception, full pixel re-encoding, derivatives, retention
approval and production object reconciliation remain.

---

## Phase 7 — chart style injection boundary checkpoint

**Date:** 2026-07-22  
**Implemented:** the shared chart primitive no longer uses
`dangerouslySetInnerHTML`. A small framework-independent helper normalizes
chart IDs and custom-property keys, accepts only bounded hex, numeric RGB/HSL,
safe CSS-variable color forms or four explicit keywords, and omits unsafe
configuration before React renders the style text.

**Verified locally:** three regression contracts cover accepted color forms,
selector/key injection and crafted CSS/URL payloads. The complete source suite
passes 69 contracts; lint and the configured production build pass, and the
mandatory generated-output scan remains Base44-free across 109 text assets.

**Remaining:** confirm representative chart rendering and theme behavior during
browser acceptance. This correction closes SEC-019 and BUG-038 locally; it
does not close the broader application security, accessibility or production
acceptance work.

---

## Phase 7 — future legal-domain isolation checkpoint

**Date:** 2026-07-25  
**Implemented:** migration `0028_v1_legal_domain_isolation.sql` aligns the
database with the approved product decision that lawyer and legal workflows
do not belong in V1. The five dedicated legal/profile/review/payout tables keep
their data and RLS, but expose no `anon` or `authenticated` table grants or
policies. Service-role access remains for reconciliation and a future,
separately approved legal product.

The active `services` table now enforces `category <> 'legal'` in its public
read, owner insert, owner/admin update and owner/admin delete policies. This
prevents a direct API caller from seeing a retained active legal service or
turning a normal V1 service into a legal listing even if UI filters are
bypassed.

**Verified locally:** all 28 migrations apply from empty state, schema lint is
clean and 253 pgTAP assertions pass. The dedicated adversarial suite proves
anonymous, ordinary-user and browser-admin denial, shared-service hiding and
category-mutation denial, while service-role reconciliation still succeeds.

**Remaining:** the Base44 legal pages/functions and schema rows stay retained
and unrouted until an evidence-backed archive or future-version migration is
approved. Production-like upgrade and data reconciliation remain external
gates.

---

## Phase 2A — Auth cutover: session management, login, logout

**Date:** 2026-07-07
**Plan:** [`docs/AUTH_MIGRATION_PLAN.md`](../AUTH_MIGRATION_PLAN.md) —
written and reviewed before any auth file was touched, per the checkpoint
discipline agreed for this phase.

**What changed:**
- `src/services/authService.js` (new) — the only file besides
  `supabaseClient.js` that calls `supabase.auth.*`. Wraps sign-in
  (email/password + OAuth), sign-out, session retrieval, `getCurrentUser()`
  (joins the Supabase auth session to the `public.users` profile row), and
  `onAuthStateChange`.
- `src/lib/AuthContext.jsx` — internals now call `authService` instead of
  `base44.auth.*`; subscribes to `onAuthStateChange` instead of checking once
  on mount. Public shape (`user`, `isAuthenticated`, `isLoadingAuth`,
  `authChecked`, `blockedAccount`, `logout`, `navigateToLogin`,
  `checkUserAuth`, plus two now-dormant Base44-app-platform-only fields kept
  for compatibility — see file comments) is unchanged, so no other consumer
  of `useAuth()` needed edits this checkpoint.
- `src/pages/Login.jsx` — email/password and OAuth sign-in via
  `authService`.
- `src/components/admin/AdminSidebar.jsx`,
  `src/components/admin/AdminSidebarCollapsible.jsx`,
  `src/components/auth/AccountBlocked.jsx` — logout call sites swapped to
  `authService.signOut()`, same redirect targets as before.

**What was intentionally left unchanged (by design, not oversight):**
- `src/pages/Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx` —
  Phase 2B. `Register.jsx` in particular needs a product decision first
  (custom OTP screen vs. Supabase's link-based confirmation) — see plan §5.
- `src/components/ProtectedRoute.jsx` — Phase 2C. Its `requiredRole`
  re-verification still calls `base44.auth.me()` for now; this is an
  accepted interim state only as long as the Base44 backend stays reachable
  (flagged as a risk in the plan, not silently carried forward).
- ~29 files that call `base44.auth.me()` purely as a "get current user"
  data read (React-Query `queryFn`s, etc.) — these are Phase 3 service-layer
  cleanup, not auth-flow logic; see plan §1 for the full list and reasoning.
- `ensureAdminVerified` admin side-effect in `AuthContext` — still a Base44
  function call (Phase 6 scope), carried through unchanged.

**What still depends on Base44:** registration, password reset, role
re-verification in `ProtectedRoute`, the `ensureAdminVerified` function, and
all 59 serverless functions in `base44/functions/`. The `@base44/sdk`
package and `src/api/base44Client.js` are not removed yet — required until
Phase 2D at the earliest, and in practice until Phase 3 finishes (well over
a hundred non-auth SDK call sites still exist).

**Estimated remaining work:**

| Area | Complete |
|---|---|
| Database | Source scaffold present; verification failed |
| Authentication | ~25% (2A of 4 sub-phases done; 5 of 34 auth-touching files migrated) |
| Entities / service layer | 0% |
| Serverless functions (59 total) | 0% |
| Storage | 0% |
| Payments | Feature-flagged (dormant, by design) |
| **Overall migration** | **~22%** |

**Verification:** Read every file before editing (per project convention);
confirmed via `grep -rl "base44\.auth\."` that exactly the 5 touched files
(`AuthContext.jsx`, `Login.jsx`, `AdminSidebar.jsx`,
`AdminSidebarCollapsible.jsx`, `AccountBlocked.jsx`) now have zero live
`base44.auth.*` calls, and that the other 29 files on the original list are
untouched. Brace/paren balance checked on every edited file. **Not run
against a live app or Supabase project** — this sandbox has no network
access, so the manual QA checklist in `docs/AUTH_MIGRATION_PLAN.md` §6
(login, logout, session persistence on refresh, suspended-account gate) must
be run by you before starting 2B.

**Decision recorded for 2B:** email verification will use Supabase's
standard link-based confirmation email, not a custom OTP screen — see
`docs/AUTH_MIGRATION_PLAN.md` §5. This unblocks `Register.jsx` /
`ForgotPassword.jsx` / `ResetPassword.jsx` once the 2A QA checklist passes.

---

## Phase 2B — Auth cutover: registration, password reset, email verification

**Date:** 2026-07-07
**Precondition per your review:** you approved 2A and asked for the 5-step
validation sequence (real Supabase project → apply migrations → run the QA
checklist → fix issues → tag `phase-2a-complete`) before starting this
phase. That validation happens in your environment, not this sandbox (no
network access here) — this entry is the code for 2B, not a claim that 2A
was validated live. Run the same checklist against 2B before tagging
`phase-2b-complete` and moving to 2C.

**What changed:**
- `src/services/authService.js` — added `signUp()`, `resendSignupConfirmation()`,
  `resetPasswordForEmail()`, `updatePassword()`.
- `supabase/migrations/0012_capture_phone_on_signup.sql` (new, additive —
  does not edit 0002) — extends the existing `handle_new_auth_user()`
  trigger to also copy `phone` from signup metadata into `public.users`,
  alongside the `full_name` it already copied. Needs to be applied (`supabase
  db push` or `db reset`) alongside 0001–0011 before 2B can work end-to-end.
- `src/pages/Register.jsx` — rewritten: `signUp()` → "check your email"
  screen → resend option. The custom 6-digit OTP screen is removed, not
  flagged off, per the §5 decision. Google/Apple OAuth buttons unchanged.
- `src/pages/ForgotPassword.jsx` — `resetPasswordForEmail()`, same
  always-show-success behavior (enumeration-safe) as before.
- `src/pages/ResetPassword.jsx` — rewritten: no more `?token=` query param
  (Supabase's recovery link is parsed automatically by
  `detectSessionInUrl` before the page even mounts). Checks for an existing
  session on mount and listens for the `PASSWORD_RECOVERY` auth event as a
  fallback, since the two can race depending on when the subscription
  attaches — flagged in the file's own comments as the one piece of this
  phase most worth a real-browser QA pass, since sandbox testing can't
  settle a timing question like that.

**What was intentionally left unchanged:**
- `src/components/ProtectedRoute.jsx`, `src/pages/admin/AdminUsers.jsx` —
  Phase 2C (role re-verification).
- `RequirePhoneVerification.jsx` and its OTP flow — unrelated to signup
  verification, not touched; phone captured at registration is stored
  unverified (`phone_verified` stays `false`) exactly as before.
- The ~26 remaining `base44.auth.me()` data-read call sites — Phase 3.

**What still depends on Base44:** role re-verification in `ProtectedRoute`,
`ensureAdminVerified`, all 59 serverless functions, and the ~130 non-auth SDK
call sites. `@base44/sdk` still required.

**Estimated remaining work:**

| Area | Complete |
|---|---|
| Database | Source scaffold present; migrations 0001–0012 not successfully applied |
| Authentication | ~50% (2A + 2B of 4 sub-phases; 8 of 34 auth-touching files migrated) |
| Entities / service layer | 0% |
| Serverless functions (59 total) | 0% |
| Storage | 0% |
| Payments | Feature-flagged (dormant, by design) |
| **Overall migration** | **~28%** |

**Verification:** Read every file before editing. Confirmed via
`grep -rl "base44\.auth\."` that the 3 newly-touched files
(`Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`) plus the 5 from
2A — 8 total — now have zero live `base44.auth.*` calls, and the remaining
26 files are untouched. Brace/paren balance checked on every edited file.
**Not run against a live app or Supabase project** — migration 0012 has not
been applied to any real database, and the `PASSWORD_RECOVERY` timing logic
in `ResetPassword.jsx` has not been exercised in a real browser. Both are
required before this checkpoint can be tagged complete.

---

## Phase 2C — Auth cutover: protected routes, roles, and admin access

**Date:** 2026-07-17
**Scope:** a bounded route-authorisation migration and two verified
password-recovery defects. No Base44 data/function call was migrated or
bridged in this checkpoint.

**What changed:**

- `src/services/authService.js` now exposes `hasRequiredRole()`, which calls
  the existing `public.is_admin()` or `public.is_super_admin()` Supabase RPC
  for the current JWT. Those `SECURITY DEFINER` functions calculate their
  result from `auth.uid()`, rather than from a profile cached in React.
- `src/components/ProtectedRoute.jsx` no longer imports or calls
  `base44.auth.me()`. Every `requiredRole` route now fails closed if the
  Supabase database check fails or is unavailable. `src/App.jsx` was
  inspected: all `/admin/*` routes already pass `requiredRole="admin"`, so
  no router modification was necessary.
- `src/pages/admin/AdminUsers.jsx` now obtains its display-only
  `super_admin` value from `useAuth().user`; its Base44 list and mutation
  functions remain unchanged for the planned service/function migration.
- `ResetPassword.jsx` and `authService.updatePassword()` require a real
  Supabase `PASSWORD_RECOVERY` event, persisted only for the matching browser
  tab/session. A normal session no longer unlocks the form, and a rejected
  recovery-session lookup now resolves to the invalid-link state instead of
  spinning indefinitely.
- `supabase/tests/database_auth_rls_smoke.sql` now has 22 assertions,
  including ordinary-user denial and admin allow checks for the same database
  role predicates used by `ProtectedRoute`.

**Verification:** `npm.cmd run lint` and `npm.cmd run build` pass. The
focused local `supabase test db supabase/tests/database_auth_rls_smoke.sql
--local` suite passes all 22 assertions. A local browser visit to
`/reset-password` without a recovery event renders the invalid-link state;
an unauthenticated `/admin` visit renders the login screen.

**What is intentionally unchanged:** the 29 live `base44.auth.*` calls in 24
files are Phase 3 service/data work, and `AdminUsers`' Base44 functions plus
the `ensureAdminVerified` side effect remain provider dependencies. No
browser test has yet completed a valid recovery callback or exercised an
admin session, and no Supabase session can authorise those remaining Base44
workflows. Phase 2C is therefore source-implemented and locally verified,
not operationally complete.

---

## Phase 1 — Database foundation

**Date:** 2026-07-07
**Base44 dependency removed:** none yet (this phase is additive only — no
existing file was modified, so the app builds and runs exactly as before).
**What was added:**

- `supabase/migrations/0001`–`0011` — full relational schema for all 40
  Base44 entities, plus RLS policies. See `docs/DATABASE.md` for the
  entity-by-entity mapping and the reasoning behind each schema decision.
- `src/lib/supabaseClient.js` — the only file that will import the Supabase
  SDK. Not yet imported by any page/component.
- `src/lib/featureFlags.js` — central on/off switch for payments and AI
  features, defaulting to off. Not yet imported by any page/component.
- `.env.example` — documents the new `VITE_SUPABASE_*` and `VITE_FEATURE_*`
  variables alongside the legacy `VITE_BASE44_*` ones (kept until Phase 3
  removes the last Base44 call site).

**Why this scope for Phase 1:** the database schema and client can be built
and reviewed with zero risk to the running app, since nothing in `src/pages`
or `src/components` references any of these new files yet. Auth (Phase 2)
and the service layer / SDK call-site replacement (Phase 3) are scoped
separately because they touch live code (35 files for auth, 130 for the
service layer) and need their own build-and-verify checkpoint per the
"never leave the app in a broken state between phases" rule.

**Schema changes vs. Base44 entities:**
- `Car` / `Property` / `Machinery` → unified `listings` table + `car_details`
  / `property_details` / `machinery_details` (see `docs/DATABASE.md` §1).
- Every `*_email` reference (e.g. `seller_email`, `user_email`) → proper
  `uuid` foreign key to `public.users(id)`.
- Enums (`status`, `fuel_type`, `escrow_status`, etc.) enforced as native
  Postgres `enum` types instead of only Base44's write-time schema check.
- Composite indexes added for the known hot paths (listings by
  kind+status+date, tickets by status+priority, messages by ticket+date).

**Open item carried forward:** `service_bookings.practitioner_id` has no FK
yet — the original Base44 field was a bare string used for both
`LegalPractitioner` and general service-provider IDs depending on booking
type, and that ambiguity needs a product decision before it can be
constrained. Tracked here so it isn't forgotten; revisit in Phase 3.

**Verification:** SQL reviewed for syntax and referential consistency. Since
this sandbox has no network access to provision a live Postgres/Supabase
instance, the migrations have **not yet been run against a real database** —
before Phase 2, run `supabase db reset` (or apply the files in order against
a fresh Supabase project) and confirm all 11 files apply cleanly.

**2026-07-17 correction:** the prior static syntax claim is not valid.
`0004_listings.sql` declares `enforce_listing_kind(expected listing_kind)` as
a trigger function, but PostgreSQL trigger functions must have no formal
arguments and read trigger arguments from `TG_ARGV`. The database phase is
therefore not complete. See `PHASE_0_TO_2B_VERIFICATION.md` for the additional
RLS/view/schema discrepancies and the required clean-apply gate.

---

## Archived files

None archived yet — the dead-code cleanup identified in the audit
(orphaned support pages, duplicate `create-listing` step files, unused
packages) is scheduled for its own step so it can be verified independently
and isn't bundled into this schema-only phase. It will be logged here with
before/after paths when it happens.

---

## Removed Base44 dependencies (running list)

- **2026-07-07 (Phase 2A):** `base44.auth.me()`, `.logout()`,
  `.loginViaEmailPassword()`, `.loginWithProvider()`, `.redirectToLogin()` —
  removed from `src/lib/AuthContext.jsx`, `src/pages/Login.jsx`,
  `src/components/admin/AdminSidebar.jsx`,
  `src/components/admin/AdminSidebarCollapsible.jsx`,
  `src/components/auth/AccountBlocked.jsx`. Replaced by
  `src/services/authService.js` (Supabase Auth). Legacy `base44.auth.*`
  references remain in later-phase callers; the current complete source
  inventory is maintained in `BASE44_DEPENDENCY_MAP.md`.
- **2026-07-07 (Phase 2B):** `base44.auth.register()`, `.verifyOtp()`,
  `.setToken()`, `.resendOtp()`, `.resetPasswordRequest()`,
  `.resetPassword()` — removed from `src/pages/Register.jsx`,
  `src/pages/ForgotPassword.jsx`, `src/pages/ResetPassword.jsx`. Replaced by
  `authService.signUp()` / `.resendSignupConfirmation()` /
  `.resetPasswordForEmail()` / `.updatePassword()`. At that checkpoint the repository had
  14 client-importing files with 15 live `base44.auth.*` calls remaining.
- **2026-07-17 (Phase 3 public browse/detail checkpoint):** removed Base44
  imports from Search, the three listing-detail pages, shared listing cards,
  location selection, Currency context, Auth context's obsolete verification
  side effect, and listing reports. Replaced them with Supabase repositories/
  services. Removed `@base44/vite-plugin`; after the later owner/profile/seller,
  service, active-admin, business/dealer, messaging, notification and product-creation checkpoints, 81 source modules still imported the
  Base44 client for classified later-phase work.
- **2026-07-22 (Phase 2D source/local checkpoint):** repointed the final 15
  Base44 auth operations across 14 client consumers to the shared Supabase
  auth context/login redirect. The automated contract gate and local auth
  lifecycle smoke pass, including fixture cleanup. Zero runtime
  `base44.auth.*` operations remain; 80 source modules still import Base44 for
  separately classified data/function/integration work. Production
  SMTP/OAuth, refresh/revocation, blocked-account lifecycle and existing-user
  transition acceptance remain blocked.
