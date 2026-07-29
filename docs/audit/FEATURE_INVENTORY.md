# Feature Inventory

Derived from the route table, service layer and migrations. "Flag" is the code
default in `src/lib/featureFlags.js`; several differ from `.env.example` (F-11).

## User-facing features

| Feature | Routes | Services / repositories | Flag | State |
|---|---|---|---|---|
| Authentication | `/login`, `/register`, `/forgot-password`, `/reset-password` | `authService` | always on | Complete — email/password, Google OAuth configured, Apple scaffolded but disabled |
| Home / Discover | `/` | `publicListingsService` | always on | Complete |
| Search | `/search` | `publicListingsService`, `searchContracts` | always on | Complete — keyset pagination, debounced input, suggestions, combobox a11y |
| Listing detail | `/property/:id`, `/car/:id`, `/machinery/:id` | `publicListingsService` | always on | Complete — three `kind` variants share one media viewer |
| Services marketplace | `/services`, `/service/:id` | `servicesService`, `serviceContracts` | always on | Complete — `legal` category deliberately excluded from browse/create |
| Create listing | `/post` | `listingCreationService`, `listingSubmissionContracts` | protected | Complete — multi-step wizard, 9 components |
| Create service | `/create-service` | `servicesService` | protected | Complete |
| My listings | `/my-listings` | `ownerListingsService` | protected | Complete — keyset paginated |
| My services | `/my-services` | `servicesService` | protected | Complete |
| Favourites | `/saved` | `favouritesService` | protected | Complete |
| Profile | `/profile` | `profileService`, `profileContracts` | protected | Complete |
| Settings | `/settings` | `profileService` | protected | Complete |
| Seller profile | `/seller/:email` | `sellerProfilesService` | always on | Complete — public |
| Business profiles | `/business-profiles`, `/business/:id`, `/dealer/:id` | `businessProfilesService` | `businessProfiles` **on** | Complete |
| Chat / messaging | `/chats`, `/chats/:conversationId` | `messagingService`, `messagingContracts` | `messaging` **off** | Complete but flag-off by default |
| Notifications | `/notifications` | `notificationsService` | `essentialNotifications` **off** | Complete but flag-off by default |
| Peek | `/peek` (`/tours` compatibility redirect) | `listingToursService` | enabled in accepted release; rollback-gated | Complete; see TOURS_AUDIT.md |
| Reporting | dialog on listings | `reportsService` | always on | Complete — 6 reason codes |
| Help / FAQs | `/help` | static | always on | Complete |
| Contact support | `/help/contact` | `contactSupportService` | always on | Complete |
| Legal | `/legal/:document` | `legalContent.js` | always on | Complete — privacy, data-protection, terms |

## Admin features

All six live behind `ProtectedRoute requiredRole="admin"` **and** a
database-level `is_admin()` check inside every admin RPC. The UI guard is
presentation only; removing it would not grant access.

| Route | Backing RPCs |
|---|---|
| `/admin` | `admin_dashboard_stats`, `admin_notification_fanout_health` |
| `/admin/listings` | `admin_marketplace_rows_page`, `admin_moderate_marketplace_item` |
| `/admin/users` | `admin_user_rows`, ban/unban operations |
| `/admin/reports` | `admin_report_rows`, `admin_tour_queue`, `admin_approve_tour` |
| `/admin/categories` | `admin_category_rows`, `admin_add_category` |
| `/admin/audit-log` | `admin_audit_rows_page` |

Admin identity is bound by `0030_v1_founder_admin_lock.sql` to a **SHA-256 of
the founder's normalised email**, not a literal address, and
`is_founder_identity()` is revoked from `public`, `anon` and `authenticated`.
The migration also reconciles any pre-existing elevated rows down to `user`
before enforcing the boundary.

## Backend capability inventory

| Capability | Implementation |
|---|---|
| Listing media | `listing-images` bucket + `listing-image-upload` Edge Function; trusted-path validation in `_shared/trusted-image.ts` |
| Marketplace/profile media | `marketplace-images` bucket + `marketplace-image-upload` |
| Tour media | `tour-sources` → processing → `tour-playback` + `tour-thumbnails` |
| Listing expiry | `listing-expiry-worker`, scheduled |
| Media cleanup | `media-lifecycle-cleanup`, `tour-lifecycle-cleanup`, `tour_asset_cleanup_queue` |
| Notification fanout | `essential-notification-fanout` + `essential_notification_fanout_jobs` with lease-based claiming |
| Observability | `tour-observability-monitor`, `operational_metric_buckets`, `operational_alerts` |
| Cache invalidation | `tour-cache-invalidation` + `tour_cache_invalidations` |
| Audit trail | `record_admin_action()` writes `audit_logs` with before/after JSONB and a correlation id |

## Domain model notes

- Listings are one table with a `kind` discriminator (`property`, `car`,
  `machinery`) rather than three tables — routes differ, storage does not.
- **Chat messages live in `inquiries`, not a `messages` table.** `conversations`
  (0018) is the thread header; `inquiries` (0006) holds the message rows and is
  linked by `inquiries_conversation_fk`. Migration 0018 also adds V1 constraints
  `inquiries_v1_no_attachments` and `inquiries_v1_no_receipts`, so the dormant
  `attachments` JSONB column is constraint-locked rather than merely unused.
  This naming mismatch is the single most confusing part of the schema for a
  newcomer and is worth a comment rather than a rename.
- Services and listings are separate domains that share the media, tour,
  reporting and moderation infrastructure.

## Deliberately dormant

Present in schema, disabled in product — retained so re-enabling needs no
migration:

- Payments, subscriptions, escrow, premium listings —
  `0029_v1_deferred_commerce_isolation.sql`.
- AI moderation, ban-evasion detection, ticket triage, support chat.
- Scheduled reminders, marketing emails.
- Legal services category — `0028_v1_legal_domain_isolation.sql`.

## Tests

45 contract suites in `tests/` (239 tests, all passing after Phase 9) plus 12
pgTAP suites in `supabase/tests/`.

The contract suites are **static-analysis assertions over source text**, not
runtime component tests — they assert that files contain particular calls,
props and guards. That is unusually effective at catching architectural drift
and is why boundary violations are rare here. It does not, however, exercise
rendering, user interaction or real database behaviour. Runtime coverage
therefore depends entirely on the pgTAP suites and the `test:*-local` smoke
scripts, all of which are currently blocked on Docker/Supabase — see
EXTERNAL_BLOCKERS.md.
