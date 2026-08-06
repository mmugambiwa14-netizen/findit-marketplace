# FindIt Current Stage Product Contract

Status: Canonical

Canonical branch: `main`

Purpose: This document defines every feature, workflow, backend dependency, operational requirement, and explicit exclusion that must exist in FindIt at the current product stage. It is the single reference for development, audits, previews, staging verification, release decisions, and future branch work.

No feature is considered complete merely because code exists. A feature is complete only when its frontend, backend, permissions, migrations, data contracts, feature flags, preview behavior, tests, and staging verification all agree.

---

## 1. Product definition

FindIt is a mobile-first marketplace focused on four launch categories:

1. Property
2. Cars
3. Heavy machinery
4. Services related to those categories

The product must support discovery, listing publication, seller and buyer communication, public Peeks, Peek Requests, saved items, notifications, business publishing controls, public business profiles, moderation, administration, privacy-safe locations, and staging-ready PWA behavior.

The primary differentiators are:

- Public Peeks attached to listings
- Buyer Peek Requests
- Curated business publishing
- Category-aware listing intelligence
- Privacy-safe public location display

The current MVP must not introduce seller ratings, trust scores, verified badges used as marketplace reputation, response-time badges, public reputation systems, payments, escrow, subscriptions, premium listings, advertising, or AI-branded user-facing features.

---

## 2. Source-of-truth and delivery rules

### 2.1 Canonical branch

`main` is the only authoritative product state.

All previews, staging deployments, production deployments, migration ledgers, feature status, and release evidence must derive from `main`.

### 2.2 Branch workflow

Allowed workflow:

`feature/*` or `fix/*` -> pull request -> validation -> merge into `main` -> delete or archive branch

A feature branch must never be treated as a separate product version. A feature is not complete until it is merged into `main`.

### 2.3 Required traceability

Every feature must be traceable through:

- product requirement
- code implementation
- pull request or canonical commit
- database migration where applicable
- feature flag where applicable
- staging activation
- staging verification
- release status

Supporting records:

- `docs/CURRENT_STAGE_PRODUCT_CONTRACT.md`
- `docs/PRODUCT_PROGRESS.md`
- `docs/MIGRATION_LEDGER.md`
- `docs/FEATURE_FLAGS.md`
- `docs/ENVIRONMENT_VARIABLES.md`

---

## 3. Environments

The project must support:

### 3.1 Local

Used for development, unit tests, contract tests, migration validation, and local PWA testing.

### 3.2 Preview

Current preview platform: GitHub Pages.

Preview must deploy from `main`, use the repository base path, include SPA fallback routing, and expose all features certified for this stage.

Current preview URL:

`https://mmugambiwa14-netizen.github.io/findit-marketplace/`

### 3.3 Staging backend

Current staging Supabase project:

`FindIt Staging`

Project reference:

`bwgklpxoetrrkutottdb`

The preview frontend must point to this staging backend.

### 3.4 Production

Production must remain separate from staging. Staging fixtures, staging approvals, preview assets, and test data must not be promoted automatically.

---

## 4. Application shell and navigation

The application must provide a responsive mobile-first shell with:

- bottom navigation on mobile
- accessible desktop navigation where appropriate
- safe-area handling
- persistent PWA behavior
- loading states
- offline and reconnect handling
- route-aware back navigation
- legal and help access

Primary navigation must include:

- Discover
- Peek
- Post
- Chats
- Profile

Legacy URLs must redirect cleanly where supported, including older messages, tours, create, FAQs, and support paths.

---

## 5. Authentication and account lifecycle

The application must support:

- email registration
- email login
- password reset request
- password reset completion
- persistent authenticated sessions
- logout
- profile bootstrap after authentication
- missing-profile recovery
- blocked-account handling
- role-aware access
- administrator access control
- Google OAuth when provider configuration is active

The following states must be handled explicitly:

- unauthenticated
- loading authentication
- authenticated active user
- authenticated user missing marketplace profile
- blocked user
- banned user
- expired or invalid session
- Supabase or network unavailable

Protected routes must redirect unauthenticated users to login while preserving the intended return path.

---

## 6. User profile and account settings

Users must be able to:

- view and edit basic profile information
- manage avatar where enabled
- access saved listings
- access their listings
- access their services
- access Peek Requests
- access chats
- access notifications
- manage supported settings
- view legal documents
- contact support
- request account deletion

The current product must preserve privacy boundaries around email, phone, exact location, and seller contact information.

---

## 7. Marketplace discovery

### 7.1 Home / Discover

The Discover experience must display available and under-offer inventory across:

- Property
- Cars
- Heavy machinery
- Services

Required behaviors:

- category sections
- listing cards
- service cards
- thumbnail or safe fallback state
- price and currency display
- public location label
- listing status
- saved state
- Peek availability indicator where applicable
- view details action
- responsive loading skeletons
- empty states
- error recovery

### 7.2 Listing card media

Listing cards must use the listing `photos` contract or approved listing-media projection.

At staging, sample marketplace listings may use external demo image URLs. Preview fixtures must be enabled only for staging and must not weaken production media rules.

A missing image must render a deliberate placeholder rather than a broken image element.

### 7.3 Search

Search must support:

- Property search
- Car search
- Machinery search
- category selection
- title search
- location filtering where available
- price range
- category-specific filters
- sort by newest
- sort by price ascending
- sort by price descending
- sort by most viewed
- keyset pagination or bounded pagination
- title suggestions
- empty results
- loading and retry states

### 7.4 Category counts

Discover category counts must come from the durable backend contract and must not rely on downloading every listing.

---

## 8. Listing detail experience

Property, car, and machinery listings must use one shared product structure with category-aware specifications.

Required sections:

### 8.1 Media area

- photos
- Public Peek when available
- safe missing-media state
- thumbnail navigation
- full media view where implemented

### 8.2 Listing Info

Must include:

- title
- price
- currency
- category
- listing type
- status or availability
- views
- posted time
- listing code
- category-specific specifications
- public location
- seller identity
- Public Peek action
- Request a Peek action
- Save action
- Share action
- safety guidance

### 8.3 Description

Seller-written description only.

Must support read more and read less for long content.

### 8.4 Location

Must show only privacy-safe public location information.

Exact private location must not be exposed through public queries, listing cards, maps, URLs, or frontend state.

### 8.5 Seller

Must provide seller summary and appropriate contact-reveal behavior.

Seller contact values must be protected and revealed through authenticated controlled RPCs rather than unrestricted public selection.

---

## 9. Listing publication

Authenticated users must be able to start listing publication from `/post`.

Supported listing kinds:

- Property
- Car
- Machinery

Required creation stages:

- category selection
- listing type selection
- title
- description
- price and currency
- category-specific attributes
- public and private location capture
- contact preferences
- photo upload
- validation
- review
- submission

Required behavior:

- draft-safe field preservation
- validation before submission
- safe media upload contracts
- clear failure states
- duplicate-safe submission
- database-boundary enforcement

At this stage, general public listing creation is governed by curated business publishing rules described below.

---

## 10. Services marketplace

The application must support:

- public services catalogue
- service cards
- service detail page
- service provider information
- service pricing type
- service location and travel behavior
- active/inactive service status
- service image handling
- provider-owned service management
- curated service creation

Service categories must remain relevant to the FindIt launch focus. Legal services remain outside the MVP public marketplace contract.

---

## 11. Curated verified-business marketplace

This is a required current-stage feature.

### 11.1 Purpose

Publishing is controlled by category-specific business approval rather than open unrestricted seller publication.

The approval system must enforce permissions at the database boundary, not only in frontend UI.

### 11.2 Business application flow

Authenticated users must be able to submit a business application containing:

- business name
- contact name
- business email
- business phone
- country
- city
- business description
- website where applicable
- social URL where applicable
- expected inventory band
- requested publishing categories

Supported approval categories:

- property
- car
- machinery
- service

### 11.3 Application states

The product must support:

- not started
- submitted
- reviewing
- needs information
- approved
- rejected

### 11.4 Applicant follow-up

When information is requested, the applicant must be able to respond through the application flow.

### 11.5 Category approvals

Each requested category must have an independent status:

- pending
- approved
- rejected
- suspended

A business may be approved for one category and not another.

### 11.6 Publishing gate

Before listing or service creation, the app must load `get_my_publishing_access` and determine:

- application status
- approved categories
- pending categories
- suspended categories
- whether more information is required
- reviewer message

The UI must prevent unsupported publication and guide the user toward the required application or follow-up action.

### 11.7 Database enforcement

The database must reject publication attempts for categories the user is not approved to publish.

Frontend gating alone is insufficient.

### 11.8 Legacy publisher transition

Existing publishers may be placed into a review queue. Legacy data must not silently bypass the curated publishing boundary.

### 11.9 Public business profile

Approved businesses must be able to maintain a public business profile with:

- company name
- business type
- profile type
- phone or email
- website
- approved social links
- city
- address where permitted
- description
- avatar or logo
- public inventory
- public services

Public profile URLs must use validated HTTP or HTTPS schemes. Unsafe URLs must be rejected both on write and on render.

### 11.10 Managed listings

Users must be able to submit managed listing requests containing:

- category
- owner name
- contact details
- country
- city
- item summary
- price expectation

Administrators must be able to review and update managed listing request state.

### 11.11 Current staging business state

The primary staging administrator account is approved for:

- Property
- Cars
- Machinery
- Services

A verified public business profile exists for this account in staging.

This staging approval is operational data and does not replace the general approval workflow.

---

## 12. Peeks

Peeks are a required current-stage differentiator.

### 12.1 Public Peek

A listing may have one current published Peek that provides recent visual evidence.

Required behavior:

- Peek availability indicator on listing cards or details
- Peek thumbnail
- playback
- duration where available
- moderation status
- publication status
- safe unavailable state
- view tracking

### 12.2 Peek asset lifecycle

The backend must support:

- source upload intent
- source asset
- processing
- playback derivative
- thumbnail derivative
- moderation
- approval
- publication
- replacement or supersession
- cleanup
- retention controls

Large media must not be proxied through the primary application server.

### 12.3 Peek catalogue

The Peek area must display available published Peeks from staging when the certified feature is enabled.

### 12.4 Current staging Peek state

Staging contains published tour/Peek records. Most have both playback and thumbnail assets. Any record missing a derivative must render a controlled unavailable or processing state rather than breaking the page.

---

## 13. Peek Requests

Authenticated buyers must be able to request a current Peek for a listing.

Required request flow:

- open listing
- choose Request a Peek
- provide or select request details
- submit request
- view request state
- support an existing request where applicable
- receive updates
- view attached response Peek when completed

Required backend behavior:

- access-controlled request creation
- request read boundary
- supporter tracking
- initial supporter count correctness
- duplicate prevention
- response binding
- successful Peek auto-publication where rules permit
- alert and notification events

The absence of existing staging request rows must not be confused with a broken feature. The flow must be tested through creation of a real authenticated staging request.

---

## 14. Saved listings

Authenticated users must be able to:

- save a listing
- unsave a listing
- view saved listings
- preserve saved state across sessions
- handle deleted or unavailable listings gracefully

Saved inventory must continue to respect public visibility and RLS rules.

---

## 15. Messaging

Messaging is a required certified feature.

Required behavior:

- start or continue a listing conversation
- inbox list
- conversation metadata
- paginated message history
- send text messages
- mark conversation seen
- unread state
- active-thread refresh
- refresh on reconnect
- refresh on window focus
- listing context in thread
- conversation blocking
- conversation reporting
- closed or unavailable conversation state

The current architecture uses polling and refetch behavior for active conversations. Older incompatible realtime wrappers must not be reintroduced without an explicit architecture decision.

---

## 16. Notifications

Essential notifications must support:

- unread state
- notification centre
- mark as read
- mark all as read where supported
- deep links to relevant product routes
- listing events
- Peek Request events
- business application events
- category approval events
- managed listing events
- web push delivery where configured
- transactional email notification infrastructure where configured

Notification routes must be allowlisted and safe.

---

## 17. Maps and location privacy

### 17.1 Public location

Public inventory may expose:

- public city or locality label
- reduced-precision public coordinates
- map marker based on public coordinates

### 17.2 Private location

Exact seller location must remain private and separately stored.

### 17.3 Map behavior

When MapTiler or another configured provider is active, the app must support:

- listing map preview
- privacy-safe marker
- public location context
- fallback when provider key is missing

Manual location selection is required. Current-location behavior must remain consent-gated and staging-certified.

---

## 18. Seller contact boundary

Public listing and service queries must not expose unrestricted contact values.

The application must use purpose-built authenticated contact reveal functions.

Required protections:

- no contact values in anonymous listing projections
- no private seller identifiers in public profile projections
- no unrestricted grants that bypass RLS
- logged-out users receive safe prompts rather than hidden contact leakage

---

## 19. Reporting, moderation, and safety

Users must be able to report supported content and conversations.

Required moderation areas:

- listing reports
- Peek reports
- conversation reports
- user reports where supported
- support requests
- content status updates
- audit records

Safety guidance must appear where users may contact sellers, request Peeks, or transact outside the platform.

FindIt does not provide escrow, payment protection, or emergency services at this stage.

---

## 20. Administrator console

Administrator routes must require the admin role.

Required admin areas:

- dashboard
- listings
- Peeks
- users
- reports
- support requests
- categories
- business applications
- managed listings
- audit log

### 20.1 Business application administration

Admins must be able to:

- list applications
- filter by status
- start review
- request information
- reject application
- approve individual categories
- reject individual categories
- suspend categories
- reinstate approved categories
- leave reviewer messages

### 20.2 Managed listing administration

Admins must be able to:

- list managed listing requests
- filter by status
- update request state
- assign work where supported
- provide applicant-facing messages

### 20.3 Admin data access

Admin RPCs must:

- require authenticated access
- enforce admin role internally
- deny anonymous execution
- use bounded keyset pagination where required
- create audit evidence

---

## 21. Help, support, and legal

Required pages:

- FAQs
- Contact Support
- Privacy Policy
- Data Protection notice
- Terms of Service
- legal index or legal document router

Support requests must use controlled backend functions and must not expose private support content publicly.

---

## 22. PWA and mobile-web behavior

The application must behave as an installable PWA where supported.

Required capabilities:

- manifest
- service worker
- install prompt
- safe-area support
- offline shell behavior
- network reconnect recovery
- update handling
- cache versioning
- SPA route fallback on GitHub Pages
- no permanent stale-build lock

Staging preview changes must invalidate or update cached assets predictably.

---

## 23. Media handling

### 23.1 Listing and service photos

Must support:

- safe image URLs
- storage paths where applicable
- upload validation
- media ordering
- lifecycle cleanup
- fallback placeholders

### 23.2 Peek video

Must support:

- bounded duration
- upload intent
- processing
- playback derivative
- thumbnail
- moderation
- publication
- cleanup

### 23.3 Staging fixtures

Staging may use controlled external demo images. Production must use the approved storage and media lifecycle contracts.

---

## 24. Database and backend requirements

The backend must provide:

- PostgreSQL
- Supabase Auth
- RLS
- explicit RPC boundaries
- private helper schema where used
- migration history
- storage policies
- notification tables and functions
- listing and service contracts
- Peek contracts
- business publishing contracts
- auditability
- retention and cleanup jobs

### 24.1 Migration rule

Every schema change must be represented by a migration in the repository and recorded in Supabase migration history.

Manual schema drift is not acceptable as a permanent state.

### 24.2 Staging migration state

The current staging project includes the listing, location, messaging, notification, Peek, recommendation, privacy, and curated business migration families required for this stage.

---

## 25. Security requirements

Required controls:

- row-level security
- least-privilege grants
- anonymous execution denial for authenticated RPCs
- database-boundary business publishing enforcement
- private contact reveal boundary
- safe URL validation
- HTML and script injection resistance
- bundle secret scanning
- no service-role key in frontend bundles
- no private key material in repository or browser output
- safe error handling
- role-based admin routes
- audit logging
- rate limiting where available
- Cloudflare or equivalent perimeter protection for production

---

## 26. Performance and scale requirements

Current code must avoid obvious scale blockers.

Required patterns:

- keyset pagination for large feeds and admin lists
- bounded page sizes
- no full-city listing downloads
- no unrestricted `select *` public contracts
- explicit projections
- media served directly from storage or CDN
- connection pooling in hosted backend
- indexed public search fields
- indexed foreign keys where required
- cache-safe public projections
- controlled view counting
- cleanup queues for media

---

## 27. Observability and release controls

Required release checks:

- environment validation
- production build
- bundle secret verification
- migration contract tests
- feature flag contract tests
- database certification tests
- PWA route fallback generation
- Pages artifact deployment

Operational visibility must include:

- frontend error tracking where configured
- database logs
- auth logs
- API logs
- storage logs
- deployment status
- migration ledger
- audit events

The obsolete Vercel build-rate failure is not part of the canonical GitHub Pages deployment and should not be used as the health signal for this preview.

---

## 28. Required staging data for a meaningful preview

Staging must contain enough data to demonstrate the product without weakening production boundaries.

Required sample state:

- listings in Property, Cars, and Machinery
- listing card images
- category detail records
- active services
- at least one seller with a public business profile
- at least one approved publishing account
- published Peeks with thumbnails and playback
- ability to create a Peek Request
- messaging-capable accounts
- essential notification infrastructure
- administrator account

Staging data must be clearly non-production and safely removable.

---

## 29. Features explicitly enabled at this stage

The current preview and staging product must enable:

- business profiles
- curated business marketplace
- messaging
- essential notifications
- Peeks
- Peek preview catalogue
- manual location
- current location when certified
- reporting
- maps when provider configuration is present
- Google OAuth when provider configuration is present
- staging preview fixtures

---

## 30. Features explicitly disabled at this stage

The following must remain disabled until their complete product contracts exist:

- payments
- subscriptions
- escrow
- premium listings
- advertising
- monetisation
- phone verification
- currency conversion
- broad international listing flow
- unrestricted service radius features
- automated listing expiry
- listing freshness reminders
- AI moderation
- AI ban-evasion detection
- AI ticket triage
- AI support chat
- scheduled reminders
- marketing emails
- seller ratings
- trust scores
- verified reputation badges
- response-time badges
- public reputation systems

A disabled feature must not appear as a fake working placeholder unless explicitly marked as a preview-only placeholder.

---

## 31. Current acceptance checklist

The app at this stage is acceptable only when all of the following are true:

### Repository

- `main` is canonical
- no hidden feature branch contains required unmerged product work
- product and migration ledgers are current

### Preview

- GitHub Pages deploy succeeds from `main`
- SPA routes work on refresh
- current build is not trapped behind stale PWA cache

### Discovery

- listing cards load
- sample card images render
- categories display
- search works
- details open

### Peeks

- Peek navigation is visible
- published Peek thumbnails render
- playback works
- listing detail links to Public Peek
- authenticated user can submit a Peek Request
- request state can be viewed

### Business

- application flow opens
- primary staging account shows approved categories
- approved publishing path works
- unapproved publishing is rejected
- public business profile opens
- admin application queue opens
- managed listing request flow works

### Messaging

- inbox loads
- thread loads
- send works
- refresh works
- block and report controls work

### Notifications

- notification centre loads
- business and Peek events are supported
- read state works

### Admin

- admin routes require role
- listings, Peeks, reports, users, support, categories, business applications, managed listings, and audit areas load

### Security

- anonymous users cannot call authenticated business or admin RPCs
- exact seller locations remain private
- contact values are not exposed in public listing projections
- unsafe URLs are rejected

---

## 32. Definition of done for any future feature

A future feature is done only when:

1. Product behavior is documented.
2. Frontend implementation exists.
3. Backend implementation exists where required.
4. RLS and grants are correct.
5. Migration is committed and applied.
6. Feature flag policy is defined.
7. Staging environment is configured.
8. Tests pass.
9. Staging user flow is verified.
10. Product progress and migration ledgers are updated.
11. Work is merged into `main`.
12. Temporary branch is closed or deleted.

---

## 33. Canonical release statement

At the current stage, FindIt must operate as one integrated marketplace application containing discovery, category-aware listings, services, Peeks, Peek Requests, messaging, saved listings, essential notifications, curated business publishing, public business profiles, managed listing requests, privacy-safe locations, support, moderation, administration, PWA behavior, and the Supabase backend contracts required to support them.

Anything implemented elsewhere in the repository but absent from `main`, disabled without a documented reason, missing its backend dependency, or unverified in staging is not considered part of the working product.
