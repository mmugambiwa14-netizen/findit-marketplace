# Database Schema

Proposed relational replacement for Base44's 40 hosted entities. The current
repository contains `supabase/migrations/0001`–`0030`, in order. After bounded corrections,
the full chain applies successfully to a fresh isolated local Supabase database.

> **2026-07-26 verification status:** the migration `0004` trigger now uses
> `TG_ARGV`, listing views are security-invoker, all 49 public tables enable
> RLS, and migration `0013` adds active-account checks, protected managed
> fields, owner/participant checks, constrained new writes, admin audit RPC,
> public business projection, and fail-closed deferred tables. A clean local
> reset through migration `0029`, database lint, and 258 pgTAP assertions pass.
> The current schema has 4 views, 64 public RLS policies and 6 Storage policies.
> Five future legal tables have no browser grants or policies, and shared
> services exclude the legal category at every browser policy boundary.
> The checked-in local
> backup/restore rehearsal restored the earlier 13-migration checkpoint's 41 public and 41 RLS tables into an exact
> disposable database and removed it; the local relationship reconciliation
> query reports zero failures. Do not treat the chain as production-ready until
> a production-like upgrade apply, imported-data reconciliation, provider
> recovery, RPO/RTO, and traffic-switch evidence have passed in isolation.

Intended Supabase CLI usage after those blockers are resolved:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

or, for local development against the Supabase CLI's local stack:

```bash
supabase start
supabase db reset   # applies all migrations in supabase/migrations/ in order
```

## 1. Listings: Car / Property / Machinery → `listings` + detail tables

The original `Car`, `Property`, and `Machinery` entities shared ~24 of ~30
fields (seller/contact info, pricing, photos, location, status, verification,
views, timestamps) and differed only in a handful of category-specific
fields. That's a textbook normalization case, and the audit called it out as
one of the few places where improving the schema was worth the small extra
join cost.

```
listings                 (shared fields, one row per listing regardless of kind)
├── car_details          (listing_id FK, brand, model, year, mileage, fuel_type, transmission, condition)
├── property_details     (listing_id FK, property_type, bedrooms, bathrooms, size_sqm)
└── machinery_details    (listing_id FK, machinery_type, brand, model, condition, year, usage_hours)
```

A `kind` column on `listings` plus a trigger (`enforce_listing_kind`) on each
detail table guarantees a `car_details` row can only attach to a listing
whose `kind = 'car'`, etc. Three convenience views (`public.cars`,
`public.properties`, `public.machinery`) join `listings` to the matching
detail table so the service layer (Phase 3) can query "give me all cars" as
a single `select * from cars` rather than hand-writing the join every time —
this is what lets the frontend keep seeing the same `Car`/`Property`/
`Machinery` shape it always has, even though storage is now normalized.

## 2. Identity: email references → UUID foreign keys

Every Base44 entity used a plain string like `seller_email` or `user_email`
as its way of pointing at a user. That's fragile — it breaks if a user
changes their email, allows orphaned references with no integrity check, and
can't be indexed as efficiently as a UUID. Every such field is now a
`uuid references public.users(id)` column instead.

## 3. Enums enforced by Postgres, not just at write time

Fields like `status`, `escrow_status`, `fuel_type`, `payment_method` were
Base44 schema-level string enums (validated by Base44 on write, not by the
database). They're now native Postgres `enum` types (defined in
`0001_extensions_and_enums.sql`), so an invalid value is rejected by the
database itself regardless of which code path tries to write it.

## 4. Entity → table map

| Base44 entity | Table(s) | Migration file |
|---|---|---|
| User | `users` | 0002 |
| AdminTeam | `admin_teams` | 0002 |
| UserPresence | `user_presence` | 0002 |
| AuditLog | `audit_logs` | 0002 |
| Location | `locations` | 0003 |
| Neighbourhood | `neighbourhoods` | 0003 |
| Car, Property, Machinery | `listings`, `car_details`, `property_details`, `machinery_details`, `listing_upload_intents`, `listing_media` | 0004, 0021 |
| Service | `services`, `service_media`, `marketplace_image_upload_intents` | 0005, 0022 |
| ServiceBooking | `service_bookings` | 0005 |
| ServiceDispute | `service_disputes` | 0005 |
| LegalSpecialization | `legal_specializations` | 0005 |
| LegalPractitioner | `legal_practitioners` | 0005 |
| LegalBooking | `legal_bookings` | 0005 |
| PractitionerReview | `practitioner_reviews` | 0005 |
| Follow | `follows` | 0006 |
| SavedListing | `saved_listings` | 0006 |
| Review | `reviews` | 0006 |
| SellerRating | `seller_ratings` | 0006 |
| Inquiry | `inquiries` | 0006 |
| AppAlert | `app_alerts` | 0006 |
| BusinessProfile | `business_profiles` | 0006 |
| VerificationRequest | `verification_requests` | 0007 |
| Report | `reports` | 0007 |
| Payment | `payments` | 0008 (dormant) |
| EscrowTransaction | `escrow_transactions` | 0008 (dormant) |
| Subscription | `subscriptions` | 0008 (dormant) |
| PractitionerPayout | `practitioner_payouts` | 0008 (dormant) |
| SupportAgent | `support_agents` | 0009 |
| SupportTicket | `support_tickets` | 0009 |
| SupportMessage | `support_messages` | 0009 |
| TicketAttachment | `ticket_attachments` | 0009 |
| TicketActivityLog | `ticket_activity_log` | 0009 |
| TicketTemplate | `ticket_templates` | 0009 |
| SupportSetting | `support_settings` | 0009 |
| V1 founder inbox (not a Base44 entity replacement) | `support_requests` | 0025 |
| Announcement | `announcements` | 0010 |
| FAQ | `faqs` | 0010 |
| EmailTemplate | `email_templates` | 0010 |
| Terms | `terms` | 0010 |

"Dormant" = table exists for reconciliation and future design, RLS is on, and
migration `0029` removes every `anon`/`authenticated` policy and table grant.
Only the service role may access it until a future reviewed migration restores
a narrower browser contract with a real gateway.

## 5. Row Level Security

Migration `0011_rls_policies.sql` enables RLS on all 41 public tables.
Migration `0013_v1_rls_hardening.sql` adds V1 relationship and protected-field
enforcement, active-account gates, public business projection, and explicit
fail-closed policies for deferred domains. Migration `0014` adds the bounded
public seller RPC and `0015` adds service-owner deletion. The listing views use
`security_invoker`; the current 258-assertion pgTAP suite covers anon, owner,
buyer, stranger, suspended, admin, seller privacy, service deletion, messaging
isolation and essential-notification ownership cases.

Migration `0016_v1_admin_operations.sql` adds the founder-managed `categories`
table and the active V1 admin operations. At that migration checkpoint the schema had 42 public
tables, 4 views and 70 RLS policies. Category mutations preserve immutable IDs,
slugs, parents and marketplace kinds; referenced categories are deactivated,
not deleted. Privileged mutations require a reason and write result/correlation
evidence to `audit_logs` in the same transaction.

Migration `0017_v1_business_profiles.sql` activates the shared lightweight
business/dealer contract without adding a dealer role. It enforces one profile
per owner, derives `profile_type`, excludes legal firms from new V1 writes,
requires a contact path, validates HTTP(S) website/social links and limits the
public view to active owners. Verification/registration fields remain retained
privately for migration evidence but are outside the active V1 read/write
contract. Dealer inventory is derived from the owner's published vehicle
listings rather than duplicated in another table.

Migration `0018_v1_messaging.sql` adds `conversations` and
`conversation_reports`, taking the schema to 44 public tables, 4 views and 71
RLS policies. `inquiries` is retained as the immutable plain-text message row
for migration compatibility, now linked to a first-class conversation. Direct
client writes are denied; trusted RPCs enforce listing/seller relationships,
one buyer/listing conversation, participant isolation, message length/control
validation, rate limits, blocks, unread positions, report handling and active
accounts. Attachments and delivery/read receipt fields are retained only as
legacy columns and constrained empty/null for new messages. Conversation
retention metadata defaults to 24 months; production expiry job/legal-policy
approval remains required before launch.

Migration `0019_v1_essential_notifications.sql` retains legacy `app_alerts`
rows but exposes only five V1 operational event classes through protected RPCs:
listing approved, listing rejected, listing expires soon, report resolved and
account status. Authenticated clients cannot insert or directly update alerts;
owner-only read-state RPCs replace the earlier broad update policy, taking the
schema to 70 RLS policies. Internal links are allowlisted, source keys prevent
duplicate events, and listing expiry timestamps are server-managed. The
service-role expiry worker is implemented and locally verified but still needs
an owned, monitored daily schedule in the deployment environment.

Migrations `0020_v1_listing_status_values.sql` and
`0021_v1_listing_creation_and_media.sql` add the approved product lifecycle
(`pending_review`, `rejected`, `paused`, `unavailable`) and take the schema to
46 public tables, 4 views and 71 public RLS policies. Browser roles cannot
insert product/detail rows directly. `create_v1_listing_submission` validates
the bounded V1 contract and atomically creates the product, matching detail
row and ordered media rows using a caller-owned idempotency key. An uploaded
image authorization is single-use. `owner_transition_listing` controls
submit/pause/resume/unavailable changes, while state-aware admin moderation is
the only approval/rejection boundary. Editing public product content forces a
new review.

The same migration creates the private `listing-images` bucket,
`listing_upload_intents`, `listing_media`, and 3 Storage policies. Server-only
authorization/completion RPCs confirm owner/path/type/size/dimensions/hash
metadata before attachment. Pending and paused object reads are limited to the
owner/admin; approved listing media can be signed for public delivery. Storage
and both upload Edge Functions plus the cleanup worker are locally verified,
but production object migration, hosted cleanup scheduling, retention policy
and scanner/re-encoding/derivatives remain open.

Migration `0022_v1_marketplace_profile_media.sql` takes the schema to 48
public tables, 4 views, 72 public RLS policies and 6 Storage policies. It adds
the private `marketplace-images` bucket, purpose-bound upload intents, ordered
`service_media`, and the protected `business_profiles.avatar_storage_path`
field. Server-only authorization/completion RPCs bind each inspected upload to
its owner, purpose and generated path. Authenticated attachment/detachment RPCs
limit a service to six images and a business/dealer profile to one logo while
keeping the compatibility `services.photos` projection synchronized. Public
reads are signed only while the parent service/profile and owner are active.
SQL plus real HTTP smokes verify hidden-before-attach behavior, signed exact-
byte delivery, direct-bypass denial, unpublication hiding and cleanup.

Migrations `0023_v1_service_media_edit.sql` and
`0024_v1_listing_media_edit.sql` add atomic owner edit boundaries. Each locks
the parent and every new intent, verifies the complete keep/new set before
changing metadata, fills only free bounded display slots, rebuilds the
compatibility photo array and returns detached paths for Storage cleanup.
Product listings must retain 1–20 images; services allow 0–6. Direct owner
mutation of product photos is denied in every status, and changing a live
product's media returns it to `pending_review`.

Migration `0025_v1_contact_support.sql` adds the minimal V1
`support_requests` founder inbox without activating the legacy support-ticket
suite. Guests and signed-in active users submit only category, contact email,
message and an optional related reference through a validation and rate-limit
RPC. Browser roles have no direct table access and no request lookup. Admins
use narrow paginated read and resolution RPCs; a resolution requires a reason
and creates a durable audit event without duplicating contact email/message in
the audit log. This takes the schema to 49 public tables. The table has RLS and
no browser policies by design. At that checkpoint the total remained 72 public
policies.

Migration `0026_v1_image_lifecycle_cleanup.sql` extends both upload-intent
ledgers without adding tables or policies. A service-only claim RPC selects
only expired, unattached intents, moves them to `cleanup_pending` before object
deletion and recovers claims abandoned for 15 minutes. Finalization records a
minimal `cleaned` state or restores the prior expired state with a 15-minute
retry time and safe error code. Attachment RPCs accept only `uploaded`, so a
claimed object cannot race into a listing/service/profile relationship.

Migration `0027_v1_function_execute_hardening.sql` corrects Supabase default
function privileges. It removes explicit `anon`/`authenticated` execution from
trigger helpers, notification construction, operational workers and other
non-public functions, then restates the exact public/authenticated/service
allowlists. The regression suite queries the catalog so a future default grant
cannot silently broaden the browser RPC surface.

Migration `0028_v1_legal_domain_isolation.sql` removes the remaining five
admin-only browser policies and all `anon`/`authenticated` grants from the
future legal profile, specialization, booking, review and payout tables.
Historical rows remain available to the service role for reconciliation.
Every browser policy on the shared `services` table also requires
`category <> 'legal'`, preventing direct-API reads or mutations from bypassing
the approved V1 legal-feature pause. At that checkpoint the total was 67 public
policies.

Migration `0029_v1_deferred_commerce_isolation.sql` completes the V1 Phase 5
safe-deferral boundary. It enables RLS defensively on `payments`,
`escrow_transactions`, `subscriptions` and `practitioner_payouts`, removes
every browser policy, revokes every table privilege from `anon` and
`authenticated`, and preserves service-role reconciliation access. The current
total is 64 public policies. Five focused pgTAP assertions verify policy/grant
absence, service access and browser permission denial.

Migration `0030_v1_founder_admin_lock.sql` reduces administration to one
founder identity without committing the founder email address. It compares a
normalized-email SHA-256 digest, promotes that identity, demotes every other
administrator, preserves the existing admin RPC signature for compatibility,
and blocks application sessions from granting administrator access. The
`is_admin()` and `is_super_admin()` authorization boundaries now require the
active founder identity, `role = 'admin'`, and `super_admin = true`. SQL-owner
access remains available for controlled recovery and migration tests. The
matching rollback script restores the previous multi-admin role behavior.

The complete future-domain role/action/column matrix remains an acceptance
requirement. The intended general shape is:

- **Public reference data** (locations, FAQs, terms, active listings) —
  readable by anyone, writable only by `is_admin()`.
- **User-owned data** (listings, services, saved listings, follows) —
  owner can read/write their own rows; admins can read/manage all.
- **Two-party data** (inquiries, bookings, disputes) — both participants can
  read; only the initiating party can create.
- **Admin-only** (audit logs, ticket activity log, payouts) — `is_admin()`
  gate, full stop.

`is_admin()` and `is_super_admin()` are `SECURITY DEFINER` SQL functions
checking the current `auth.uid()` against the active founder-only identity and
role state. This replaces Base44's server-side role check in `ProtectedRoute`/
`base44.auth.me()`, except now it is enforced by Postgres itself.

## 6. Known open items

`service_bookings.practitioner_id` has no foreign key yet. In the original
Base44 schema this field was a bare string reused for both
`LegalPractitioner` bookings and general service-provider bookings — which
table it points to depends on the booking type, and that ambiguity needs a
product decision (or a `practitioner_kind` discriminator column) before it
can be safely constrained. See `MIGRATION.md` for tracking.

Additional verified open items:

- Preserve the passing clean-reset/258-assertion pgTAP coverage and run it
  against a production-like upgraded/imported target.
- Complete the role/action/column matrix for future/deferred domains before
  exposing them.
- Apply the approved product decision to the polymorphic
  `service_bookings.practitioner_id` relationship before enabling that domain.
- Map and reconcile exported fields missing from target tables, including
  `listing_type` on AppAlert/Inquiry/SavedListing/SellerRating,
  `Follow.seller_name`, and `AuditLog.admin_email`.
- Migration `0012_capture_phone_on_signup.sql` replaces the auth-user trigger
  to copy phone metadata; it applies cleanly in the local chain.
- For every material repository query, record representative data volume,
  expected indexes, `EXPLAIN (ANALYZE, BUFFERS)` evidence from an isolated
  production-like dataset, and the accepted plan. Index counts alone are not
  query-plan verification.
- Every schema batch needs a versioned forward migration, preconditions,
  reconciliation query, and restore rehearsal. The local forward-recovery
  approach and executable rehearsal are in `supabase/rollback/README.md` and
  `scripts/phase1-*.ps1`; production provider/PITR recovery remains external
  acceptance work.
