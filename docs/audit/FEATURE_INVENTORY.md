# Current Feature Inventory

Reviewed: 2026-07-31  
Branch: `feature/listing-intelligence-foundation`  
Staging SQL boundary: `0100`

This inventory describes the active route and service contracts. Environment
flags remain separate from database readiness controls; a capability is release
ready only when both layers and their provider configuration agree.

## Customer-facing marketplace

| Feature | Routes | State |
|---|---|---|
| Authentication | `/login`, `/register`, `/forgot-password`, `/reset-password` | Email/password implemented; Google OAuth release-gated; Apple disabled |
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

FindIt now uses:

- MapLibre GL JS `5.12.0` as the map renderer
- MapTiler Cloud for vector styles and reverse geocoding
- Supabase/PostGIS for marketplace spatial data
- a protected browser key supplied through `VITE_MAPTILER_PUBLIC_KEY`
- `VITE_MAPTILER_STYLE_ID` for the approved map style

Device location is opt-in and resolves to an active supported city. The current
location control does not persist exact device coordinates. Manual country,
province and city selection remains mandatory as a fallback.

The current release is Zimbabwe-first. `VITE_FEATURE_INTERNATIONAL_LISTING`
remains false until another country has a complete configuration, publishing
flow, validation matrix and operational approval.

## Recommendation services

Seven independent staging services are enabled:

1. nearby service
2. personalized recommendations
3. recently listed
4. related products
5. related services
6. seller recommendations
7. similar listings

Canonical listing pages do not depend on recommendation availability. Service
calls have bounded timeouts, cache behavior, request budgets, circuit state and
fail-open presentation. Personalization remains default-off and requires
explicit consent.

## Admin surface

All admin routes require both the UI role guard and database authorization.
Current routes are:

- `/admin`
- `/admin/listings`
- `/admin/users`
- `/admin/reports`
- `/admin/categories`
- `/admin/audit-log`

The UI guard is not the security boundary; every admin RPC verifies admin or
founder authorization server-side.

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

The previously due seven cache invalidations were recovered on staging; the due
queue is currently zero. Scheduler recovery is still required so future work is
processed automatically.

## Deliberately fail-closed

These capabilities are not unfinished launch defects and must remain disabled
for the current V1:

- payments, subscriptions and escrow
- premium listings
- AI moderation, ban-evasion detection, ticket triage and support chat
- listing expiry and freshness reminders
- scheduled reminders and marketing emails
- currency conversion
- phone verification
- service-radius values
- international publishing
- Apple OAuth
- legal booking and payment flows

Their preserved tables or scaffolding do not constitute an active browser
contract.

## Security and verification status

- Staging migrations are canonical from `0001` through `0100`.
- Anonymous-callable public definer functions: zero.
- Authenticated-callable public definer functions remaining: 57.
- Redundant browser grants on `recommendation_events_default`: removed.
- Repository hygiene now rejects TODO, FIXME, HACK, XXX and incomplete-stub
  markers in production source.
- Leaflet and `@types/leaflet` are removed from the active package manifest and
  no active source imports Leaflet.

The last complete conventional three-workflow certification is at migration
`0091`. Hosted staging evidence covers the later migrations, but clean-database
CI through `0100` remains required after GitHub Actions runner recovery.
