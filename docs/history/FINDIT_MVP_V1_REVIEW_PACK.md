# FINDIT MVP V1 PRODUCT, UX, AND MIGRATION REVIEW PACK

> **Superseded product decisions — 2026-07-17.** This combined review pack is
> retained as historical analysis and must not be used as the current V1
> scope. `FINDIT_MVP_V1_SPECIFICATION.md` is authoritative. Its approved
> revision keeps lightweight Business Profiles, dealer inventory pages,
> minimal plain-text messaging, essential operational notifications, stronger
> Search, and a six-page admin including Categories, while excluding all legal
> functionality. The individual supporting documents have been reconciled to
> that decision; this convenience pack has not been regenerated yet.

Status: Proposed for review and approval  
Market: Zimbabwe  
Reviewed repository state: 2026-07-17  
Implementation status: Planning only — migration and production implementation are paused

---

## 1. PURPOSE OF THIS REVIEW

This document defines the proposed FindIt Version 1 product before the
Base44-to-Supabase migration continues.

Migration Specifications Documents 1–4 remain authoritative for engineering,
security, preservation, data integrity, deployment, QA, documentation, and
Definition of Done.

This review pack becomes the proposed authority for:

- what belongs in the MVP;
- what users can do at launch;
- what is deferred, removed from V1, or reserved for a future version;
- the minimum user-role and admin models;
- the active V1 database scope;
- navigation, screens, flows, and design standards; and
- how the remaining migration should be narrowed.

No code, route, database, or data deletion is authorized by this document.
Implementation resumes only after founder approval.

---

## 2. EXECUTIVE RECOMMENDATION

FindIt V1 should be a focused Zimbabwean classifieds marketplace for:

- property;
- vehicles;
- machinery and equipment; and
- services.

Its core promise should be:

> Find what you need in Zimbabwe, understand the offer, and contact the person
> behind it without friction.

The product should focus deeply on two journeys:

1. Browse → Search → Listing detail → Contact seller
2. Register → Post listing → Manage listing

V1 should not launch as a payment platform, verification agency, booking
system, social network, enterprise help desk, AI product, or business
intelligence suite.

The recommended MVP includes:

- email/password authentication;
- simple user profiles;
- product and service advertisements;
- category browsing;
- complete server-side search and filters;
- secure listing images;
- direct Call, WhatsApp, and optional Email contact;
- Favourites;
- user/listing reports;
- manual moderation;
- a five-page admin panel;
- Help, safety information, and a simple Contact Support form; and
- feature flags that fail closed.

The recommended MVP excludes in-app messaging, notifications, payments,
escrow, premium listings, subscriptions, verification documents, reviews,
ratings, AI, legal workflows, bulk imports, full support ticketing, and complex
business/dealer products.

---

## 3. PRODUCT GOALS

V1 should optimize for:

- rapid and safe launch;
- useful marketplace inventory;
- fast discovery;
- high-quality listings;
- direct seller contact;
- trust through clarity and moderation;
- excellent mobile usability;
- low founder operating burden;
- maintainable architecture; and
- future expansion without launch complexity.

V1 is successful when:

- guests can browse every published listing;
- search and filters operate over the complete inventory;
- users can register, confirm email, sign in, recover access, and sign out;
- users can publish and maintain products or services;
- buyers can contact sellers quickly;
- listing images are secure, responsive, and independently hosted;
- users can save and report listings;
- admins can moderate listings, users, and reports with durable audit history;
- all non-MVP features are inaccessible and inactive; and
- the application satisfies Documents 1–4 for production readiness.

---

## 4. TARGET USERS

### Buyer or browser

A guest or registered user looking for property, a vehicle, machinery, or a
service provider. They need accurate search, useful photos, clear pricing,
location, seller context, safety guidance, and fast contact.

### Seller or service provider

Any active registered user who owns a listing or service advertisement. Seller
and provider are ownership relationships, not special roles.

### Administrator

The founder or a small trusted operating team. They need only the tools
required to manage marketplace safety: overview, marketplace moderation, user
controls, report handling, and audit history.

---

## 5. FEATURE DECISIONS

### MVP — required at launch

- Application shell and approved routing
- Public and mobile navigation
- Email/password registration
- Email confirmation
- Login, session restoration, logout, and password recovery
- Account-status enforcement
- Basic profile and contact preferences
- Property marketplace
- Vehicle marketplace
- Machinery marketplace
- Simple services marketplace
- Four curated category families
- Server-side search, filtering, sorting, and pagination
- Product and service cards/details
- Create, draft, preview, publish, edit, pause, mark unavailable, renew, and
  delete listing/service advertisements
- My Listings combining products and services
- Listing/service image uploads and independent storage
- Call seller
- WhatsApp seller
- Optional email seller
- Favourites for product listings
- User/listing/service reports
- Manual moderation
- Safety guidance
- Help/FAQ content
- Contact Support form routed to a monitored founder inbox
- Five-page admin panel
- Durable audit log
- Location reference data
- Terms/privacy content
- Environment validation
- Feature flags
- Consistent loading, empty, error, retry, offline, and permission states

### Deferred — retained but disabled at launch

- Google OAuth
- Phone OTP verification
- Dark mode launch support
- In-app messaging and attachments
- Price-drop and status alerts
- Marketplace notification delivery/inbox
- Identity verification and document uploads
- Payments and checkout
- Escrow
- Premium listings and package selection
- Subscriptions
- Transactional payout architecture
- Verification administration
- Payment/subscription administration
- Bulk PDF extraction
- Marketing email
- Scheduled reminders
- AI content moderation
- AI ban-evasion detection
- AI ticket triage
- AI/document extraction
- Full support ticket lifecycle and attachments

Deferred capabilities must remain behind fail-closed route, API, job, provider,
and server controls. Hiding a menu item alone is insufficient.

### Removed from the V1 product surface

- Global live currency conversion/picker
- Pricing/packages page
- Market Insights
- Valuation Tool
- Agent Directory
- Listing variants and bidding
- Exact residential map pin
- Separate seller-rating system
- Duplicate Notification Center
- Transaction History
- Support agents, teams, settings, and templates
- Duplicate public support pages
- Duplicate admin support pages
- Browser FAQ administration
- Browser email-template administration
- Neighbourhood CMS
- AI support agents/chat
- Alternate practitioner/business dashboards
- Decorative reveal animations, random gradients, glow, and glass effects

“Removed from V1” means unavailable in the launch product. It does not
authorize immediate source or data deletion.

### Future Version — valuable after launch evidence

- Apple OAuth
- Business and organisation profiles
- Dealer pages and dealer tools
- Business/dealer verification
- Lawyer directory, profiles, and verification
- Legal bookings, portals, disputes, and payments
- Service bookings and disputes
- Reviews with defensible interaction proof
- Follows/social graph
- Map browsing
- Bulk CSV import
- Duplicate listing tool
- Announcements
- Full analytics page
- Organisation memberships and capabilities
- Saved searches and alerts

---

## 6. VERIFICATION DECISION

Recommendation: verification should be disabled and deferred for V1, then
redesigned before it returns.

The existing verification concept asks for sensitive documents but does not
currently have a complete independent solution for:

- secure private storage;
- malware and hostile-file scanning;
- fake, stolen, or altered document detection;
- reviewer training and consistency;
- review evidence and audit;
- approval expiry;
- appeals and disputes;
- data retention and deletion;
- breach/privacy response; or
- a precise definition of what a verification badge means.

Manual document review creates recurring operating cost and may create false
confidence. A forged document can appear plausible, and a generic “Verified”
badge may imply guarantees FindIt cannot make.

V1 trust should instead use:

- confirmed email;
- clear account age;
- accurate listing details and photos;
- explicit seller contact information;
- safety guidance;
- user reports;
- rate limits and abuse controls;
- fast manual moderation; and
- transparent listing/account status.

Verification may return in stages:

1. Email confirmed
2. Phone confirmed
3. Identity checked through an approved specialist provider
4. Business/dealer/professional credentials checked with expiry and appeals

Each claim must state exactly what was checked. A generic “Verified Seller”
badge is not recommended.

---

## 7. USER ROLE MODEL

V1 should use exactly two stored application roles:

- `user`
- `admin`

Guests are anonymous requests, not stored roles.

### User

Every active user may:

- browse and contact;
- manage their profile/contact preferences;
- create and manage their own product listings;
- create and manage their own services;
- save product listings;
- report a listing, service, or user; and
- view their own moderation status where appropriate.

### Admin

An admin may:

- use the five approved admin pages;
- moderate products and services;
- review reports;
- suspend, ban, restore, or unban accounts under policy; and
- view durable audit history.

Every punitive action requires a reason and durable audit event.

### Concepts that should not be roles

- Seller: user who owns a listing
- Service provider: user who owns a service
- Dealer: future organisation/profile capability
- Business: future organisation/profile capability
- Lawyer/practitioner: future professional profile and credential capability
- Moderator: admin capability until the team becomes large enough to justify
  more granular staff permissions
- Super admin: audited operational break-glass procedure, not a normal product
  role

Permissions should primarily depend on ownership, participation, active account
status, and narrow admin operations.

---

## 8. ADMIN PANEL

The V1 admin panel should contain exactly five destinations.

### 1. Overview

Show only actionable information:

- published, pending, paused, rejected, and removed inventory;
- open reports and oldest report age;
- active, suspended, and banned users;
- recent moderation actions; and
- relevant storage/provider/job health.

Do not include revenue, subscription, verification, legal, support-agent, or
decorative analytics cards.

### 2. Marketplace

Moderate product and service advertisements in one place.

Include:

- Product and Services tabs;
- server-side search, filter, sort, and pagination;
- owner and report context;
- public preview;
- publish/restore, pause/hide, reject, and remove actions;
- mandatory reason; and
- audit result/reference.

### 3. Users

Include:

- approved identifier search;
- account status filters;
- account, inventory, and report context;
- suspend with reason/optional expiry;
- ban with reason; and
- unban/restore with reason.

Do not provide arbitrary profile editing, service-role access, verification
document access, payment history, or normal-browser super-admin controls.

### 4. Reports

One queue for listing, service, and user reports.

Include:

- open, investigating, actioned, dismissed, and closed states;
- report reason, target, age, and related report count;
- safe reporter notes;
- target and account context;
- resolution reason; and
- linked moderation/audit result.

No AI triage, workforce assignment, or enterprise SLA system at launch.

### 5. Audit Log

Read-only history containing:

- actor;
- action;
- resource;
- timestamp;
- result;
- reason; and
- correlation ID.

Audit records must be durable, protected, and redacted. If a required audit
write fails, the privileged action should fail.

All other current admin pages are deferred, future, or removed from the V1
surface.

---

## 9. DATABASE SIMPLIFICATION

The current proposed Supabase schema contains 41 tables. V1 should actively use
only the tables required by the approved launch product.

### Keep active for V1

1. `users`
2. `audit_logs`
3. `locations`
4. `listings`
5. `car_details`
6. `property_details`
7. `machinery_details`
8. `services`
9. `saved_listings`
10. `reports`
11. `terms`

Recommended new active table after approval:

12. `media_assets` for listing/service image ownership, validation, ordering,
    lifecycle, dimensions, MIME, bytes, checksum, scan state, and derivatives.

### Defer from the V1 runtime

- `user_presence`
- `service_bookings`
- `service_disputes`
- `legal_specializations`
- `legal_practitioners`
- `legal_bookings`
- `practitioner_reviews`
- `follows`
- `reviews`
- `inquiries`
- `app_alerts`
- `business_profiles`
- `verification_requests`
- `payments`
- `escrow_transactions`
- `subscriptions`
- `practitioner_payouts`
- `support_tickets`
- `support_messages`
- `ticket_attachments`
- `ticket_activity_log`
- `announcements`

### Remove from the V1 target after evidence and approval

- `admin_teams`
- `neighbourhoods`
- `seller_ratings`
- `support_agents`
- `ticket_templates`
- `support_settings`
- `faqs`
- `email_templates`

No table should be dropped until production data/export evidence, retention
duties, backup, reconciliation, migration, rollback, and restore procedures are
approved.

### Listing simplification

Keep:

- owner;
- category/kind;
- title and description;
- price/currency or Contact for price;
- approximate location;
- contact methods;
- category-specific facts;
- status;
- timestamps; and
- image relationships.

Remove from the V1 contract:

- premium/package/boost fields;
- deposits and agent/additional fee systems;
- variants and bidding;
- exact coordinates;
- document visibility; and
- generic verification state.

Recommended listing lifecycle:

`draft → published ↔ paused → unavailable or expired`

Use `pending_review`, `rejected`, and `removed` only where moderation policy
requires them.

### Security requirements

- UUID relationships, not email references
- Server/database ownership and account-status checks
- Full anonymous/user/other-user/suspended/admin role matrix
- Column-level managed-field protection
- Published-only public reads
- Owner-only drafts and management
- Typed report targets
- Append-only durable audit
- Media ownership tied to parent listing/service
- Deferred deployed tables explicitly denied or protected

---

## 10. NAVIGATION

### Desktop navigation

- FindIt logo/Home
- Browse/Search
- Services shortcut
- Post listing
- Favourites when signed in
- Account menu
- Admin link for admins only

Account menu:

- My Listings
- Profile & Settings
- Favourites
- Help
- Sign out

### Mobile bottom navigation

- Home
- Search
- Post
- Favourites
- Account

Services should remain a Home/Search category rather than occupy a permanent
mobile-navigation slot.

Remove Pricing, Alerts, Notifications, currency conversion, verification,
transactions, businesses, dealers, agents, and legal services from V1
navigation.

---

## 11. CORE SCREEN SPECIFICATIONS

### Home

Include:

- concise marketplace promise;
- prominent search;
- four category shortcuts;
- one recent-listings section;
- practical safety guidance; and
- footer links.

Remove repeated Hot Right Now/New to Market/Latest sections and decorative
reveal animation.

### Search and categories

Include:

- query;
- category tabs;
- location;
- price/currency;
- essential category filters;
- result count;
- sort;
- server pagination; and
- URL-persisted state.

Mobile uses a filter sheet with applied count, Clear, and Apply. Search must
operate over the full database rather than the first 100 records.

### Listing card

Show:

- image;
- category;
- title;
- price/currency;
- location;
- two or three essential facts; and
- favourite action.

Do not show premium ribbons, unqualified verified badges, view-count vanity,
random gradients, or multiple contact actions.

### Product listing detail

Use one shared structure for property, vehicle, and machinery:

1. Gallery
2. Title, price, location, update date
3. Category-specific facts
4. Description
5. Seller summary
6. Safety guidance
7. Report action
8. Related listings

Desktop has a sticky contact card. Mobile has a bottom Call/WhatsApp bar.
Seller viewing their own listing sees Manage.

### Service browse/detail

Use the same Search and detail language, with service category, service area,
pricing meaning, provider, and direct contact. No booking, disputes, ratings,
credentials, or payment actions.

### Seller profile

Use an opaque public ID rather than email in the URL. Show display name,
member-since date, explicit confirmed facts, and active inventory. Do not show
followers, ratings, private email, or generic verification.

### Login

Email, password, Forgot password, Log in, and Create account. Hide OAuth until
approved and tested. Preserve safe return URL and show normalized inline errors.

### Register

Display name, email, password, confirmation, and terms/privacy acceptance.
Phone/contact may be requested when needed for posting. No role, business,
verification, subscription, or marketing complexity.

### Forgot/reset password

Forgot password always gives generic success. Reset password requires a real
matching recovery event and handles invalid, expired, reused, refreshed, and
multi-tab cases.

### Favourites

Use one term, icon, route, and paginated joined query. Empty state links to
Browse. Optimistic changes roll back on failure.

### Post listing/service

Five steps:

1. Category and offer type
2. Details, price, and category facts
3. Approximate location
4. Photos and contact methods
5. Review and publish

Remove documents, packages, variants, bidding, exact map, and phone OTP.
Draft must survive recoverable failure. Publish must be idempotent.

### My Listings

Combine products and services. Filters: All, Published, Draft, Paused,
Unavailable/Expired. Actions: View, Edit, Pause/Resume, Mark unavailable,
Renew, Delete. Use one server-paginated owner query.

### Account

Combine Profile and Settings:

- display name and email;
- phone/contact preferences;
- security/password;
- terms/privacy;
- data export/delete; and
- sign out.

### Help and Contact Support

Help contains buying, selling, accounts, reports, safety, privacy, and terms.
Contact Support collects category, email, message, and optional listing/report
reference. No attachment or customer ticket portal.

### Error and system states

Provide dedicated states for:

- Not found
- Listing unavailable
- Permission denied
- Sign-in required
- Account blocked
- Temporary service failure
- Offline
- Invalid/expired authentication link

Each state needs an accurate explanation and safe next action. No indefinite
spinner or raw provider error.

---

## 12. DESIGN SYSTEM

### Visual direction

FindIt should look professional, modern, restrained, and marketplace-focused.
Use actual listing imagery and clear information hierarchy rather than
decoration.

Avoid:

- random gradients;
- glassmorphism;
- glow;
- oversized rounded corners;
- page-specific colours;
- emoji as core status icons;
- multiple button styles for the same action;
- decorative animation;
- AI-style placeholder illustrations; and
- unsupported trust badges.

### Typography

Use self-hosted Inter or the system sans-serif stack.

- Display: 40/32 px, weight 700
- H1: 32/28 px, weight 700
- H2: 24/22 px, weight 650–700
- H3: 18 px, weight 600
- Body: 16 px
- Small body: 14 px
- Caption: 12 px for non-critical metadata only
- Price: 24/22 px, weight 700

### Spacing

Use a 4 px scale:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

- 16 px mobile page gutter
- 24 px tablet gutter
- 32 px desktop gutter
- 1200 px maximum marketplace content width
- 640–720 px form/read width

### Colours

- Background: `#F8FAFC`
- Surface: `#FFFFFF`
- Foreground: `#0F172A`
- Muted text: `#475569`
- Border: `#E2E8F0`
- Primary: `#0F766E`
- Success: `#15803D`
- Warning: `#B45309`
- Danger: `#B91C1C`
- Info: `#1D4ED8`

Colour never communicates status alone.

### Radius and elevation

- Controls: 8 px
- Cards/sheets: 12 px
- Dialog/media: 12–16 px
- Pills only for filters, tags, and status
- Most cards use border and no shadow
- Sticky nav uses subtle shadow
- Dialogs use one stronger elevation

### Controls

- Minimum 44 px touch target
- One primary action per area
- Visible focus state
- Persistent form labels
- Inline field errors and long-form error summary
- Stable-width loading buttons
- Labelled icon actions
- Confirm named destructive actions

### Motion

- 120–200 ms feedback transitions
- 200–250 ms dialog/sheet transitions
- No scroll reveal, bouncing CTA, autoplay, parallax, or decorative animation
- Respect reduced-motion preferences

---

## 13. MOBILE AND ACCESSIBILITY REQUIREMENTS

### Mobile

- 44 px touch targets
- 16 px gutters
- Safe-area-aware bottom navigation and contact bar
- Full-width form layout
- Filter bottom sheet
- Swipe gallery with image count
- Per-image upload progress/retry
- No horizontal overflow on user screens
- Keyboard must not cover active field or Submit/Apply
- Draft persists across safe navigation and recoverable errors

### Accessibility

- Semantic landmarks and headings
- One H1 per page
- Associated labels, helper text, and errors
- Visible focus-visible ring
- Keyboard operation for filters, galleries, menus, dialogs, and admin
- 4.5:1 normal text contrast
- Text plus colour for status
- Screen-reader announcements for async results/errors/progress
- 200% zoom/reflow without loss of function
- Reduced-motion support
- Manual keyboard, NVDA, and VoiceOver review of major journeys

---

## 14. PERFORMANCE EXPERIENCE

Recommend:

- route-level lazy loading;
- route error boundaries;
- server-side pagination/filtering/sorting;
- responsive image derivatives;
- progressive image loading;
- lazy images below the fold;
- stable aspect-ratio placeholders;
- layout-matched skeletons;
- local pending feedback;
- safe optimistic Favourites updates with rollback;
- preserving Search state and scroll on Back; and
- avoiding decorative animations and unnecessary subscriptions.

The current approximate 2.1 MB entry bundle and 75 statically imported page
modules should be reduced through approved route scope and measured splitting.

---

## 15. COMPONENT STANDARDIZATION

Standardize:

- one marketplace shell/navigation source;
- one admin shell/navigation source;
- one Page Header;
- one marketplace search/filter system;
- one product card and one service variation;
- one listing grid;
- one image gallery;
- one Price display;
- one Seller summary;
- one Contact action bar;
- one Favourite action;
- one Report action;
- one five-step listing wizard;
- shared creation/edit schemas and fields;
- one secure Image Uploader;
- standardized Loading, Empty, Error, Offline, Permission, and Retry states;
- one toast/feedback system;
- one confirmation dialog;
- one admin data table/filter/detail/reason pattern; and
- one semantic status badge system.

Explicit consolidation candidates include:

- product detail/card/grid variations;
- duplicate preview components;
- duplicate document steps;
- duplicate package steps;
- Alerts and Notification Center;
- active and duplicate support screens;
- duplicate FAQ admin screens;
- three admin navigation definitions; and
- repeated page-level spinner/empty/status implementations.

Consolidation occurs only after approved behavior tests and migration evidence.

---

## 16. MAJOR USER FLOWS

### Browse and contact

Home → Search/category → Apply filters → Listing detail → Review seller/safety →
Call or WhatsApp

### Register from a protected action

Protected action → Register → Confirm email → Session/profile → Return to the
original safe route

### Post listing

Post → Authenticate if necessary → Category → Details/price → Location →
Photos/contact → Review → Publish → View or Manage

### Manage listing

Account → My Listings → Filter/select → View/Edit/Pause/Unavailable/Renew/Delete
→ Confirm → Updated state

### Save favourite

Card/detail Favourite → Authenticate if necessary → Optimistic update → Server
confirmation or rollback → Favourites

### Report

Listing/user Report → Authenticate if necessary → Reason/details → Submit →
Confirmation → Admin Reports → Reasoned action → Audit

### Support

Help → Find answer or Contact Support → Category/email/message/reference →
Confirmation → Founder inbox

### Admin moderation

Admin login → Overview/Reports → Inspect target/context → Choose action → Enter
reason → Protected mutation → Audit result

---

## 17. MIGRATION SCOPE UPDATE

The migration should now prioritize only V1 runtime dependencies.

### Migrate for V1

- Supabase Auth and user/admin role/status
- User profile/current-user reads
- Property, vehicle, machinery, and service data
- Location reference data
- Search repositories/services
- Listing/service create and management
- Favourites
- Reports
- Admin moderation and audit
- Terms/help data where applicable
- Listing/service images and storage
- Approved delete/expire/moderate/user-control/admin-count operations
- Base44 build/client/config removal after V1 cutover

### Do not rebuild for V1

- Messaging/presence/attachments
- Alerts/notification inbox
- Reviews/ratings/follows
- Verification and documents
- Payments/escrow/subscriptions/premium
- Legal/booking/disputes/payouts
- Business/dealer/agent systems
- Bulk imports/extraction
- AI and hosted agents
- Full support ticketing
- Map/valuation/insights
- Announcements/marketing/reminders/full analytics

Non-MVP Base44 dependencies should be inventoried, preserved, disabled,
excluded from the production runtime, and archived only after evidence. Do not
port them solely to reduce dependency counts.

Document 4 still requires no operational Base44 dependency. The shipped V1
must not require the Base44 SDK, token, plugin, configuration, functions,
agents, jobs, storage, or backend. Historical source may remain only in an
approved archive outside the production runtime.

---

## 18. REVISED MIGRATION SEQUENCE

### Product approval gate

- Approve this review pack and the detailed planning documents.
- Obtain Base44 production user/data/storage/configuration evidence.
- Confirm target deployment/provider/owner/budget.

### Phase 0 — MVP reconciliation

- Overlay MVP decisions on feature/dependency/behavior inventories.
- Capture production evidence and baseline screens.
- Classify each dependency as MVP replacement, Deferred dormant, Future
  archive, or removal candidate.

### Phase 1 — V1 database/security

- Decide clean baseline versus additive migration from actual state.
- Implement only the approved active schema and fail-close deferred tables.
- Complete full RLS/action/column/media tests, upgrades, reconciliation,
  rollback, restore, and query plans.

### Phase 2 — V1 authentication

- Complete Supabase email/password auth.
- Eliminate Base44 auth/current-user dependencies from V1.
- Enforce active account and user/admin roles.
- Test registration, confirmation, login, refresh, logout, recovery,
  suspension, admin, and email delivery in staging/browser.

### Phase 3 — V1 vertical slices

1. Public location/listing search/detail
2. Owner listing create/manage
3. Service advertise/browse/contact
4. Favourites
5. Reports/admin moderation/audit
6. Help/Contact Support

Each slice needs repository, service, hook, UI adapter, RLS/server operation,
data migration, contract comparison, tests, observability, and rollback.

### Phase 4 — V1 storage

Migrate only product/service images into secure independent storage. Preserve
non-MVP private objects without activating those features.

### Phases 5–6 — dormant systems

Do not rebuild payments, verification, messaging, AI, legal, support ticketing,
or other excluded products. Remove their Base44 operational dependency through
data preservation, inactive routes/jobs, runtime exclusion, and approved
archive.

### Phase 7 — quality/security/performance

Close V1 Critical/High findings; complete typecheck strategy, automated tests,
rate limits, audit, logging, accessibility, mobile, browser, image, bundle, and
query-plan acceptance.

### Phase 8 — deployment/acceptance

Verify clean install, provisioning, migration, tests, build, deploy, backup,
restore, rollback, monitoring, domain/TLS/SPA routing, email, storage, every V1
workflow, and every excluded-feature denial.

---

## 19. PRIORITIZED DELIVERY PLAN

### P0 — launch blockers

1. Approve route/feature boundary
2. Fail-close excluded capabilities
3. Standardize navigation/account/admin shells
4. Correct server-side Search
5. Simplify Home
6. Standardize cards/details/contact
7. Reduce creation to five steps
8. Consolidate owner inventory/editing
9. Correct Favourites
10. Implement secure image storage/upload
11. Remove verification claims/collection
12. Implement lightweight Help/Support
13. Simplify/secure admin
14. Implement design primitives
15. Standardize all data/error states
16. Complete accessibility and mobile requirements

### P1 — launch quality

1. Route-level bundle splitting
2. Progressive/responsive images
3. Search-state and navigation performance
4. Trust/content copy review
5. Browser and visual regression coverage
6. Production-like data/query performance evidence

### P2 — evidence-led post-launch

- taxonomy refinements;
- service Favourites;
- Google OAuth;
- saved searches/alerts;
- organisations/dealers;
- future ratings, map, analytics, bookings, or payments through separate
  approved specifications.

---

## 20. V1 ACCEPTANCE CRITERIA

Product approval requires:

- only approved MVP routes and navigation are reachable;
- excluded features make no runtime/network/job/provider calls;
- guests can browse and contact across all four categories;
- Search/filter/sort/pagination is complete and correct;
- authentication and account-status flows pass staging/browser tests;
- users can create and maintain products/services;
- image ownership/validation/delivery/deletion passes hostile and role tests;
- Favourites and Reports pass authorization and failure tests;
- the six admin destinations pass positive/negative/audit tests;
- no verification, payment, AI, messaging, legal, premium, or unfinished
  product claim is visible;
- accessibility, mobile, browser, performance, security, backup, restore,
  monitoring, deployment, and rollback evidence is approved;
- all V1 Critical and High defects are closed; and
- no operational Base44 dependency remains.

---

## 21. KNOWN RISKS REQUIRING EXTERNAL EVIDENCE

- Existing Base44 production users and account states are unknown.
- Production entity counts and hidden workflows are unknown.
- Base44 storage objects, privacy, ownership, and checksums are unknown.
- Existing provider and deployment configuration is unknown.
- The current Supabase schema may or may not have been applied outside local
  verification.
- Non-MVP functionality may have production users/data despite being hidden or
  unrouted in source.
- The hybrid Supabase/Base44 identity boundary remains a migration blocker.

These unknowns block destructive cleanup and final migration planning. They do
not block reviewing and approving the proposed product scope.

---

## 22. REVIEW DECISIONS REQUESTED

Please approve, reject, or comment on each decision:

1. Approve four V1 categories: Property, Vehicles, Machinery, Services.
2. Approve direct Call/WhatsApp/Email instead of in-app messaging.
3. Approve free posting with no payments, premium packages, or subscriptions.
4. Approve disabling verification and removing generic verification badges.
5. Approve two roles only: user and admin.
6. Approve six admin destinations only, including lightweight Categories.
7. Approve the eleven-table active V1 schema plus proposed `media_assets`.
8. Approve five-step listing/service creation.
9. Approve one Favourites concept and one combined My Listings surface.
10. Approve lightweight Help/Contact Support instead of full ticketing.
11. Approve the navigation and design-system direction.
12. Approve deferring/removing all other listed capabilities from the V1
    product surface.
13. Approve the revised Base44-to-Supabase migration sequence.

Suggested review response format:

```text
Overall decision: APPROVED / APPROVED WITH CHANGES / REJECTED

1. Four categories: Approve / Change — comments
2. Direct contact instead of messaging: Approve / Change — comments
3. Free launch/no payments: Approve / Change — comments
4. Verification disabled: Approve / Change — comments
5. Two roles: Approve / Change — comments
6. Five-page admin: Approve / Change — comments
7. Database scope: Approve / Change — comments
8. Five-step creation: Approve / Change — comments
9. Favourites/My Listings consolidation: Approve / Change — comments
10. Lightweight support: Approve / Change — comments
11. Navigation/design system: Approve / Change — comments
12. Deferred/removed features: Approve / Change — comments
13. Migration sequence: Approve / Change — comments

Additional required changes:
- ...
```

---

## 23. ANALYSIS COVERAGE

This proposal was derived from inspection of:

- 83 page modules;
- active, hidden, and unrouted routes;
- marketplace and admin navigation;
- 178 component modules;
- 8 hooks and 29 services in the current service layer;
- 40 Base44 entities;
- 59 Base44 functions;
- 3 Base44 agents;
- 49 current Supabase public tables;
- 28 Supabase migrations and 67 public-table RLS policies;
- existing feature flags;
- the current behavior, dependency, architecture, QA, bug, security, and
  migration records; and
- Migration Specification Documents 1–4.

Detailed supporting documents remain in the repository, but this review pack
is intended to be self-contained and easy to copy, send, and annotate.

---

## 24. FINAL RECOMMENDATION

Approve a smaller, sharper V1 focused on trustworthy discovery,
advertising, and direct contact.

Do not resume broad migration or implementation until this product scope is
approved. After approval, migrate one complete V1 vertical slice at a time and
prove behavior, security, data integrity, operations, and rollback before
advancing.

The goal is not to launch the largest possible FindIt. The goal is to launch a
FindIt that real people can understand, trust, use, and recommend — and that a
solo founder can operate confidently.
