# FindIt MVP V1 Migration Scope Update

Status: **Approved authoritative overlay; bounded implementation resumed**  
Relationship: Documents 1–4 remain authoritative for preservation, security,
data integrity, verification, operations, handover, and Definition of Done

## Scope change

The migration objective changes from “migrate every current product feature”
to “deliver the approved FindIt V1 product while safely preserving or
archiving non-MVP behavior and data.”

This narrows implementation scope but does not weaken engineering standards.
Every feature that ships must still satisfy Documents 1–4. Every feature that
does not ship must be classified, unreachable, fail closed, excluded from
production side effects, and preserved or archived according to evidence.

## What must be migrated for V1

### Runtime foundation

- application shell, approved routes, navigation, error/loading states;
- Supabase Auth for email/password confirmation, session, logout, recovery;
- user/admin role and account-status enforcement;
- validated environment and feature configuration;
- deployment, monitoring, backup, restore, rollback, and CI for the V1 stack.

### Marketplace

- Home and full server-side Search;
- autocomplete, on-device recent searches, URL-persisted filters, and stable
  pagination;
- Property, Vehicle, Machinery, and Service browse/detail;
- create/edit/draft/publish/pause/unavailable/expire/delete lifecycle;
- minimal listing-linked plain-text buyer/seller messaging plus direct Call,
  WhatsApp, and permitted Email actions;
- public seller summary;
- lightweight public Business Profiles and dealer inventory presentations;
- essential operational notifications for the approved five event types;
- Favourites for product listings;
- listing/service/user reports and manual moderation;
- approximate location reference data;
- secure product/service image storage and delivery.

### Operations

- six-page admin: Overview, Marketplace, Users, Reports, Categories, Audit Log;
- lightweight static Help/Safety/Terms and Contact Support to a monitored inbox;
- durable audit and privacy-conscious operational metrics.

## What is not migrated for V1

Do not spend migration effort on live replacements for:

- rich messaging features: presence, attachments, read receipts, typing,
  reactions, media, voice, groups, AI, or automated moderation;
- marketing, price-drop, social, and complex preference-driven notifications;
- follows, reviews, seller ratings, social/reputation systems;
- verification requests, identity/business/dealer/lawyer documents or badges;
- business/dealer verification, subscriptions, analytics, staff management,
  premium tools, payments, financing, and separate dashboards;
- agent or lawyer product systems;
- legal/service booking, disputes, practitioner portal, earnings, payouts;
- payments, escrow, subscriptions, premium listings, packages, pricing, or
  transaction history;
- bulk CSV/PDF/duplicate tools;
- AI moderation, extraction, support agents, triage, or ban evasion;
- full support ticket/chat/attachment/agent/template/settings platform;
- map, valuation, market insights, announcements, email CMS, marketing email,
  scheduled reminders, or separate analytics suite.

These dependencies are classified as Deferred, Removed from V1, or Future in
`FEATURE_DECISION_MATRIX.md`. “Not migrated” does not mean “delete now.”

## Base44 migration priority

### V1 dependencies requiring replacement

| Base44 domain | V1 replacement direction |
|---|---|
| `User` and remaining current-user reads | Supabase Auth/profile service and owner context |
| `Car`, `Property`, `Machinery` | Listing repository/service over normalized Supabase schema |
| `Service` | Service repository/service for advertise/browse/contact only |
| `Location` | Curated location repository/reference query |
| `SavedListing` | Owner-only Favourites repository/service |
| `BusinessProfile` | Lightweight owner-managed public business/dealer profile service and vehicle-inventory view |
| `Inquiry` | Participant-only listing conversation/message repositories with plain-text, rate, block, report, and retention controls |
| `AppAlert` | Trusted-created essential notification repository with owner read state |
| `Report` | Report service plus protected moderation operations |
| `AuditLog` | Append-only durable audit/outbox |
| `Terms` | Public versioned terms repository/content path |
| Base44 listing/business-logo image upload | Supabase Storage with V1 media metadata/validation/derivatives |
| Delete/expire/moderate/user-control/admin-stat functions | Narrow protected RPC/Edge Function/job replacements with audit/idempotency/rate tests |
| Base44 Vite/client/config needed by the above | Remove after all V1 call sites and data are cut over and reconciled |

### Non-MVP Base44 dependencies

Do not port their live functions/entities merely to achieve call-count
progress. Instead:

1. identify whether production data/use exists;
2. preserve export, schema, contracts, and behavior evidence;
3. prevent route/API/job/background execution in V1;
4. exclude dormant source from the production bundle/runtime;
5. archive only after approval, reconciliation, and restoration instructions;
6. retain future specifications separately from V1 services.

Document 4 still requires no operational dependency on Base44. Therefore no
shipped V1 route, background job, build plugin, configuration, authentication,
or server function may require Base44. Historical source may remain in a
versioned archive only if it is outside the production build/deployment and all
data obligations are resolved.

## Revised phase sequence

### Product Gate — before migration resumes

- Approve all 12 MVP planning documents.
- Obtain Base44 production user/data/storage/configuration evidence.
- Confirm target host/provider, owner, operating budget, and launch assumptions.
- Record any product changes requested during approval.

### Phase 0 — MVP discovery reconciliation

- Overlay the Feature Decision Matrix on the existing inventory/dependency map.
- Capture baseline screenshots/behaviors for MVP routes and any non-MVP
  behavior with production evidence.
- Mark dependencies `MVP replacement`, `Deferred dormant`, `Future archived`,
  or `Removal candidate`; retain current planned phase history.
- Reconcile active data and media before changing the target schema.

### Phase 1 — V1 database and security foundation

- Decide clean baseline versus additive forward migration from actual applied
  state.
- Implement/verify the active V1 schema in the Database Simplification Plan.
- Revoke/fail-close deferred tables if they remain deployed.
- Complete RLS/action/column/view/media tests, upgrade, reconciliation,
  rollback, restore, and query plans.

### Phase 2 — V1 authentication and roles

- Complete single-session Supabase auth for MVP routes.
- Eliminate remaining Base44 auth/current-user dependencies from the V1 graph.
- Enforce active account and `user|admin` model at trusted boundaries.
- Verify registration, confirmation, login, refresh, logout, recovery,
  suspension, admin, rate limits, and provider email in staging/browser.
- OAuth and phone OTP remain off.

### Phase 3 — MVP service/repository cutover

Migrate vertical slices in this order:

1. public location and listing read/search/detail;
2. owner listing create/manage;
3. service advertise/browse/contact;
4. lightweight Business Profiles and dealer inventory pages;
5. minimal listing messaging;
6. essential notifications;
7. Favourites;
8. Reports and admin moderation/categories/audit;
9. lightweight Help/Contact Support.

Each slice includes repository, service, hook, UI adapter, RLS/server
operations, data migration, contract comparison, observability, tests, and
rollback. Do not replace Base44 page calls with direct Supabase calls.

### Phase 4 — V1 storage

- Migrate only product/service images and business logos for V1.
- Implement ownership, trusted validation, quotas, derivatives,
  scan/quarantine policy, metadata, reconciliation, cache, deletion, backup,
  and monitoring.
- Do not migrate verification documents, message/support attachments, bulk
  files, avatars, credentials, or legal documents into a live V1 feature.
  Preserve them privately according to evidence/retention requirements.

### Phases 5–6 — dormant capability handling

- Payments, premium, subscriptions, escrow, rich messaging, non-essential
  notifications, AI, legal, verification, support ticketing, and provider
  automations remain off.
- Remove Base44 operational dependency without rebuilding those products:
  export/preserve data, disable jobs/routes, exclude runtime code, archive
  contracts, and document restoration/future design.

### Phase 7 — V1 quality/security/performance

- Close all Critical/High findings affecting the V1 surface or deployed data.
- Complete typecheck strategy, automated suites, rate limits, audit durability,
  error/logging, accessibility, mobile, browser, image, bundle, and query-plan
  acceptance.

### Phase 8 — V1 deployment and acceptance

- Clean install/provision/migrate/seed/test/build/deploy from documented steps.
- Exercise backup/restore and rollback.
- Verify monitoring/alerts, domain/TLS/SPA rewrites, email, storage, all V1
  workflows, and all excluded-feature denials.
- Produce final Base44 elimination, completion, readiness, metrics, QA,
  security, and handover reports for the approved V1 scope.

### Execution checkpoint — 2026-07-26

Phases 4–7 are complete for the bounded local V1 scope. Phase 4 has real
private-image upload, publication, signed-read and cleanup evidence. Phase 5
is complete as a fail-closed deferral: commerce flags are required off, no
commerce route is active, Stripe browser packages are removed and retained
tables are service-only. Phase 6 has protected essential notifications and a
service-only idempotent listing-expiry worker, with browser activation and
hosted scheduling still held. Phase 7 passes the production dependency,
Base44-output, bundle-budget, lint, active-type, source-contract, database and
130-listing search-scale gates. Phase 8 remains the next phase; this checkpoint
does not claim hosted deployment, cross-browser/device acceptance, production
reconciliation or final Base44 elimination.

## Required updates to Document 1 records

After product approval:

- `FEATURE_INVENTORY.md`: add the exact MVP/Deferred/Removed/Future decision
  and link to the decision rationale; retain original state/history.
- `BASE44_DEPENDENCY_MAP.md`: add V1 runtime requirement, disposition, data
  preservation, and replacement/archive verification per dependency.
- `BEHAVIOUR_BASELINE.md`: distinguish V1 behavior contract from preserved
  non-MVP historical behavior; capture production evidence where available.
- `ARCHITECTURE_REVIEW.md`: add the V1 route/domain context and excluded
  runtime boundary.
- `MIGRATION_RISKS.md`: add feature-disable leakage, dormant-data retention,
  scope drift, premature deletion, and future-feature coupling risks.

Document 1's preservation rule remains: no non-MVP code/data is deleted merely
because it is not launching.

## Required updates to Document 2 records

After approval:

- make the V1 layered architecture and two-role model the active target;
- replace the broad schema target with the evidence-approved V1 active/deferred
  schema plan;
- limit active Storage to listing/service images while preserving other object
  classes privately;
- document minimal text messaging plus direct contact, essential operational
  notifications, lightweight business/dealer profiles, and static
  Help/founder inbox instead of full support;
- define server-side search, state transitions, reports, admin, audit, storage,
  rate-limit, and validation contracts;
- use `DESIGN_SYSTEM.md`, screen specs, component plan, and flows as the UX
  contract without authorizing aesthetic redesign.

All Document 2 security, input, output, authorization, RLS, audit, error,
accessibility, and performance requirements remain binding.

## Required updates to Document 3 records

After approval, QA and bug/debt scope should:

- test every V1 screen, flow, role, state, browser, viewport, and failure;
- verify every excluded feature is unreachable, inactive, and not making
  network/job/provider calls;
- close V1 Critical/High security and correctness findings;
- reclassify defects that affect only preserved non-runtime future source, but
  retain security obligations for any deployed data/table/function;
- add automated repository/service, RLS, auth, storage, admin, browser, and
  accessibility suites;
- establish V1 performance budgets and production-like data/query plans;
- base release acceptance on the approved V1 rather than unused enterprise
  pages.

Document 3's build, security, deployment, backup, disaster recovery,
monitoring, regression, and production acceptance gates remain unchanged.

## Required updates to Document 4 records

Final reports should describe the approved V1 product and openly list future
capabilities. Document 4 remains fully applicable:

- no V1 operational dependency on Base44;
- no Critical or High security defect affecting V1 or deployed retained data;
- database/Auth/Storage/RLS/core/admin operational;
- build/deployment/rollback/monitoring/backup verified;
- all MVP workflows and excluded-feature denials accepted;
- environment, architecture, limitations, roadmap, QA, security, debt, and
  handover documentation accurate;
- another engineer can operate and extend the V1 without the migration author.

“Removed from V1” features belong in Known Limitations/Roadmap where useful,
not as visible unfinished navigation.

## Scope control and change process

Any proposal to add a feature to V1 must state:

- validated user problem and launch value;
- implementation, security, operations, maintenance, support, and data cost;
- role/database/storage/provider impact;
- what current P0 work it displaces;
- feature flag and rollback plan;
- acceptance tests and owner.

The default is to defer. Feature quantity is not a migration success metric.

## Resume condition

Base44-to-Supabase implementation may resume only after:

1. the founder approves the authoritative MVP specification and its reconciled
   supporting scope documents;
2. requested changes are reconciled consistently across them;
3. production data/storage/provider evidence is available or its absence is an
   explicit bounded-work constraint;
4. the next vertical slice and its acceptance/rollback plan are approved; and
5. migration records are updated to reflect the new V1 disposition without
   erasing historical findings.

The founder authorized implementation on 2026-07-17. That authorization
unblocks bounded local work that is reversible and does not depend on unknown
production data. Production cutover, destructive cleanup, provider activation,
and data migration remain blocked until their external evidence and explicit
go/no-go gates are satisfied.
