# FindIt Feature Inventory

Date: 2026-07-25  
Rule: no item may be removed until production use and replacement behavior are
verified.

> **Final-state addendum — 2026-07-26:** this table inventories the original
> archive and is historical evidence, not the final route or file manifest.
> `FEATURE_DECISION_MATRIX.md` is authoritative for MVP/Deferred/Removed/Future
> decisions and `src/App.jsx` defines the shipped V1 surface. Approved V1
> listings, services, favourites, reports, lightweight business/dealer
> profiles, plain-text messaging, essential notifications, Contact Support and
> private image paths now use Supabase and pass hosted domain acceptance.
> Currency is USD-only. Verification, legal, commerce, premium, AI, rich
> support, reviews/ratings, bulk tools and other non-MVP source were removed;
> their future product intent remains documented rather than shipped.

Legend:

- Importance: Critical, High, Medium, Low.
- Restoration difficulty: Low, Medium, High, Very High.
- State: Active, Hidden, Unrouted, Feature Flagged, Migration Infrastructure.
- Permissions: Guest, User, Owner, Participant, Provider, Practitioner,
  Support, Admin, Super Admin.

## Core Infrastructure

| Feature | Description and location | Dependencies | Permissions / users | Importance | Difficulty | State |
|---|---|---|---|---|---|---|
| Application shell | Provider composition, global loading/error/blocked gates, layouts; `src/main.jsx`, `src/App.jsx` | React, Router, Query, Auth, currency | All | Critical | High | Active |
| Routing/not-found | Public, protected, admin, hidden and wildcard routes; `App.jsx`, `PageNotFound.jsx` | React Router, auth; Base44 current-user read in not-found | All | Critical | High | Active |
| Public/user navigation | Header, bottom navigation, responsive layout, unread badges | Router, auth, alerts, support | Guest/User | High | Medium | Active |
| Admin navigation | Six-destination admin shell and responsive sidebar | Supabase Auth/role predicates, shared navigation config | Admin | Critical | High | Active; Verified locally |
| Email/password login | Establish Supabase session; `Login.jsx`, `authService.js` | Supabase Auth | Guest/User | Critical | Very High | Active; In Progress migration |
| OAuth login | Google/Apple buttons and redirect | Supabase Auth/provider dashboards | Guest/User | High | High | Active; configuration unverified |
| Registration | Email/password/phone signup and confirmation resend; `Register.jsx` | Supabase Auth, migration 0012, email | Guest | Critical | Very High | Active; In Progress migration |
| Email verification | Link-based confirmation replacing custom Base44 OTP | Supabase email templates/redirects | New user | Critical | High | Active; live behavior unverified |
| Password recovery | Enumeration-safe request and recovery-session update | Supabase Auth/email | Guest/recovery user | Critical | Very High | Active; live behavior unverified |
| Session lifecycle | Initial session/profile load, auth subscription, logout | Supabase Auth and `public.users` | User | Critical | Very High | Active; live behavior unverified |
| Retained Base44 compatibility | Dormant/future modules still contain Base44 data/function calls, but the recursive active App graph and generated build contain zero Base44 | Retained legacy source outside V1 runtime | Engineering only | High | High | Migration Infrastructure; locally isolated, repository cleanup/production proof Blocked |
| Blocked account UI | Suspended/banned users render `AccountBlocked` | Supabase profile status and V1 RLS enforcement | Blocked user | Critical | High | Active; local server enforcement passes, lifecycle browser evidence incomplete |
| Protected/admin routes | Authentication gate and fresh database admin check | Auth context, Supabase `is_admin()`/`is_super_admin()` | User/Admin | Critical | Very High | Active; Verified locally |
| User profile/preferences | Profile, settings, avatar/bio/name/phone/currency | Base44 User and uploads; partial Supabase profile | User/Owner | High | High | Active |
| Phone verification | Phone OTP requirement and verification UI | Base44 SMS functions | User | High | High | Active; Phase 6 provider Blocked |
| Currency | Picker, profile persistence, conversion | Base44 user/profile and exchange-rate function | All/User | Medium | Medium | Active |
| Theme/responsive behavior | Dark mode/mobile hooks and layouts | Browser/CSS/UI libraries | All | Medium | Low | Active |
| Location reference | Country/city/area/neighbourhood selection/admin | Base44 Location/Neighbourhood | All/Admin | High | Medium | Active |
| File uploads/extraction | Product/service/business media plus retained documents, credentials and bulk files | Supabase trusted private uploads with common image metadata sanitization for approved V1 classes; Base44 for remaining classes | User/Admin | Critical | Very High | Approved V1 images locally verified; remaining Phase 4/6 migration Planned |
| Realtime subscriptions | Alerts, support, listing/admin counters | Base44 entity subscriptions | User/Participant/Admin | High | High | Active; Phase 3/6 migration Planned |
| Feature flags | Fail-closed payment/AI/automation switches | Vite environment | Operators | Critical | Medium | Active |
| Database/RLS | 49 tables, 4 views, triggers, 67 public and 6 Storage policies | Supabase migrations 0001-0028 | All roles | Critical | Very High | Migration Infrastructure; clean local reset/lint and 253 assertions pass, including exact function grants and future legal-domain isolation |
| Error/toast feedback | Toasters, inline form errors, access-denied/not-found states | UI components | All | High | Medium | Active |

## Core Marketplace

| Feature | Description and location | Dependencies | Permissions / users | Importance | Difficulty | State |
|---|---|---|---|---|---|---|
| Marketplace home | Hero/categories/hot listings; `Home.jsx`, home components | Car/Property/Machinery | Guest/User | Critical | High | Active |
| Unified search/filter | Cross-category results, category/location/dealer filters; `Search.jsx` | Listing entities, location | Guest/User | Critical | Very High | Active |
| Property marketplace | Cards and `/property/:id` details | Property, seller, saves, messages, reports, reviews | Guest/User | Critical | High | Active |
| Vehicle marketplace | Cards and `/car/:id` details | Car, seller, saves, messages, reports, reviews | Guest/User | Critical | High | Active |
| Machinery marketplace | Cards and `/machinery/:id` details | Machinery, seller, saves, messages, reports, reviews | Guest/User | Critical | High | Active |
| Create listing | Five-step product category, details/price, approximate location, trusted images/contact and review/submit | Supabase Auth, atomic listing RPC, private Storage/Edge upload | User/Owner | Critical | Very High | Active; locally verified, browser/hosted acceptance pending |
| Edit/delete listing | Compact edit dialog, protected forced re-review, owner delete and media cleanup | Supabase services/RPC/RLS/Storage | Owner/Admin | Critical | High | Active; local state/ownership tests pass, full edit/media browser flow incomplete |
| My listings | Owner product views with draft/rejected submit, pending, pause/resume/unavailable and delete | Supabase Auth, listing/media services | User/Owner | High | High | Active; locally verified |
| Saved listings | Save/remove and saved list | SavedListing, listing entities | User | High | Medium | Active |
| Follows | Follow/unfollow and follower/following counts | Follow, notifications | User | Medium | Medium | Active |
| Inquiries/messaging | Listing-linked plain-text buyer/seller inbox and thread with unread, block, report and abuse controls | Supabase conversations/inquiries RPCs and Auth | Buyer/Seller participant | Critical | Very High | Required V1 implementation; contracts/SQL/hosted API accepted and enabled in staging; browser matrix remains a release gate |
| Reviews/seller ratings | Listing reviews, rating prompts, seller reputation | Review, SellerRating | User/transaction participant | High | High | Active; relationship rules unverified |
| Seller profiles | Public seller profile, listings, ratings and follow state | User, listings, ratings, follows | Guest/User | High | High | Active |
| Dealer search | Dealer directory/results | User/business/listing data | Guest/User | High | Medium | Active |
| Agent directory | Agent/provider browsing | User/listing/profile data | Guest/User | Medium | Medium | Active |
| Business profiles | One-owner lightweight public business/dealer identity; dealer vehicle inventory search and trusted logo management | Supabase `business_profiles`, listings/services, private marketplace media, auth | User/Owner/Public | High | Medium | Active V1 surface; hosted profile, inventory and logo acceptance passed; deployed browser matrix remains |
| Professional services | Service browse/detail/create/edit/manage/likes | Service, user, uploads | Guest/User/Provider | High | High | Active |
| Service bookings/disputes | User/provider booking lifecycle | ServiceBooking, ServiceDispute | Participant/Provider/Admin | High | Very High | Retained; route/use coverage mixed |
| Bulk upload center | CSV, PDF and duplication flows | Listing entities, uploads, extraction | User/Provider | High | Very High | Active; PDF extraction provider-dependent |
| Verification | Identity/provider document submission and reuse/review | VerificationRequest, uploads, extraction | User/Admin | Critical | Very High | Active; storage/privacy migration Blocked |
| Help/Contact Support | Version-controlled Help/Safety plus structured public request and founder-only resolution inbox | Supabase `support_requests` RPCs and audit | Guest/User/Admin | Critical | Medium | Active; contracts/SQL/API verified, browser and production anti-abuse/monitoring pending |
| Legacy support-ticket suite | Support landing, create/list/detail ticket and chat | Base44 support entities/functions, attachments, email | User/Participant/Support/Admin | Low | Very High | Dormant/unrouted Future Version; not a V1 dependency and direct target tables are fail-closed |
| Alerts/notifications | Five essential listing/report/account event classes, unread count and owner read state | Supabase `app_alerts` RPCs; service-only expiry worker | User | High | High | Active and enabled in staging; hosted API/worker acceptance passed; deployed browser and GitHub scheduler operation remain |
| Market insights | Marketplace statistics/trends | Listing data/analytics | Guest/User | Medium | High | Active |
| Valuation tool | User-entered vehicle/property/machinery valuation | Listing data/algorithm | Guest/User | Medium | High | Active; result parity unverified |
| Legal directory/profiles | Practitioner browse/profile/specializations | Legal entities, credentials | Guest/User/Practitioner | High | Very High | Hidden |
| Legal bookings/portal | Requests, booking detail, user/practitioner portals | LegalBooking, payments, disputes | User/Practitioner/Admin | High | Very High | Hidden |

## Administrative

| Feature | Description and location | Dependencies | Permissions / users | Importance | Difficulty | State |
|---|---|---|---|---|---|---|
| Admin dashboard | V1 marketplace/user/report counts and shortcuts | Protected Supabase aggregate RPC | Admin | Critical | High | Active; Verified locally |
| Listing moderation | Server-paginated pending product approve/reject, live product pause/remove and service controls | Protected state-aware Supabase moderation RPC, notifications and audit | Admin | Critical | High | Active; Verified locally |
| User/role/ban management | User list, two roles, suspend/ban/restore | Protected Supabase user RPCs, notifications and audit | Admin/Super Admin | Critical | Very High | Active; Verified locally |
| Verification review | Review identity/provider requests | VerificationRequest, functions, private files | Admin | Critical | Very High | Active |
| Reports/moderation queue | Review/dismiss/action listing reports with required notes | Protected Supabase report RPC and audit | Admin | High | High | Active; Verified locally |
| Category vocabulary | Four protected top levels plus founder-managed subcategories | Supabase `categories`, protected RPCs and audit | Admin | High | Medium | Active; Verified locally |
| Audit log | Read reason/result/correlation evidence for privileged actions | Supabase `audit_logs` projection | Admin | Critical | High | Active; Verified locally |
| Analytics | Marketplace/user/revenue aggregates | Admin analytics functions | Admin | High | High | Active |
| Announcements | Public content CRUD/scheduling | Announcement | Admin | Medium | Medium | Active |
| FAQ management | Two retained admin FAQ screens | FAQ/support functions | Admin/Support | Medium | Medium | Active |
| Email templates | Template list/editor | EmailTemplate and send functions | Admin | High | High | Active; provider missing |
| Neighbourhood management | Reference data CRUD/status | Neighbourhood | Admin | High | Medium | Active |
| Legal practitioner/dispute admin | Practitioner verification and dispute resolution | Legal entities/functions/payment side effects | Admin | High | Very High | Active admin UI; public legal routes Hidden |
| Legacy support operations | Dashboard, queue, ticket detail, assignment, agents, settings | Support entities/functions, email | Support/Admin | Low | Very High | Dormant/unrouted Future Version; replaced in V1 by the small Support requests view inside Reports |

## Payments

| Feature | Description and location | Dependencies | Permissions / users | Importance | Difficulty | State |
|---|---|---|---|---|---|---|
| Pricing/packages | Subscription/premium presentation | Pricing data, flags | Guest/User | Medium | High | Active page; monetization flags off |
| Checkout/payment page | Legal/listing payment UI | Stripe libraries, Payment, provider | User/Participant | Critical when enabled | Very High | Feature Flagged / legal route Hidden |
| Transaction history | User financial record list | Payment/current user | User/Admin | High | High | Active route; writes disabled/unverified |
| Subscriptions | User/admin subscription records/cancellation | Subscription, gateway, webhooks | User/Admin | Critical when enabled | Very High | Feature Flagged |
| Escrow/disputes | Booking/payment hold/release/dispute | EscrowTransaction, legal/service workflows | Participants/Admin | Critical when enabled | Very High | Feature Flagged |
| Practitioner earnings/payouts | Earnings and payout administration | PractitionerPayout, Payment | Practitioner/Admin | Critical when enabled | Very High | Hidden/Feature Flagged |

## AI

| Feature | Description and location | Dependencies | Permissions / users | Importance | Difficulty | State |
|---|---|---|---|---|---|---|
| Content moderation | Automatic listing/report review | Base44 LLM/function, reports | Server/Admin | High | Very High | Feature Flagged |
| Ban-evasion detection | Automated risk detection | Base44 LLM/function, users | Server/Admin | High | Very High | Feature Flagged |
| Ticket triage | Priority/category assistance with rule fallback | Base44 LLM/function, support | Support/Admin | Medium | High | Feature Flagged; deterministic fallback retained |
| Support assistants | Oppah/support agent/Tintin chat behavior | Three Base44 agents | User/Support | Medium | Very High | Feature Flagged / routing use unverified |
| Document extraction | Verification and bulk file structured extraction | Base44 integration/LLM | User/Admin | High | Very High | Feature Flagged; privacy Blocked |

## Nice to Have

| Feature | Description and location | Dependencies | Permissions / users | Importance | Difficulty | State |
|---|---|---|---|---|---|---|
| Global map | Map browse for listings; `MapView.jsx` | Leaflet, coordinates, listing entities | Guest/User | Medium | High | Hidden |
| Marketing email | Templated campaigns | EmailTemplate, provider, consent | Admin/consenting users | Low | High | Feature Flagged |
| Scheduled reminders | Booking/listing/ticket reminders | Scheduler, email/SMS | User/Participant | Medium | High | Feature Flagged |

## Experimental

| Feature | Description and location | Dependencies | Permissions / users | Importance | Difficulty | State |
|---|---|---|---|---|---|---|
| Duplicate support screens | `Support.jsx`, `SupportCenter.jsx`, `SupportTickets.jsx`, `TicketDetail.jsx` and parallel active support flow | Base44 support entities/functions | User/Support | Unknown | Medium | Unrouted; production use unknown |
| Duplicate admin support screens | `AdminSupport.jsx`, `AdminTicketDetail.jsx` beside active dashboard/queue/detail pages | Base44 support entities/functions | Admin | Unknown | Medium | Unrouted |
| Alternate practitioner/business dashboards | Practitioner and business dashboard pages | Auth/legal/business entities | Provider/Practitioner | Unknown | High | Hidden |

## Page coverage appendix

All 80 page modules are accounted for below. A page being Hidden or Unrouted
is not permission to delete it.

### Active authentication/public/user pages

`AgentDirectory`, `Alerts`, `BulkCsvUpload`, `BulkDuplicate`, `BulkPdfImport`,
`BulkUploadCentre`, `BusinessProfiles`, `CarDetail`, `CreateListing`,
`CreateService`, `CreateTicket`, `DealerSearch`, `FAQs`, `ForgotPassword`,
`Home`, `Inquiries`, `Login`, `MachineryDetail`, `MarketInsights`,
`MyListings`, `MyServices`, `MyTickets`, `NotificationCenter`, `Pricing`,
`Profile`, `PropertyDetail`, `Register`, `ResetPassword`, `Saved`, `Search`,
`SellerProfile`, `ServiceDetail`, `Services`, `Settings`, `SupportHub`,
`TicketDetailUser`, `TransactionHistory`, `ValuationTool`, `Verification`.

### Hidden by commented routes

`BookingDetail`, `BookingRequest`, `BusinessOwnerDashboard`,
`LegalPractitionerProfile`, `LegalPractitioners`, `LegalServices`, `MapView`,
`PaymentPage`, `PractitionerBookings`, `PractitionerDashboard`,
`PractitionerEarnings`, `PractitionerPortal`, `PractitionerSignup`,
`UserBookings`.

### Retained but unrouted public/user pages

`Support`, `SupportCenter`, `SupportTickets`, `TicketDetail`.

### Active admin pages

`AdminAgents`, `AdminAnalytics`, `AdminAnnouncements`, `AdminAuditLog`,
`AdminDashboard`, `AdminEmailTemplates`, `AdminFAQ`, `AdminFAQsManager`,
`AdminLegalDisputes`, `AdminLegalServices`, `AdminListings`,
`AdminNeighbourhoods`, `AdminPayments`, `AdminReports`, `AdminSubscriptions`,
`AdminSupportDashboard`, `AdminSupportQueue`, `AdminSupportSettings`,
`AdminTicketDetailPage`, `AdminUsers`, `AdminVerifications`.

### Retained but unrouted admin pages

`AdminSupport`, `AdminTicketDetail`.

## Screenshot status

No screenshots were captured because no safe configured staging environment,
representative fixtures, or production behavior source was supplied. Mock
screenshots would not establish the required baseline.

Once staging exists, capture home/search/detail, all auth states, every listing
wizard step, saved/inquiry/notification/support flows, provider/legal/business
profiles, verification states, and every admin route for allowed and denied
roles. Record build, environment, role, fixture IDs, viewport, timestamp, and
expected result; do not use production personal data.
