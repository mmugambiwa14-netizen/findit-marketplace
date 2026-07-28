# FindIt V1 UI/UX Audit

Status: **Repository-derived audit reconciled to the approved V1 scope**  
Reviewed surface: 82 page modules, active/hidden/unrouted routes, marketplace
and admin navigation, 177 component modules, global styles, and documented
behavior/migration findings

## Executive finding

The current application contains many useful marketplace patterns, but the
experience is diluted by product breadth and duplication. A new user can
browse and post, yet must interpret competing concepts: Saved/Favourites,
Alerts/Notifications, seller/business/dealer/agent identities, product/service/
legal systems, nine listing steps, package/document/verification promises, and
an admin suite larger than the launch operation.

V1 should not receive a cosmetic redesign. It should remove cognitive and
operational branches from the launch surface, standardize the retained
marketplace patterns, and deepen trust, performance, mobile, and accessibility
quality in the core journeys.

## Cross-product findings

### Information architecture

- Desktop top navigation exposes Pricing while the monetization features are
  disabled; it also includes currency conversion, dark mode, alerts, and Post.
- Mobile navigation uses Home, Search, Post, Services, Profile while Favourites
  is hidden elsewhere and the `userMenuItems` array is not rendered in the
  inspected bottom navigation.
- Alerts and Notification Center implement the same `AppAlert` data as two
  products with different behavior.
- Profile and Settings overlap; My Listings and My Services split one owner
  job; Business/Dealer/Agent concepts add more identity routes.
- Three admin navigation implementations contain different groupings, creating
  drift and a 21-page active admin surface.

Recommendation: one desktop/mobile marketplace navigation, one account
destination, one owner inventory destination, one Favourites concept, one
Messages entry, one essential-notification indicator, lightweight business/
dealer profile paths, and six admin destinations.

### Visual language

Strengths include an existing Inter-based token system, consistent teal brand
direction, reusable Radix/shadcn primitives, and responsive utilities.

Weaknesses include extensive ad-hoc `rounded-xl/2xl`, shadows, backdrop blur,
a gradient elevated mobile Post button, emoji status/category marks, page-level
colour decisions, two toast systems, and decorative reveal behavior. These
patterns make the UI feel generated rather than deliberately governed.

Recommendation: adopt `DESIGN_SYSTEM.md`, use restrained surfaces/borders,
one semantic component per state, and actual inventory imagery.

### Marketplace comprehension

- Home repeats the same recent datasets across Hot Right Now, New to Market,
  Latest Property, and Latest Cars, creating false abundance and long scroll.
- Search exposes many controls but queries only 100 rows per type before
  client filtering, so the polished UI can return incomplete results.
- Three product detail pages and multiple cards repeat similar structures,
  increasing inconsistency risk.
- Generic verification badges and document/package steps imply trust and paid
  capabilities not supported by the current production architecture.

Recommendation: simplify Home, make Search a defining strength with
autocomplete, private recent searches, complete server queries, stable
pagination and URL state, standardize cards/details, and use only explicit
trust facts.

### Listing creation

The current flow has nine steps: category, pricing, photos, details, location,
contact, documents, package, preview. It also adds phone verification, local
draft behavior, bidding/variants, exact-map options, premium labels, and
private-document uploads. The ordering asks price/photos before a complete
title/description and makes a free listing feel like an enterprise workflow.

Recommendation: five steps — category, details/price, location, photos/contact,
review/publish. Documents, packages, variants, bidding, exact location, and
phone OTP are excluded from V1.

### Trust

The interface contains verified seller/provider concepts, ratings/reviews,
document submission, direct contact, and reports. The underlying verification,
transaction proof, storage privacy, and moderation operating models are not
strong enough to justify those claims.

Recommendation: trust through clear listings, explicit email confirmation,
account age, direct contact choice, safety guidance, reports, state history,
and manual moderation. No generic verified or reputation claim.

### Mobile

Responsive classes and bottom navigation exist, but complete device QA has not
been run. Risks include long nine-step forms, sticky headers plus bottom nav/
contact bars, wide category/favourite tabs, admin tables, map/upload behavior,
keyboard overlap, and 10 px navigation labels.

Recommendation: 44 px targets, 16 px gutters, five-item navigation, full-width
forms, filter sheets, swipe gallery, per-file upload feedback, bottom contact
bar, and real-device keyboard/orientation tests.

### Accessibility

Static inspection previously found inconsistent label associations, relatively
few explicit accessible names for icon controls, and no comprehensive keyboard,
screen-reader, contrast, or focus audit. `CardTitle` is a `div`, generic
spinners lack consistent announcements, emoji convey status, and page-specific
dialogs/menus need focus verification.

Recommendation: semantic headings/landmarks, associated labels/errors,
focus-visible system, labelled icon buttons, 4.5:1 text contrast, state text
plus colour, dialog focus management, live regions for async results, and
manual NVDA/VoiceOver/keyboard QA.

### Performance experience

At the 2026-07-17 planning baseline, the entry bundle was roughly 2.1 MB
(581 KB gzip) and 75 pages were statically imported. Route-level lazy loading
has since reduced the current entry JavaScript to 541,421 bytes (157,897 gzip),
but no accepted performance budget or representative-load benchmark exists.
Images still lack a verified derivative pipeline, and many screens use a
spinner rather than layout-matched skeletons.

Recommendation: route-level lazy loading after route tests, server pagination,
responsive image derivatives, progressive/lazy media, skeletons, local pending
states, prefetch only high-probability routes, and no decorative animation.

## Current page-by-page audit

“V1 treatment” describes the product destination; it does not authorize code
or data deletion.

### Authentication and account

| Current screen | Purpose | V1 treatment | UX finding and recommendation |
|---|---|---|---|
| `Login` | Establish session | MVP | Clear card and labelled fields. Hide unverified OAuth, normalize errors, preserve return URL, and distinguish service/profile failure from bad credentials. |
| `Register` | Create account | MVP | Link-confirmation approach is suitable. Add display name/terms, reduce unnecessary phone friction, handle confirmation-on/off correctly, and hide unverified OAuth. |
| `ForgotPassword` | Request recovery | MVP | Keep generic success. Add cooldown/resend guidance and stable recovery copy. |
| `ResetPassword` | Complete recovery | MVP | Source is hardened for recovery event. Add bounded checking/retry and test invalid/expired/replay/multi-tab states. |
| `Profile` | Account overview | Merge into Account | Current profile is another account hub. Merge with Settings and remove feature links outside V1. |
| `Settings` | Edit profile/preferences | Merge into Account | Remove avatar/bio/currency/verification complexity; retain name, contact, security, legal, export/delete. |
| `SellerProfile` | Public seller context | MVP simplified | Change email-based URL to opaque ID; show active inventory/account age/explicit confirmed facts; remove follows/ratings/generic verification. |
| `UserNotRegisteredError` | Platform registration failure | Replace with service state | Base44 platform semantics should not survive. Use a normalized account/profile setup error with Retry/Support. |
| `AccountBlocked` | Explain suspended/banned state | MVP | Keep clear reason/expiry and Support; pair with server denial and avoid exposing internal notes. |

### Public marketplace

| Current screen | Purpose | V1 treatment | UX finding and recommendation |
|---|---|---|---|
| `Home` | Landing and recent discovery | MVP simplified | Strong base, but repeats the same data four times. Keep hero search, four categories, one recent section, safety, footer. |
| `Search` | Cross-category discovery | MVP rebuilt at data boundary | Useful filters but incomplete first-100 client search. Move autocomplete/query/filter/page to server, add private recent searches, stable ordering, URL state, and smaller facets. |
| `PropertyDetail` | Assess property | MVP standardized | Retain gallery/price/facts/contact; use shared detail shell, approximate location, safety/report, no unsupported trust/payment data. |
| `CarDetail` | Assess vehicle | MVP standardized | Same hierarchy as Property with typed facts. Remove category-specific visual drift. |
| `MachineryDetail` | Assess equipment | MVP standardized | Same hierarchy with machinery facts and shared gallery/contact/state behavior. |
| `Services` | Browse services | MVP via unified Search | Avoid a second discovery engine; canonical Service search state with curated filters. |
| `ServiceDetail` | Assess service | MVP simplified | Advertise/contact only. Remove booking, like, rating, verification, and payment affordances. |
| `Pricing` | Paid packages | Removed from V1 | Payments/premium are off; page creates false expectation and should be unreachable. |
| `MarketInsights` | Trends/statistics | Removed from V1 | Data quality and methodology cannot support a trustworthy product claim. |
| `ValuationTool` | Price estimate | Removed from V1 | No representative local model/evidence; inaccurate output harms trust. |
| `DealerSearch` | Dealer discovery | Replace with MVP dealer profile/inventory entry | Do not ship a separate directory. Reuse Business Profile architecture and reach dealer pages from listings/profiles; add search within active vehicle inventory. |
| `AgentDirectory` | Agent browsing | Removed from V1 | Ambiguous concept overlaps sellers/dealers/services without a defined user problem. |
| `MapView` | Geographic browsing | Future Version | Hidden correctly; requires geocoding, privacy, quota, clustering, and device QA. |

### Advertising and owner inventory

| Current screen | Purpose | V1 treatment | UX finding and recommendation |
|---|---|---|---|
| `CreateListing` | Post product | MVP reduced to five steps | Nine steps and phone/document/package complexity increase abandonment. Reorder and reuse typed schemas for edit. |
| `MyListings` | Manage product listings | MVP expanded to all inventory | Useful status/actions but four cramped stats, three queries, and Bulk link add clutter. Use one paginated Products/Services view. |
| `CreateService` | Post service | MVP in shared wizard | Keep service-specific fields inside the same five-step shell and contact model. |
| `MyServices` | Manage services | Merge into My Listings | Separate owner dashboard is unnecessary; label Service rows clearly. |
| `BulkUploadCentre` | Choose bulk workflow | Future Version | Power-seller capability waits for dealer/import quality controls. |
| `BulkCsvUpload` | Spreadsheet import | Future Version | High potential later; requires idempotent validation, corrections, quotas, and audit. |
| `BulkDuplicate` | Copy listing | Future Version | Useful later after duplicate/spam controls. |
| `BulkPdfImport` | AI/document extraction | Deferred | Private upload/extraction/AI safety is outside V1. |
| `BusinessProfiles` | Create/manage company profiles | MVP simplified | Keep one owner, business/dealer type, approved public fields, logo, and active inventory. Remove verification, staff, analytics, premium, subscription, payment, and alternate dashboard behavior. |
| `BusinessOwnerDashboard` | Alternate business dashboard | Removed from V1 | Hidden and overlapping with future organisation product. |
| `PractitionerDashboard` | Practitioner overview | Removed from V1 | Hidden and dependent on future legal product. |

### Engagement and contact

| Current screen | Purpose | V1 treatment | UX finding and recommendation |
|---|---|---|---|
| `Saved` | Saved product inventory | MVP as Favourites | Good empty state, but three first-100 fetches are incorrect. Query joined saved targets with pagination and use one term/icon. |
| `Inquiries` | In-app conversations | MVP narrowed | Keep listing-linked participant-only plain text, inbox unread state, block/report, rate and retention controls. Remove attachments, receipts, typing, presence, media, voice, groups, AI, and automated moderation. |
| `Alerts` | Alert inbox | Consolidate into MVP essential notifications | Retain only the five approved operational event types with owner read state and safe links; remove price/marketing/social behavior. |
| `NotificationCenter` | Duplicate alert inbox | MVP implementation candidate after narrowing | Use one list only; remove mark-on-view side effects, sound, filters, and unapproved event types. |
| `TransactionHistory` | Payment records | Removed from V1 | No payment operation exists; route is misleading. |

### Help, support, and verification

| Current screen | Purpose | V1 treatment | UX finding and recommendation |
|---|---|---|---|
| `SupportHub` | Support entry | MVP transformed to Help | Keep safety/FAQ/contact entry. Remove ticket-dashboard and live-support expectations. |
| `FAQs` | Answer common questions | MVP static Help content | Merge into Help; version-control launch content rather than duplicate CMS. |
| `CreateTicket` | Submit support request | MVP transformed to Contact Support | Current attachment metadata is misleading. Use category/email/message/reference, no attachment or portal. |
| `MyTickets` | Customer ticket list | Deferred and unreachable | Not needed with founder inbox; preserve historical data/architecture. |
| `TicketDetailUser` | Ticket chat/detail | Deferred and unreachable | Current selected attachments are discarded; do not expose until a full secure ticket system returns. |
| `Support` | Unrouted duplicate | Removed | Duplicate legacy support screen. |
| `SupportCenter` | Unrouted duplicate | Removed | Duplicate legacy support screen. |
| `SupportTickets` | Unrouted duplicate | Removed | Duplicate legacy ticket list. |
| `TicketDetail` | Unrouted duplicate | Removed | Duplicate legacy ticket detail. |
| `Verification` | Upload identity/provider evidence | Deferred and unreachable | Sensitive collection, badge meaning, fraud, review, appeal, and retention are not operationally ready. |

### Legal and payment screens

| Current screen | Purpose | V1 treatment | UX finding and recommendation |
|---|---|---|---|
| `LegalPractitioners` | Legal directory | Future Version | Hidden correctly; requires dedicated professional trust model. |
| `LegalServices` | Legal service browsing | Future Version | Avoid overlap with simple V1 services until the legal proposition is approved. |
| `LegalPractitionerProfile` | Practitioner detail | Future Version | Credentials/reviews/booking require verification and operational evidence. |
| `PractitionerSignup` | Professional onboarding | Future Version | Sensitive credentials and role/capability model are outside V1. |
| `BookingRequest` | Request legal service | Future Version | Booking lifecycle not part of contact-only services. |
| `UserBookings` | User booking list | Future Version | Depends on future booking product. |
| `BookingDetail` | Booking workflow | Future Version | Depends on payments, status transitions, messaging, and disputes. |
| `PractitionerPortal` | Practitioner hub | Removed from V1 | Hidden, includes a broken profile route, and belongs to future legal architecture. |
| `PractitionerBookings` | Provider booking list | Future Version | Future legal/service operation. |
| `PractitionerEarnings` | Earnings/payouts | Deferred | Depends on payments/payouts and must remain unreachable. |
| `PaymentPage` | Checkout | Deferred | Hidden correctly; do not expose without gateway/reconciliation/refund/security readiness. |

### Admin screens

| Current screen | Purpose | V1 treatment | UX finding and recommendation |
|---|---|---|---|
| `AdminDashboard` | Operational overview | MVP simplified | Keep actionable counts/health/recent actions; remove vanity/revenue/future-feature cards. |
| `AdminListings` | Product moderation | MVP as Marketplace | Add Services tab/context, server filters/page, protected reasoned actions, audit reference. |
| `AdminUsers` | User administration | MVP narrowed | Keep search/status/context and reasoned suspend/ban/restore; remove arbitrary role/profile/service-role behavior. |
| `AdminReports` | Moderation queue | MVP | Make one actionable queue linked to listing/user and audit; no AI triage. |
| New `AdminCategories` | Controlled taxonomy | MVP | Add/relabel/activate/reorder approved subcategories while preserving stable IDs and referenced rows; every action is protected and audited. |
| `AdminAuditLog` | Privileged history | MVP hardened | Read-only, server paginated, result/correlation, redacted; no best-effort writes. |
| `AdminAnalytics` | Platform analytics | Future Version | Move a few actionable aggregates to Overview; avoid current bounded full-row aggregation. |
| `AdminVerifications` | Document review | Deferred | Verification off; do not expose private evidence. |
| `AdminPayments` | Payment operations | Deferred | Payment system off. |
| `AdminSubscriptions` | Subscription operations | Deferred | Subscription system off. |
| `AdminAnnouncements` | Content notices | Future Version | Static release notices suffice at launch. |
| `AdminNeighbourhoods` | Area content management | Removed from V1 | One curated location model removes this CMS. |
| `AdminFAQ` | FAQ CMS | Removed from V1 | Duplicate help management and unnecessary launch operation. |
| `AdminFAQsManager` | Support FAQ CMS | Removed from V1 | Duplicate of AdminFAQ. |
| `AdminEmailTemplates` | Browser template editor | Removed from V1 | Keep critical transactional templates controlled in provider/config review. |
| `AdminLegalServices` | Practitioner/bookings/disputes | Future Version | Includes dangerous browser service-role semantics and no V1 legal surface. |
| `AdminLegalDisputes` | Legal dispute decisions | Future Version | Depends on legal/payment/dispute product. |
| `AdminSupportDashboard` | Help-desk overview | Removed from V1 | Founder inbox replaces enterprise support operations. |
| `AdminSupportQueue` | Ticket queue | Removed from V1 | No V1 ticket system. |
| `AdminTicketDetailPage` | Ticket handling | Removed from V1 | No V1 ticket chat/attachments. |
| `AdminAgents` | Support staff | Removed from V1 | No support-team role/system. |
| `AdminSupportSettings` | Help-desk config | Removed from V1 | Configuration burden without a V1 help desk. |
| `AdminSupport` | Unrouted duplicate | Removed | Duplicate legacy support admin. |
| `AdminTicketDetail` | Unrouted duplicate | Removed | Duplicate legacy ticket detail. |

## Navigation decisions

| Current item | Decision | Reason |
|---|---|---|
| Home | Keep | Primary marketplace entry. |
| Search | Keep | Core discovery. |
| Post | Keep as primary | Core supply action with auth return. |
| Services | Move into category/search, retain desktop shortcut | Important category but not a unique mobile system. |
| Profile | Rename Account | Clearer combined destination. |
| Pricing | Remove | No V1 paid product. |
| Currency picker | Remove | Display listing currency; avoid unreliable conversion. |
| Dark-mode toggle | Defer | Reduce launch visual QA. |
| Notification indicator | Keep and narrow | Essential operational notices only; no price/marketing/social alerts. |
| Messages | Keep when signed in | Minimal listing-linked plain-text buyer/seller contact. |
| My Listings | Keep in Account | Owner inventory. |
| Saved | Rename Favourites and make mobile item | High return value and consistent terminology. |
| Support | Rename Help | Honest lightweight support model. |
| Settings | Merge into Account | Avoid duplicate profile/settings hierarchy. |
| Alerts/Notifications | Consolidate | One restrained essential-notification entry; no duplicate Alerts product. |
| Business/Dealer | Keep as contextual profiles | Reach from Account/listings/profiles, not a duplicate primary directory. |
| Agents/Legal | Remove from V1 navigation | Undefined agent and all legal functionality remain outside V1. |

## Premium-intent test

A premium marketplace experience does not mean more gradients, badges, or
features. For FindIt it means:

- accurate results and filters;
- sharp, progressively loaded imagery;
- stable, readable cards;
- obvious price/location/contact hierarchy;
- trustworthy status and seller wording;
- short forms that preserve progress;
- fast mobile navigation;
- specific empty/error recovery;
- consistent, accessible controls; and
- no visible capability that does not actually work.

## Audit conclusion

The strongest V1 is substantially smaller but higher quality. The current
repository already contains many useful visual building blocks; the product
work is to standardize those blocks around the approved marketplace loops and
remove unavailable or operationally dangerous branches from the launch
surface after approval.
