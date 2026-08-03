# FindIt V1 Database Simplification Plan

Status: **Approved target plan; database changes still require additive migration review**  
Current baseline: 12 migrations, 41 public tables, 82 RLS policies

## Objective

The current schema mirrors nearly every feature in the Base44 application.
That was useful for dependency discovery, but it makes a solo-founder MVP
responsible for security, tests, backups, retention, and operations across
payments, verification, legal, rich messaging, support, social, content, and AI
features that will not launch.

V1 should actively use only the data needed for accounts, discovery,
advertising, lightweight business/dealer identity, plain-text messaging,
essential notifications, favourites, moderation, audit, terms, and listing
images. Existing
production data must be exported and reconciled before any table is dropped,
rewritten, or excluded from a deployed baseline.

## Classification meanings

- **Keep** — active V1 table; must receive complete schema, RLS, test,
  migration, backup, and operational coverage.
- **Defer** — excluded from V1 runtime but preserved for a future capability or
  historical data decision. It must not create live routes/jobs/permissions.
- **Remove from V1 target** — redundant or unnecessary for the approved V1
  product. Actual deletion/archive requires production evidence, an approved
  migration, backup, reconciliation, and rollback plan.

## Table decisions

| Current table | Decision | V1 rationale and treatment |
|---|---|---|
| `users` | Keep | Core account/profile/status/role record. Reduce the active contract to user/admin, contact preferences, status, and timestamps. |
| `admin_teams` | Remove from V1 target | One admin role and narrow operations are sufficient. Future staff capabilities should use an explicit membership model. |
| `user_presence` | Defer | Minimal V1 messaging has no online presence or typing state. No presence tracking at launch. |
| `audit_logs` | Keep | Required durable evidence for privileged actions. Add result/correlation fields and prevent fail-open writes. |
| `locations` | Keep | One hierarchical Zimbabwe reference model supports category search and approximate listing location. |
| `neighbourhoods` | Remove from V1 target | Duplicates location concepts and adds content/ratings/price analytics plus an admin CMS. Useful areas belong in `locations`. |
| `listings` | Keep | Core product marketplace parent record. Simplify fields and state machine as described below. |
| `car_details` | Keep | Category-specific vehicle facts with 1:1 parent integrity. |
| `property_details` | Keep | Category-specific property facts with 1:1 parent integrity. |
| `machinery_details` | Keep | Category-specific machinery facts with 1:1 parent integrity. |
| `services` | Keep | V1 service advertisements support browse/contact, not bookings. Simplify its fields/status and use the same moderation conventions as listings. |
| `service_bookings` | Defer | No V1 booking workflow; its ambiguous practitioner relationship must not be resolved speculatively. |
| `service_disputes` | Defer | No V1 booking/payment dispute workflow. Preserve historical contracts until future product design. |
| `legal_specializations` | Defer | Future legal vertical reference data. |
| `legal_practitioners` | Defer | Future professional-profile and verification product. |
| `legal_bookings` | Defer | Future legal booking/payment product. |
| `practitioner_reviews` | Defer | Future legal reputation model; no V1 transaction proof. |
| `follows` | Defer | Social graph is outside V1. Ensure no active notification job relies on it. |
| `saved_listings` | Keep | Powers the single Favourites feature for product listings. Enforce owner and published-target integrity. |
| `reviews` | Defer | Reviews require interaction proof, fraud controls, disputes, and moderation. |
| `seller_ratings` | Remove from V1 target | Duplicates `reviews`; a future reputation model should use one evidence-backed table. |
| `inquiries` | Keep with redesign | Becomes the plain-text message record for listing-linked buyer/seller conversations. Remove attachments/read receipts/presence semantics and add a first-class conversation parent. |
| `app_alerts` | Keep with narrowing | Becomes the essential operational-notification record. Constrain creation to approved event types; no price, marketing, social, or realtime alerts. |
| `business_profiles` | Keep with simplification | Lightweight V1 public identity owned by one user. Dealer is a profile type/presentation, not a role or separate enterprise model. Remove verification and premium semantics. |
| `verification_requests` | Defer | No V1 sensitive-document collection or verification badge. Preserve historical data under strict access/retention. |
| `reports` | Keep | Core listing/user safety queue. Narrow targets, status transition, duplicate/rate, and admin resolution rules. |
| `payments` | Defer | Payments are fail-closed and outside V1. Retain only if existing data or future architecture requires it. |
| `escrow_transactions` | Defer | No funds custody/release/dispute operation in V1. |
| `subscriptions` | Defer | No paid plans or entitlements in V1. |
| `practitioner_payouts` | Defer | Depends on future legal/payment systems. |
| `support_agents` | Remove from V1 target | No support workforce model at launch. |
| `support_tickets` | Defer | Full help-desk is replaced by a founder inbox; preserve any existing user history until export/retention is decided. |
| `support_requests` | Keep | Minimal V1 founder inbox: bounded public submission, opaque reference, no customer lookup/chat/attachment, and narrow audited admin resolution. |
| `support_messages` | Defer | Depends on deferred ticket chat. |
| `ticket_attachments` | Defer | Current behavior is defective and private storage is absent; preserve historical references only. |
| `ticket_activity_log` | Defer | Relevant only to deferred ticket operations. |
| `ticket_templates` | Remove from V1 target | No ticket workflow or template administration in V1. |
| `support_settings` | Remove from V1 target | Configuration belongs in a small validated operational config, not a marketplace table. |
| `announcements` | Defer | Future product communications; V1 uses static/release notices when essential. |
| `faqs` | Remove from V1 target | V1 Help content is version-controlled and deploy-reviewed; remove duplicate FAQ CMS burden. |
| `email_templates` | Remove from V1 target | Auth/transactional templates belong in controlled provider/configuration assets, not a browser-editable table. |
| `terms` | Keep | Versioned public legal documents and acceptance references are required. Content writes remain controlled. |

## Active V1 schema set

The current-table V1 set is fourteen tables:

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
12. `inquiries`
13. `app_alerts`
14. `business_profiles`

Four focused supporting records are recommended through reviewed additive
migrations: `categories`, `conversations`, governed media metadata, and
`support_requests`. That makes eighteen active table concepts. `categories` supports constrained founder-managed
taxonomy without mutable identifiers; `conversations` provides participant
and listing integrity for messages; `media_assets` replaces ungoverned JSON URL
arrays as the authorization and lifecycle source for V1 listing/service images;
and `support_requests` supplies one private founder inbox without activating
the legacy help-desk schema.

## Recommended active-table changes

### `users`

Keep:

- Auth UUID, display name, phone/contact preference;
- role `user|admin`;
- status, reason, optional status expiry;
- created/updated timestamps; and
- terms/privacy acceptance references where required.

Review for removal or isolation after production evidence:

- product-level `super_admin` behavior;
- verification and premium/provider-specific fields;
- any field writable by the profile owner that controls authorization.

Managed-field protection must compare old/new values and trusted operation,
not rely on the client omitting fields.

### `listings`

Keep:

- owner, kind, title, description;
- price and currency, with a clear contact-for-price representation;
- approximate location;
- contact-method snapshot or relationship to owner preferences;
- normalized status;
- view/contact counters only if updated through abuse-resistant operations;
- created/updated/published/expiry timestamps.

Remove from the V1 contract:

- package, boost, premium, deposit, agent fee, additional fees, bidding,
  variants, exact coordinates, document visibility, and generic `verified`;
- `created_via` values for bulk/PDF/duplicate flows until those features return.

Prefer a small state machine:

`draft -> published <-> paused -> unavailable|expired`

with `pending_review`, `rejected`, and `removed` only when moderation policy
requires them. Transitions must be trusted operations, not arbitrary owner
updates.

### Detail tables

Retain normalized 1:1 detail tables and the kind guard. Add only fields needed
by approved category filters/details. Avoid JSON bags for filterable facts.
Use constraints for plausible year, non-negative mileage/usage/size, and
required category facts.

### `services`

Keep browse/contact fields: owner, title, description, curated category,
pricing note/type, optional price/currency, approximate service area,
travel availability, status, and timestamps.

Remove generic `verified`, booking/dispute coupling, credentials, package, and
complex subcategory arrays from V1. Apply the same publish/moderation/contact
conventions as product listings. Do not merge the table with `listings` during
the current migration unless production data and adapter tests prove that the
structural rewrite is safer than retaining it.

### `saved_listings`

Keep a unique `(user_id, listing_id)` pair with cascade behavior and owner-only
access. V1 favourites apply to product listings. Service favourites may be
designed later rather than introducing a polymorphic unverified foreign key.

### `categories` (new recommendation)

Keep a stable ID and slug, parent relationship, marketplace kind, display
label, description if needed for guidance, sort order, active state, and
created/updated timestamps. The four top-level categories are protected from
deletion. Referenced rows may be deactivated but not deleted, and changing a
display label must not change the slug or historical listing relationship.
Only admins may mutate the taxonomy.

### `business_profiles`

Keep one owner, profile type (`business|dealer`), business name, logo asset,
description, contact fields, appropriate public address, optional validated
website/social links, and timestamps. Do not store verification status,
registration documents, subscription state, analytics, staff memberships,
premium entitlements, financing, or payment fields in the V1 contract. A
dealer inventory page queries the owner's published vehicle listings through
the normal listing relationship.

### `conversations` and `inquiries`

Add a conversation parent containing listing, buyer, seller, lifecycle state,
last-message timestamp, and per-participant last-seen position for inbox unread
counts without exposing read receipts. Enforce one active buyer/listing
conversation unless a documented reopening rule requires otherwise.

Treat `inquiries` as message rows during migration: conversation, sender,
plain-text body, and created timestamp. Remove attachments, delivery/read
receipts, reactions, media, voice, presence, and group semantics. Participants
alone may read; only the authenticated sender may insert; neither participant
may rewrite message history. Rate, length, retention, block, and report rules
must be trusted-boundary controls.

### `app_alerts`

Restrict the active event vocabulary to listing approved, listing rejected,
listing expires soon, report resolved, and account status changed (suspended
or restored). Keep title, explanation, safe route, timestamp, and owner read
state. Creation is server/admin/job-only; users may read and mark only their
own records. No marketing, price-drop, social, message-duplicate, or arbitrary
client-created alerts.

### `reports`

Define one report target per row using constrained nullable FKs or separate
target tables; never a free-form ID. V1 targets are listing, service, or user.
Include reason, safe notes, state, resolution, resolving admin, timestamps, and
audit correlation. Enforce duplicate/rate limits without suppressing distinct
urgent reports.

### `audit_logs`

Include actor, action, resource, result, reason, correlation, safe before/after,
and timestamp. Make it append-only to application roles and redact secrets and
unnecessary personal data. Use a transactional write or durable outbox.

### `media_assets` (new recommendation)

Minimum fields:

- ID, bucket/key, owner ID, listing or service relationship;
- asset purpose, order, lifecycle state;
- original display name;
- trusted MIME, bytes, width/height, checksum;
- scan/validation state and timestamps;
- public derivative key; and
- created/replaced/deleted timestamps.

V1 supports only public listing/service and business-logo images after
validation. It does not support documents, message attachments, verification evidence, support attachments,
avatars, or bulk imports.

## Relationship simplifications

- Replace all email relationships with UUID foreign keys.
- Seller/provider is resource ownership; do not duplicate name/email as the
  authorization identity. A display snapshot may be retained only for
  historical presentation with clear update rules.
- Use `locations.id` for approximate areas; remove parallel neighbourhood
  content models and exact residential coordinates from V1.
- Services have no booking, payment, practitioner, or dispute relationships in
  V1.
- A business profile belongs to one user; dealer inventory is derived from
  that owner's published vehicle listings rather than a duplicate inventory
  table.
- A conversation belongs to one listing, one buyer, and the listing seller;
  message participants cannot be supplied freely by the client.
- Reports resolve to one typed target and one resolving admin.
- Media authorization joins the parent resource; path guessing never grants
  access.

## RLS scope reduction

V1 needs policies only for active tables/views plus explicit denial/revocation
for deferred tables if they remain deployed. The complete V1 matrix covers:

- public published reads;
- owner draft/management reads and writes;
- unrelated-user denial;
- suspended/banned denial;
- admin protected operations;
- managed-column denial;
- media owner/public lifecycle;
- favourites owner access;
- business profile public/owner/admin access;
- conversation/message participant isolation and immutable message history;
- notification owner read/update plus trusted-only creation;
- category public read plus admin-only controlled mutation;
- reports reporter/admin visibility; and
- audit append/read restrictions.

Do not leave deferred tables broadly accessible merely because their UI is
hidden. If they remain in an exposed schema, RLS and grants must fail closed.

## Index and query plan

Design indexes from approved V1 repository queries, then verify with
production-like cardinality. Expected query families include:

- published listings by kind/category/location/price/recency;
- full-text/trigram search over approved fields;
- seller-owned inventory by status/date;
- services by category/location/status;
- business/dealer public profile and owner inventory;
- conversation inbox by participant/last-message and messages by conversation;
- unread operational notifications by owner/date;
- active categories by parent/kind/order;
- favourites by user and listing;
- open reports by state/severity/age/target; and
- audit by actor/action/resource/date.

An index list is not performance evidence. Preserve `EXPLAIN (ANALYZE,
BUFFERS)` results for representative data and verify stable pagination.

## Migration strategy after approval

1. Obtain production Base44 and any Supabase data/schema exports.
2. Reconcile row counts, field use, hidden dependencies, and retention duties.
3. Decide whether the target database is unapplied, development-only, or has
   real users/data.
4. If safely unapplied, review whether a clean V1 baseline can replace the
   broad proposed schema while preserving migration history separately.
5. If applied or uncertain, use additive forward migrations to isolate active
   tables, revoke deferred access, migrate active data, and archive only after
   reconciliation and rollback evidence.
6. Add V1-specific RLS/action tests, fixtures, data mapping, backup, rollback,
   and restore rehearsal.
7. Never drop a table or column because this plan says “Remove” without the
   Document 1–4 evidence and approval gates.

## Acceptance criteria

- Every current table is classified and every deployed table has an explicit
  exposure/retention decision.
- The active V1 schema and service contracts cover every approved V1 screen and
  no excluded feature.
- Clean and production-like upgrade applies pass.
- Full role/action/column/view/storage tests pass.
- Base44-to-Supabase counts, IDs, relationships, media, and rejected/orphan
  records reconcile.
- Rollback/forward-fix and restore are executable and rehearsed.
- Backup, retention, deletion, monitoring, and query plans are approved.
