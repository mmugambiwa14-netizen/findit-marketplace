# FindIt V1 Admin Simplification Plan

Status: **Approved V1 admin scope**  
Operating assumption: solo founder or very small trusted team

## Final V1 admin panel

The V1 admin panel contains exactly six destinations:

1. Overview
2. Marketplace
3. Users
4. Reports
5. Categories
6. Audit Log

These destinations cover the minimum operating loop: detect a problem, inspect
the relevant marketplace/user context, act with a reason, keep discovery
taxonomy useful, and retain evidence.

## 1. Overview

Purpose: show what needs attention now, not provide a business-intelligence
suite.

Include:

- published, draft/pending, paused, rejected, and recently removed inventory;
- open reports by age/severity;
- active, suspended, and banned user counts;
- recent moderation actions;
- failed background jobs or provider/storage health relevant to V1;
- links into pre-filtered Marketplace, Users, and Reports views.

Do not include revenue, subscriptions, payouts, verification queues, legal
bookings, support-agent productivity, decorative charts, vanity growth cards,
or full-row client-side aggregation. Counts must come from bounded aggregate
queries.

## 2. Marketplace

Purpose: moderate product listings, service advertisements, and lightweight
business/dealer profiles in one place.

Include:

- tabs or filters for Products and Services;
- query, category, status, location, owner, report state, and date filters;
- thumbnail, title, price, category, owner, status, report count, and dates;
- detail drawer/page showing public content plus relevant ownership and report
  context;
- publish/restore, pause/hide, reject, and remove actions according to the
  approved state machine;
- mandatory reason for punitive or exceptional actions;
- a link to the public preview and owner record;
- immutable action result and audit reference.

Do not provide bulk destructive actions in the first release. Do not let the
browser update status fields directly. Protected operations must validate the
current state, admin, reason, idempotency, and target in one trusted boundary.

## 3. Users

Purpose: investigate account abuse and manage account access.

Include:

- search by user ID, email, phone, or display name with appropriate masking;
- active/suspended/banned filters;
- account created/last active dates where legitimately collected;
- owned listings/services and report/moderation summary;
- suspend with reason and optional expiry;
- ban with reason;
- unban/restore with reason;
- admin-status visibility.

Exclude direct editing of arbitrary profile fields, generic role dropdowns,
super-admin controls, verification evidence, payment history, internal token
details, and service-role access. Admin grants belong to a separately protected
operational process, not the normal user table.

## 4. Reports

Purpose: provide one queue for user-, listing-, and conversation-safety reports.

Include:

- open, investigating, actioned, dismissed, and closed states;
- severity/reason, reporter, target, created age, and related report count;
- safe display of reporter notes;
- context links to the listing/service and reported account;
- conversation context limited to the minimum messages required for the
  reported incident, with participant privacy and retention controls;
- resolution action and mandatory reasoning;
- optional internal note with strict visibility;
- automatic audit linkage to any listing/user action.

At launch the founder handles the queue. Assignment, SLAs, team routing,
templates, and AI triage are unnecessary. Establish a simple target such as
reviewing high-risk reports within one operating day, then measure actual load.

## 5. Categories

Purpose: keep search and listing vocabulary accurate without requiring a code
deployment for every safe content adjustment.

Include:

- the four protected top-level categories and their approved subcategories;
- active/inactive state, display label, stable slug/ID, marketplace kind, and
  sort order;
- add approved subcategory, rename display label, activate/deactivate, and
  reorder actions;
- referenced-listing counts and a warning before deactivation; and
- durable audit for every mutation.

Exclude free-form user categories, deletion of referenced rows, top-level
category deletion, arbitrary schema fields, bulk import, analytics, page
content management, and visual page-building. Changing a display label never
changes the stable identifier. All writes use narrow protected operations.

## 6. Audit Log

Purpose: provide a durable, read-only history of privileged operations.

Include:

- actor ID, action, resource type/ID, timestamp, result, reason, and correlation
  ID;
- before/after values for approved non-sensitive fields;
- filters for actor, action, resource, result, and date;
- redaction of secrets, tokens, full private document URLs, and unnecessary
  personal data;
- export only when a documented operational need exists.

Audit persistence must be transactional or use a durable outbox. If a required
audit event cannot be recorded, the privileged operation must fail. Admins may
not edit or delete audit events through the application.

## Current admin route decisions

| Current page/route | V1 treatment | Destination or reason |
|---|---|---|
| `AdminDashboard` `/admin` | Keep and simplify | Overview |
| `AdminListings` `/admin/listings` | Keep and expand to services | Marketplace |
| `AdminUsers` `/admin/users` | Keep and narrow | Users |
| `AdminReports` `/admin/reports` | Keep and simplify | Reports |
| New `AdminCategories` `/admin/categories` | Add narrowly | Categories |
| `AdminAuditLog` `/admin/audit-log` | Keep and harden | Audit Log |
| `AdminAnalytics` | Future Version | A few actionable aggregates move to Overview; full analytics waits for real questions/data. |
| `AdminVerifications` | Deferred and unreachable | Verification is disabled in V1. |
| `AdminPayments` | Deferred and unreachable | Payments are disabled. |
| `AdminSubscriptions` | Deferred and unreachable | Subscriptions are disabled. |
| `AdminLegalServices`, `AdminLegalDisputes` | Future Version and unreachable | Legal vertical is outside V1. |
| `AdminSupportDashboard`, `AdminSupportQueue`, `AdminTicketDetailPage` | Removed from V1 surface | A lightweight Support requests view inside Reports replaces the ticket operations suite; it has only search/filter and reasoned resolution. |
| `AdminAgents`, `AdminSupportSettings` | Removed from V1 surface | No support workforce or configuration product at launch. |
| `AdminFAQ`, `AdminFAQsManager` | Removed from V1 surface | Duplicate CMS tools; V1 Help is version-controlled. |
| `AdminAnnouncements` | Future Version | Not required for launch operations. |
| `AdminEmailTemplates` | Removed from V1 surface | Transactional templates remain controlled provider/configuration assets. |
| `AdminNeighbourhoods` | Removed from V1 surface | Location reference data is curated through controlled configuration/migrations. |
| Unrouted `AdminSupport`, `AdminTicketDetail` | Removed | Duplicate legacy implementations. |

Source and data for excluded routes must remain preserved until Documents 1–4
allow archival or deletion. V1 navigation, route registration, and server
actions must make them unreachable after approval.

## Admin navigation

Use one compact sidebar on desktop and one labelled drawer on small screens:

- Overview
- Marketplace
- Users
- Reports, with open count
- Categories
- Audit Log
- Back to marketplace
- Sign out

Remove multiple competing `AdminSidebar`, `AdminSidebarCollapsible`, and
`AdminNavigation` data definitions. After implementation is authorized, one
navigation configuration should drive all layouts and access tests.

## Workflow standards

Every privileged workflow must:

1. load authoritative current state;
2. show only the personal data needed for the task;
3. require confirmation for punitive/destructive action;
4. require a structured reason;
5. call a narrow protected operation;
6. enforce admin and active-account status on the server/database;
7. validate the state transition and target relationship;
8. persist a durable audit event;
9. return a stable result/error code;
10. update the UI and make retry/idempotency behavior clear.

## Permissions

V1 has one `admin` application role. Least privilege comes from narrow
operations, not a service-role token in the browser. If operations require
separation later, introduce capabilities such as `moderate_marketplace`,
`manage_users`, or `view_audit` through audited admin memberships. Do not add
roles before there is a real team and assignment need.

## Admin UX requirements

- Dense but readable desktop tables; cards/list rows on mobile only for urgent
  founder access, not full moderation productivity.
- Sticky filters and visible result counts.
- Server-side search, filter, sort, and pagination.
- Clear state badges using text plus colour.
- One primary action per context; dangerous actions separated and red.
- No icon-only destructive action without an accessible name and confirmation.
- Loading skeletons preserve table/layout geometry.
- Empty state distinguishes “no records” from “no filter matches.”
- Errors retain filters and entered reason where safe.
- Keyboard-accessible drawers/dialogs with focus return.

## Operational metrics

The admin overview should track:

- open reports and oldest open age;
- median time to first review and resolution;
- listings hidden/rejected/restored;
- users suspended/banned/restored;
- report outcomes by reason;
- failed moderation operations and audit-write failures;
- unusual publish/contact/report rates for abuse investigation.

These are operating signals, not a broad analytics product.

## Acceptance criteria

- The six destinations are the only admin navigation/routes reachable in V1.
- Anonymous, ordinary, suspended, and banned users are denied at route and
  server/database boundaries.
- Admin actions pass positive, negative, stale-state, retry, and audit-failure
  tests.
- No browser request carries a service-role credential or generic privileged
  entity client.
- Every punitive action records actor, target, reason, result, and correlation.
- Counts and lists are paginated/aggregated server-side and reconcile with the
  database.
- Category mutations preserve stable IDs, cannot delete referenced or protected
  rows, and produce durable audit events.
- Accessibility, responsive, empty/error, and keyboard workflows are tested.
