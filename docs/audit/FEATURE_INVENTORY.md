# Current Feature Inventory

Reviewed: 2026-07-31  
Branch: `feature/listing-intelligence-foundation`  
Staging SQL boundary: `0101`

This inventory describes the active route, provider and database contracts.
Environment flags remain separate from database readiness controls.

## Customer-facing marketplace

| Feature | Routes | State |
|---|---|---|
| Authentication | `/login`, `/register`, `/forgot-password`, `/reset-password` | Email/password implemented; Google OAuth provider-gated; Apple disabled |
| Discover | `/` | Implemented |
| Search | `/search` | Cursor pagination, suggestions, filters, list and map views |
| Listing detail | `/property/:id`, `/car/:id`, `/machinery/:id` | Implemented with shared media and optional Peek |
| Services | `/services`, `/service/:id` | Implemented; legal-commerce flows excluded |
| Create listing | `/post` | Protected multi-step publishing flow |
| Create service | `/create-service` | Protected service publishing flow |
| Owner inventory | `/my-listings`, `/my-services` | Protected and cursor-paginated |
| Saved listings | `/saved` | Protected |
| Profile and settings | `/profile`, `/settings` | Protected |
| Seller profile | `/seller/:sellerId` | Public UUID route; no account-email URL |
| Business/dealer profile | `/business/:id`, `/dealer/:id`, `/business-profiles` | Feature-gated and implemented |
| Chats | `/chats`, `/chats/:conversationId` | Feature-gated and implemented |
| Notifications | `/notifications` | Feature-gated and implemented |
| Peek | `/peek`; `/tours` redirects to `/peek` | Full upload, processing, playback and moderation lifecycle |
| Help and support | `/help`, `/help/contact` | Implemented |
| Legal | `/legal/:document` | Privacy, data-protection and terms content |

Compatibility redirects remain for `/create`, `/messages`, `/messages/:id`,
`/faqs` and `/support`.

## Maps and location

FindIt uses:

- MapLibre GL JS `5.12.0`
- MapTiler Cloud vector styles and reverse geocoding
- Supabase/PostGIS marketplace spatial data
- `VITE_MAPTILER_PUBLIC_KEY` restricted to approved origins
- `VITE_MAPTILER_STYLE_ID` for the approved map style

Device location is opt-in. Coordinates are sent to MapTiler only to resolve an
active supported city. The resolver and browser-storage whitelist retain only
country, province, city, city name and source. Manual selection remains a
required fallback.

The release remains Zimbabwe-first. International publishing, currency
conversion, phone verification and service-radius values remain false until
complete customer and provider contracts exist.

## Recommendation services

Seven independent staging services are enabled:

1. nearby service
2. personalized recommendations
3. recently listed
4. related products
5. related services
6. seller recommendations
7. similar listings

Canonical listing pages do not depend on recommendation availability.
Personalization remains default-off and requires explicit consent.

## Admin and privileged RPC boundary

Admin routes remain:

- `/admin`
- `/admin/listings`
- `/admin/users`
- `/admin/reports`
- `/admin/categories`
- `/admin/audit-log`

Every admin/owner/messaging/media/notification/submission/reporting RPC still
uses the same public name and signature. Migration `0101` moved all 57 remaining
privileged implementations into `private` and created public SQL
`SECURITY INVOKER` wrappers.

Current staging counts:

- anonymous-callable public privileged functions: zero
- authenticated-callable public privileged functions: zero
- public invoker wrappers created by `0101`: 57
- private privileged implementation pairs: 57
- authenticated grants preserved: 57
- service-role grants preserved: 53
- anonymous and `PUBLIC` wrapper grants: zero

Hosted semantics verified owner isolation/transitions, notifications, messaging,
participant isolation, reporting, admin reads/actions, audit writing,
fail-closed submission/media/Peek paths and suspended-account denial. The exact
rollback restored the original 57-function fingerprint in a rolled-back test.

## Backend capabilities

| Capability | Implementation |
|---|---|
| Listing and service images | Private storage with validated upload/attachment functions |
| Peek media | Private source storage, FFmpeg processing, signed playback and thumbnails |
| Messaging | `conversations` headers and plain-text message rows in `inquiries` |
| Notification fanout | Lease-based jobs and bounded worker |
| Cache invalidation | `tour_cache_invalidations` and trusted worker |
| Recommendation projection | Asynchronous queue with listing-detail safeguard |
| Operational metrics | `operational_metric_buckets` and `operational_alerts` |
| Audit trail | Admin and configuration audit records |

The previously due seven cache invalidations were recovered; the due queue is
zero. Scheduler recovery is still required so future work runs automatically.

## Deliberately fail-closed

- payments, subscriptions and escrow
- premium listings
- AI moderation, ban-evasion detection, ticket triage and support chat
- listing expiry and freshness reminders
- scheduled reminders and marketing emails
- currency conversion
- phone verification
- service radius
- international publishing
- Apple OAuth
- legal booking and payment flows

Their preserved schema scaffolding does not constitute an active browser
contract.

## Verification status

- Staging migrations are canonical from `0001` through `0101`.
- Sequence mismatches and generated-version residue: zero.
- Redundant browser grants on `recommendation_events_default`: removed.
- Repository hygiene rejects unfinished implementation markers.
- Leaflet is removed from the active manifest and source graph.
- Last complete conventional three-workflow certification: migration `0091`.
- Hosted evidence covers migrations `0092` through `0101`.

Clean-database CI through `0101` remains required after GitHub Actions runner
execution is restored.
