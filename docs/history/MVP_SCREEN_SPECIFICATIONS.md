# FindIt V1 Screen Specifications

Status: **Approved V1 screen contract; implementation in progress**  
These specifications describe the approved V1 surface. They are not a visual
redesign mandate or evidence of completion.

## Global marketplace shell

**Purpose:** provide predictable discovery, posting, account, and help access.

Desktop header: logo, Browse, Services, Post listing, Favourites, Messages,
essential-notification indicator, Account.
Mobile bottom nav: Home, Search, Post, Favourites, Account. Use an opaque
surface, clear active state, 44 px targets, and safe-area spacing. Account menu
contains My Listings, Business Profile when owned, Profile & Settings, Help,
Admin when authorized, Sign out.

No Pricing, marketing/price Alerts, global currency converter, agent/legal
directory, verification, transaction, or hidden-feature link. Business/dealer
pages are reached from profiles and listings rather than a duplicate primary
directory. Content
uses one max-width container; mobile screens reserve space for bottom nav.

## 1. Home `/`

**Purpose:** explain FindIt and start discovery.

Layout:

1. compact brand promise and large search field;
2. four category cards: Property, Vehicles, Machinery, Services;
3. one “Recently added” section, optionally grouped by category only when real
   inventory justifies it;
4. safety/trust strip with concrete guidance;
5. concise footer links.

Remove duplicate Hot Right Now/New to Market/Latest blocks, decorative reveal
animation, fake popularity, and unsupported verified claims. Mobile shows
search and categories above any inventory. Home remains useful when recent
inventory fails by preserving search/category actions.

## 2. Search and category browsing `/search`

**Purpose:** find relevant inventory across the full database.

Desktop: autocomplete search row; category tabs; left/inline essential filters; result count
and sort; responsive grid; pagination. Mobile: sticky search header, horizontal
category selector, Filter and Sort buttons, applied-filter chips, result grid,
bottom-sheet filters. Recent searches appear privately before a new query and
include a clear action. Suggestions are debounced, keyboard accessible, and
limited to curated categories, locations, and safe public listing terms.

Filters:

- common: category, location, price/currency;
- property: sale/rent, type, bedrooms;
- vehicles: make/model, condition, year;
- machinery: type/make, condition, year;
- services: category, service area, pricing type.

State lives in the URL. Server-side results use deterministic stable
pagination and never search only a client-side first page. Empty results show applied criteria, Clear filters,
and related category/location suggestions. Loading uses card skeletons. Error
keeps controls and offers Retry. Results never include non-public states.

## 3. Product listing card

**Purpose:** support fast comparison and detail navigation.

Show image, category cue, title, price/currency or Contact for price, location,
two or three key facts, and favourite button. Use consistent aspect ratio and
line limits. The card does not show multiple badges, unqualified verification,
premium ribbon, view count, direct contact clutter, or decorative gradients.

Favourite is a separate accessible button. Image/title region links to detail.
Unavailable state is not rendered in public results.

## 4. Property/vehicle/machinery detail

**Purpose:** help a user assess and contact.

Shared hierarchy:

1. back/breadcrumb and share;
2. image gallery;
3. title, price, approximate location, updated date;
4. category-specific key facts;
5. description;
6. seller summary;
7. safety guidance and report action;
8. related listings after core content.

Desktop places a sticky contact card beside content. Mobile uses a bottom
contact bar with **Message seller** as the primary signed-in action and direct
WhatsApp/Call actions when enabled, with More for permitted email. Guests can
use direct actions or sign in to message. Own listing shows Manage. Missing
listing shows “No longer available” and category link. No
reviews, variants, bidding, documents, exact map pin, deposit/fee breakdown,
premium, or generic verified badge.

## 5. Services browse `/services` or `/search?type=service`

**Purpose:** discover service advertisements.

Prefer the unified Search shell with Service selected. If `/services` remains,
it is a thin canonical route into that state, not a second search
implementation. Cards show category, title, service area, pricing meaning, and
provider. No booking availability or verified-pro badge.

## 6. Service detail `/service/:id`

**Purpose:** understand an offering and contact its provider.

Use the shared detail structure with service images, category, area/travel,
pricing type, description, provider summary, contact actions, safety guidance,
and report. Remove booking, disputes, credentials, likes, reviews, and payment
actions from V1.

## 7. Seller profile `/seller/:publicId`

**Purpose:** provide context and show active inventory.

Use an opaque public identifier, not email in the URL. Show display name,
member-since date, approximate area when deliberately public, explicit
confirmed facts, contact preferences, and active product/service inventory.
Do not show private email, follower graph, ratings, bio/avatar requirement,
business verification, or generic trusted badge. Suspended/removed users show
no inventory/contact and an accurate unavailable state.

## 7A. Business profile `/business/:publicId`

**Purpose:** give a business a credible public identity and group its active
marketplace inventory.

Show business name, logo, description, contact information, address only where
appropriate for public display, optional validated website/social links, and
all active business listings. The primary action is Contact or Browse listings,
depending on entry context. Do not show verification, subscriptions, analytics,
staff management, premium tools, payments, or a separate business dashboard.

## 7B. Dealer page `/dealer/:publicId`

**Purpose:** present a vehicle dealer and make its inventory easy to evaluate.

Reuse the Business Profile shell and data contract. Emphasize dealer name,
logo, contact details, vehicle inventory count, and search/filter within active
inventory. Do not add dealer verification, financing, premium tools,
subscriptions, analytics, or a dealer-specific management dashboard.

## 8. Login `/login`

**Purpose:** establish an account session.

Single card with email, password, Forgot password, primary Log in, and link to
Create account. Hide OAuth buttons until enabled and tested. Error appears
inline with fields and is normalized. Loading keeps label/width stable. Return
to the intended safe route. Brand link returns Home.

## 9. Register `/register`

**Purpose:** create the minimum account required for protected actions.

Fields: display name, email, password, confirmation, terms/privacy acceptance;
phone may be requested when posting/contact preference is configured rather
than as unnecessary signup friction. Show password requirements before error.
No role selection, business type, verification, subscription, or marketing
opt-in bundled by default.

Success screen names the email, explains confirmation and expiry, offers
Resend with cooldown, Change email, and Back to login. Branch correctly when
environment confirmation behavior differs.

## 10. Forgot password `/forgot-password`

**Purpose:** request recovery without revealing account existence.

One email field and Send recovery link. Success always uses generic copy,
provides resend/cooldown guidance, and links to Login. Preserve entered email
locally for convenience without exposing it in URLs/logs.

## 11. Reset password `/reset-password`

**Purpose:** update password only in a valid recovery exchange.

Checking state has a bounded timeout/retry. Invalid/expired state provides
Request a new link. Valid state shows new password, confirmation, requirements,
and Update password. Ordinary sessions never unlock the form. Success clears
recovery marker and routes to Login or a clearly approved session path.

## 12. Favourites `/saved`

**Purpose:** revisit saved product listings.

Title is consistently “Favourites.” Show result count, optional category
filters, current cards, and Remove action through the favourite control. Empty
state links to Browse. Loading uses cards. A now-unavailable saved item may be
shown as a compact unavailable record with Remove when policy permits.

Do not fetch every first-100 listing set client-side and filter it. Query saved
targets with authorization and pagination.

## 12A. Messages `/messages` and `/messages/:conversationId`

**Purpose:** let a buyer and seller continue one listing-linked conversation
without leaving FindIt.

The inbox shows listing thumbnail/title, other participant, last message
preview, last-message time, and unread indicator. The thread keeps listing
context visible and supports plain-text send, Block, and Report. Empty state
links to Browse. No attachments, media, read receipts, typing indicators,
online presence, reactions, voice, groups, AI, or automated moderation.

## 12B. Essential notifications `/notifications`

**Purpose:** explain marketplace decisions and account events that require
awareness or action.

Show only listing approved, listing rejected, listing expires soon, report
resolved, and account suspended/restored notices. Each row has a title,
explanation, timestamp, read state, and safe relevant link. A simple Mark all
read may be included. No filters, categories, marketing, price alerts, sounds,
or complex preferences. Message unread state remains in Messages.

## 13. Post listing/service `/create`

**Purpose:** create a quality advertisement in five understandable steps.

Shared shell: Back/Exit with draft warning, step name and progress, Save draft,
main content, Back/Continue. Maximum form width 680 px.

1. Category: Product/Service, then subtype/offer type.
2. Details: title, description, price/currency, typed facts.
3. Location: curated approximate area and privacy explanation.
4. Photos & Contact: upload/reorder/retry; Call/WhatsApp/email preferences.
5. Review & Publish: public preview, Edit section links, marketplace rules,
   idempotent Publish.

Remove phone-OTP gate, documents, packages, premium labels, variants, bidding,
exact map, and nine-step progress. Errors keep draft and focus the correct
section. Success shows View listing and Manage listings.

## 14. My Listings `/my-listings`

**Purpose:** manage all owned product and service advertisements.

Header: title and Post new. Filter tabs: All, Published, Draft, Paused,
Unavailable/Expired. Search only when inventory size warrants it. Each row/card
shows image, kind, title, status, updated date, and a labelled action menu:
View, Edit, Pause/Resume, Mark unavailable, Renew, Delete.

Remove Bulk button, four cramped stat cards, separate category requests, and
misleading immediate publish transitions. Use one owner query with pagination.

## 15. Edit listing/service

**Purpose:** maintain an existing advertisement.

Use a full-page version of the same approved creation fields and schemas,
preloaded from authoritative data. Show status and public preview. Save draft
and Save changes are explicit. State transitions remain separate protected
actions. Warn before discarding unsaved work. A narrow contact-only dialog is
not sufficient.

## 16. Account/Profile & Settings `/account`

**Purpose:** manage identity, contact preferences, and security.

Combine current Profile and Settings into sections:

- Account: display name, email and confirmation state;
- Contact: phone and use for Call/WhatsApp;
- Security: password change/recovery guidance, sessions when supported;
- Legal: accepted terms/privacy and links;
- Data: export/delete request;
- Sign out.

Show My Listings/Favourites/Business Profile/Messages/Help as navigation cards only if not already
available in menu. Remove avatar/bio, currency conversion, verification,
business verification, transaction history, subscriptions, and duplicate
seller settings. Lightweight Business Profile editing remains a separate
focused flow.

## 17. Help `/help`

**Purpose:** answer common questions and communicate safety.

Searchable or grouped static sections: buying safely, selling/posting,
accounts, reports/moderation, contact, privacy/terms. Use accordions only when
keyboard semantics are correct and content remains searchable. Primary action:
Contact Support. No AI chat, ticket dashboard, or “live” support promise.

## 18. Contact Support `/help/contact`

**Purpose:** send a structured request to the founder inbox.

Fields: category, email (prefilled when signed in), message, optional listing/
report reference. No attachment. Explain response expectation honestly. Apply
rate limits and enumeration-safe success. Show reference ID on success. This
screen does not create a visible customer ticket portal in V1.

## 19. Report dialog/page

**Purpose:** submit an actionable safety report.

Shows target summary, curated reason, optional details, privacy note, and
Submit. Authentication prompt retains target. Success confirms receipt and
provides Help link for urgent concerns. Do not expose reporter identity to the
reported user or promise a specific enforcement result.

## 20. Error and unavailable screens

Provide dedicated content for Not found, Listing unavailable, Permission
denied, Sign-in required, Account blocked, Temporary service problem, Offline,
and Invalid/expired auth link. Each has a concise cause and safe next action.
No raw stack/provider error, silent Home redirect, or indefinite spinner.

## 21. Admin shell `/admin/*`

**Purpose:** operate V1 with one consistent navigation.

Desktop sidebar and mobile drawer use: Overview, Marketplace, Users, Reports,
Categories, Audit Log, Back to marketplace, Sign out. Show open Reports count. No nested
support/legal/payment/content groups.

## 22. Admin Overview `/admin`

Show actionable metric links: published/pending/removed inventory, open/old
reports, active/suspended/banned users, recent actions, and relevant provider/
storage/job health. Use compact cards/list, no vanity charts. Loading and
partial service failures identify which metric failed.

## 23. Admin Marketplace `/admin/listings`

Tabs Products/Services. Search and server filters by status/category/location/
owner/report/date. Desktop table; mobile essential list/detail sheet. Detail
shows content, images, owner, report summary, state history, public preview.
Moderation actions require reason and confirmation and return audit reference.

## 24. Admin Users `/admin/users`

Search by approved identifiers and filter status. Table/list shows display
name, masked contact, created date, inventory/report summary, status. Detail
supports suspend, ban, restore with reason/expiry. No arbitrary profile edits,
role dropdown, super-admin, verification document, payment, or token access.

## 25. Admin Reports `/admin/reports`

Queue filters by state/reason/age/target. Detail presents reporter notes safely,
target and user context, related reports, and resolution. Action may link to a
marketplace/user moderation operation; both share audit correlation. Assignment
and AI triage are absent.

## 25A. Admin Categories `/admin/categories`

Show the four protected top-level categories and approved subcategories with
display label, stable slug/ID, active state, order, and referenced-listing
count. Admin can add an approved subcategory, rename its display label,
activate/deactivate, and reorder through protected audited operations. No
free-form user category, deletion of protected/referenced rows, bulk import,
analytics, or general CMS controls.

## 26. Admin Audit Log `/admin/audit-log`

Read-only, server-paginated table with actor, action, resource, result, reason,
timestamp, correlation. Filters persist in URL. Detail redacts secrets/private
data. No edit/delete control. Export appears only with a documented need.

## Cross-screen mobile requirements

- 16 px gutters, safe-area navigation, 44 px targets.
- No horizontal form/table overflow for core user screens.
- Filter sheets avoid keyboard overlap and retain Apply.
- Contact bar does not cover content or browser UI.
- Galleries support swipe and keyboard/accessibility alternatives.
- Upload shows per-file progress/retry and survives screen rotation where
  browser behavior permits.
- Long titles/prices wrap or truncate without hiding primary actions.

## Cross-screen state requirements

Every data screen specifies and tests initial loading, refresh, empty,
filtered-empty, partial data, error, retry, offline, stale, permission, and
success. Skeletons match final geometry; toast is never the only durable error.
Focus moves to page title, dialog title, invalid field, or success summary as
appropriate without surprising keyboard users.
