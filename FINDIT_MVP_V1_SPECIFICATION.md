# FindIt MVP V1 Product Specification

Status: **Authoritative Version 1 product specification**  
Reviewed: 2026-07-17  
Revised: 2026-07-17  
Product market: Zimbabwe  
Authority: Product/MVP/UX scope beneath Migration Specifications Documents 1–4

This revision supersedes the earlier proposed MVP draft and any conflicting
product-scope recommendation in supporting planning documents. Documents 1–4
remain authoritative for migration engineering, security, evidence, and
handover requirements.

## Product Principles

FindIt is not attempting to become Facebook Marketplace, LinkedIn,
Booking.com, Fiverr, Airbnb, or Stripe.

FindIt is:

> A Zimbabwe-focused marketplace that helps people discover opportunities,
> advertise products and services, evaluate offers, and contact sellers with
> minimal friction.

The product is organized around four core actions:

- **Discover** relevant products and services quickly.
- **Advertise** an offer without specialist knowledge or unnecessary steps.
- **Evaluate** an offer through clear, trustworthy information.
- **Contact** the person behind an offer with minimal friction.

If a feature does not strengthen one of these four actions, it does not belong
in Version 1. Every screen must also answer: **“What does the user most likely
want to do next?”** Its primary action must be obvious.

## 1. Product definition

FindIt V1 is a focused Zimbabwean classifieds marketplace for discovering,
advertising, and contacting sellers of:

- property;
- vehicles;
- machinery and equipment; and
- services.

V1 helps a visitor find a relevant listing quickly and contact its owner by
in-app text message, phone, WhatsApp, or email. It helps any registered user
publish and manage a listing without first becoming a special type of seller.
Businesses may present a lightweight professional identity, and vehicle
dealers may present the same profile specialized around their inventory.

FindIt V1 is not a transaction platform, social network, booking engine,
identity-verification agency, help-desk product, advertising platform, or AI
assistant. Business and dealer profiles do not change that boundary: they are
simple public identities attached to listings, not enterprise account suites.
Excluded capabilities may return after the marketplace proves demand and the
founder can operate them safely.

## 2. Product promise

> Find what you need in Zimbabwe, understand the offer, and contact the person
> behind it without friction.

The first-session experience should answer five questions immediately:

1. What can I find here?
2. Is there relevant inventory near me?
3. Does this listing look credible?
4. How do I contact the seller?
5. How do I post my own listing?

## 3. MVP outcomes

V1 succeeds when:

- guests can browse all published marketplace inventory;
- search, category, location, price, and essential category filters work on
  the full result set with stable pagination;
- users can register, confirm email, sign in, recover access, and sign out;
- users can create, preview, publish, edit, pause, mark unavailable, and delete
  their own listings;
- a listing has useful photos, a clear price, location, description, essential
  category details, seller identity, and direct contact actions;
- businesses can present a lightweight professional profile and all active
  listings, while vehicle dealers can present searchable inventory through
  the same profile architecture;
- buyers and sellers can exchange safe, listing-linked plain-text messages;
- users receive only essential operational marketplace notifications;
- users can save listings under one consistently named **Favourites** feature;
- users can report suspicious listings or users;
- admins can moderate listings/services, users, reports, and the category
  vocabulary with durable audit;
- listing images are stored, validated, owned, and delivered independently of
  Base44;
- the application is responsive, accessible, observable, recoverable, and
  deployable under Documents 1–4.

## 4. Target users

### Buyer or browser

A guest or registered user looking for property, vehicles, machinery, or a
service provider. They value useful results, honest presentation, quick
contact, safety guidance, and low sign-up pressure.

### Seller or service provider

Any active registered user who owns one or more listings or services. Seller
is a relationship to content, not an application role. They value a short
publishing flow, dependable media uploads, clear status, and simple management.

### Business or vehicle dealer

A registered user who needs a professional public identity for commercial
inventory. They value a credible profile, reusable contact information, and a
single place to show all listings. A dealer is a business-profile presentation
specialized for vehicles, not a privileged application role.

### Administrator

The founder or a small trusted operations team. They need the smallest toolset
that keeps the marketplace safe: overview, marketplace moderation, user
controls, report handling, lightweight category management, and audit history.

## 5. MVP capabilities

### Public marketplace

- Home with a strong search entry, four category shortcuts, and recent quality
  listings without duplicate promotional sections.
- Fast server-side search with autocomplete, recent searches, URL-persisted
  query and filters, stable pagination, and a small useful category-specific
  filter set.
- Category browsing implemented as filtered search, not separate duplicate
  page families.
- Product and service listing cards using one visual hierarchy.
- Detail pages with media, price, facts, location, description, seller card,
  safety advice, report action, and persistent contact actions.
- Public seller page showing basic profile information and active inventory.
- Lightweight public business profile with business name, logo, description,
  contact information, address where appropriate, optional website and social
  links, and all active business listings.
- Dealer page implemented as the vehicle-focused presentation of the business
  profile, with dealer information, logo, contact details, inventory, and
  search within that inventory.
- Business and dealer profiles have no verification, subscriptions, analytics,
  staff management, premium tools, payments, financing, or separate dashboard.
  Owners use the normal listing-management experience.
- Static Help, safety, terms, privacy, and marketplace rules.

### Account

- Email/password registration, confirmation, login, logout, and recovery.
- One account page for name, phone, optional WhatsApp preference, and security
  actions. Email change is a separately confirmed operation.
- Favourites.
- My Listings, including product and service inventory.
- Messages, limited to listing-linked plain-text buyer/seller conversations.
- A small essential-notification list for operational marketplace events.
- No public follower counts, social feed, or reputation score in V1.

### Advertising

- Five-step creation flow:
  1. category and offer type;
  2. title, description, key facts, and price;
  3. location;
  4. photos and contact preferences;
  5. review and publish.
- Save draft and resume.
- Minimum one image for product listings; service listings may use a deliberate
  no-image presentation if the approved content policy allows it.
- No package selection, premium upsell, document upload, bidding, variants,
  bulk upload, or identity-verification gate.
- Clear moderation state: draft, pending review when required, published,
  paused, unavailable, rejected, or expired.

### Contact

- Primary in-platform action: **Message seller**. A registered buyer can open
  one listing-linked conversation with that listing's seller and exchange
  plain-text messages. The seller can reply in the same conversation.
- Additional direct actions: WhatsApp and Call when supplied, plus Email where
  the seller permits it. Guests may use these direct actions without creating
  an account.
- The inbox shows only the user's conversations, listing context, the other
  participant, last-message time, and an unread indicator. Participant-only
  authorization, plain-text validation, rate limits, blocking, reporting, and
  retention rules are required trusted-boundary controls.
- V1 messaging does not include attachments, image sharing, read receipts,
  typing indicators, online presence, reactions, voice messages, groups, AI,
  or automated moderation. It does not require a general social graph or a
  realtime presence service.
- Contact actions are logged as privacy-conscious aggregate events. Message
  content is stored only to deliver and operate the conversation; it must not
  be included in product analytics.

Minimal messaging remains in V1 because private, on-platform contact improves
buyer confidence, preserves listing context, and reduces immediate dependence
on an external channel. The value is high enough to justify the bounded
complexity, provided authorization, abuse reporting, rate limiting, and data
retention pass their acceptance tests. If those safety controls cannot be
demonstrated before launch, messaging must fail closed rather than ship in a
partially protected state; direct contact methods remain the fallback.

### Essential notifications

V1 includes a lightweight operational notification list for only these events:

- listing approved;
- listing rejected;
- listing expires soon;
- report resolved; and
- account suspended or restored.

Each notification contains a short title, useful explanation, timestamp,
read/unread state, and direct link to the relevant screen when one exists. A
small header/account indicator is sufficient. There is no complex notification
center, filtering, categories, sounds, presence, marketing, price-drop alerts,
or broad preference system. Message unread state remains inside Messages rather
than generating duplicate general notifications.

### Moderation and trust

- Email-confirmed accounts.
- Server-side ownership, account-status, input, upload, and rate-limit checks.
- Listing and user report action available from relevant screens.
- Conversation report and block actions available inside Messages, with manual
  administrator review rather than automated message moderation.
- Manual admin moderation with reasons and audit events.
- Safety guidance on listing details and before external contact.
- No identity, business, dealer, lawyer, or document verification badge in V1.
- Do not use “verified” copy for anything stronger than a specifically named
  fact such as “email confirmed”.

## 6. Explicitly outside V1

The following must not appear as live or “coming soon” primary navigation:

- payments, escrow, subscriptions, premium listings, pricing packages, payouts,
  and transaction history;
- identity, document, business, dealer, practitioner, or lawyer verification;
- lawyer profiles, legal directory, legal bookings, legal disputes, legal
  verification, legal dashboards, and legal administration;
- service booking and dispute workflows;
- AI moderation, AI agents, AI chat, extraction, or ban-evasion tools;
- messaging attachments, media, read receipts, typing indicators, presence,
  reactions, voice, groups, AI, and automated moderation;
- marketing notifications, price-drop alerts, complex notification preferences,
  and a general-purpose notification center;
- followers, ratings, reviews, and social reputation;
- bulk CSV/PDF/duplicate listing tools;
- agent directories and professional directories beyond lightweight business
  and vehicle-dealer profiles;
- map browsing, valuation, market insights, marketing email, announcements,
  and scheduled reminders;
- full support-ticket queues, attachments, templates, agent management, and
  email-template administration;
- separate analytics, revenue, payment, subscription, verification, legal,
  content, or support administration suites.

Source, data, and migration architecture for excluded functionality must be
preserved until the evidence and approval rules in Documents 1–4 permit
archive or deletion. Excluded functionality must be unreachable and fail
closed in the V1 product.

All lawyer and legal functionality belongs entirely to Future Versions. No
legal route, navigation item, dashboard, booking flow, dispute flow,
verification claim, administrator destination, background job, or public
profile may be live or visible in V1. Preserving dormant source or data during
migration is not permission to expose it.

## 7. Category model

V1 exposes four top-level choices:

| Category | Minimum useful filters | Core detail facts |
|---|---|---|
| Property | sale/rent, property type, location, price, bedrooms | type, beds, baths, size when known |
| Vehicles | make, model, condition, year, price | year, mileage, fuel, transmission, condition |
| Machinery | type, make, condition, year, price | type, make/model, year, condition, usage hours when known |
| Services | service category, location/service area, price model | category, service area, pricing note, provider contact |

Category vocabularies must be curated and short. Administrators receive only a
lightweight category-management surface: activate/deactivate, reorder, rename
display labels, and manage approved subcategories. Stable identifiers and
slugs do not change when a label changes; referenced categories cannot be
deleted. The four top-level categories remain protected. Users cannot create
free-form categories.

Business and dealer are profile presentations, not marketplace categories. A
dealer's inventory remains in Vehicles and uses the same listing schema and
search rules as every other vehicle listing.

## 8. Search principles

Search should become one of FindIt's defining strengths. A buyer should be
able to move from a vague intent to a credible shortlist quickly, especially
on a mobile connection. V1 search therefore includes:

- debounced autocomplete using curated categories, locations, and safe public
  listing terms, without AI-generated suggestions;
- recent searches stored on the user's device by default, with an obvious clear
  action and no sign-in requirement;
- excellent category-appropriate filtering with only filters that materially
  improve a decision;
- fast server-side query, filtering, sorting, counts, and pagination;
- deterministic ordering with a stable tie-breaker so pagination does not
  duplicate or skip results; and
- search within an individual dealer's public vehicle inventory.

- Query and filters are reflected in the URL and survive refresh/share/back.
- Filtering, sorting, and pagination happen in the repository/database, not
  over a fixed client-side first page.
- Default sort is newest; optional sorts are price low/high and relevance when
  a trustworthy relevance implementation exists.
- Result counts are accurate or explicitly described as approximate.
- Empty states explain which filters were applied and provide one-click reset.
- No result is promoted as premium in V1.
- Search must never expose draft, rejected, paused, expired, or private rows.

Saved searches, search alerts, personalized ranking, intelligent
recommendations, semantic search, and recommendation feeds are Future Version
enhancements. They must not complicate the V1 query model or create hidden
ranking behaviour.

## 9. Listing quality contract

Every published listing must have:

- a normalized category and status;
- a concise title and useful description;
- a positive price or an explicit “Contact for price” state;
- currency stored per listing, without a live conversion promise;
- city/area-level location without exposing a private residential address;
- seller-owned contact method;
- category-required fields;
- at least one clean image for product listings;
- created/updated timestamps; and
- a visible report action and safety guidance.

Phone numbers, URLs, HTML, file types, sizes, dimensions, and category values
must be validated at a trusted boundary. Browser validation exists for
feedback only.

## 10. Verification decision

Verification is **disabled and deferred for V1, then redesigned before it
returns**.

The existing flow accepts sensitive documents but has no independent storage,
malware scanning, fraud detection, reviewer operating model, appeals process,
retention policy, or defensible badge meaning. A manual document check can
create false confidence because forged or stolen documents may look plausible.
It also creates sensitive-data liability and a recurring founder workload.

V1 trust should come from transparent listing information, email confirmation,
optional contact confirmation once a reliable provider exists, clear account
age, safety education, reports, moderation, rate limits, and fast removal of
abuse. No document is collected for verification in V1.

Verification may return in stages:

1. confirmed email;
2. confirmed phone;
3. independently designed identity check through a specialist provider;
4. business/dealer credentials with expiry and appeal handling.

Each stage must state exactly what was checked, when it expires, who can see
the evidence, how fraud is escalated, and how a user appeals. A generic blue
“verified” badge is prohibited.

## 11. Role model

V1 has two application roles: `user` and `admin`.

- Guests are anonymous database/client actors, not stored application roles.
- Every active user may browse, save, advertise, and own services.
- Seller and service provider are ownership relationships.
- Business is a V1 profile type owned and managed by a normal user. It grants
  no privileged permissions.
- Dealer is a V1 specialization of the business profile with a vehicle-only
  inventory presentation and inventory search. It is not a separate role or
  duplicated account system.
- Agent and lawyer are Future Version concepts and have no V1 role, route, or
  capability.
- `super_admin` is not a visible product role. Any emergency bootstrap or
  destructive privilege is an audited operational procedure outside normal
  application navigation.

Detailed authorization is in `USER_ROLE_RECOMMENDATIONS.md`.

## 12. Minimum administration

V1 contains exactly six admin destinations:

1. Overview
2. Marketplace
3. Users
4. Reports
5. Categories
6. Audit Log

Marketplace combines product and service moderation. Overview shows only
actionable counts and health. Reports is the moderation inbox. Categories is a
small taxonomy tool because search and listing quality depend on a controlled
vocabulary, and a solo founder must be able to correct or deactivate a label
without deploying application code. It supports only approved subcategory
management, activation, display-label changes, and ordering; it has no content
management system, analytics, bulk import, or deletion of referenced
categories.

All privileged mutations require server authorization, explicit reasons for
punitive action, and durable audit. Business and dealer profiles use normal
marketplace moderation and do not receive separate admin suites. Detailed
scope is in `ADMIN_SIMPLIFICATION_PLAN.md`; where that supporting document
conflicts with this revision, this specification controls until the supporting
document is reconciled.

## 13. Navigation contract

### Desktop

- Logo/Home
- Browse/Search
- Services category shortcut
- Post a listing (primary action)
- Favourites when signed in
- Messages when signed in
- Essential-notification indicator when signed in
- Account menu: My Listings, Business Profile when owned, Profile & Settings,
  Help, Sign out
- Admin link only for admins

### Mobile bottom navigation

- Home
- Search
- Post
- Favourites
- Account

Services live inside Home/Search category browsing rather than consuming a
permanent mobile navigation slot. Messages and essential notifications are
available from the account/header without adding permanent bottom-navigation
slots. Business and dealer pages are reached through profiles and listings,
not a duplicate directory in primary navigation. Pricing, currency conversion,
agent navigation, and legal navigation are removed from V1 navigation.

## 14. Commercial model

V1 is free to browse, contact, and post within anti-abuse limits. The purpose
of V1 is to prove liquidity and trusted contact, not payment infrastructure.
Instrument only privacy-conscious marketplace metrics:

- published listings and active inventory by category/location;
- search-to-detail rate;
- detail-to-contact rate by contact method;
- listing completion and publish success;
- time to first contact;
- report rate and moderation resolution time;
- returning sellers and repeat listing activity.

Payments, promoted listings, subscriptions, dealer packages, and lead products
remain future commercial experiments. Their dormant code must not distort V1
UX or schema decisions.

Lightweight business and dealer profiles are free in V1. They create credible
marketplace supply, not a paid tier. Messaging metrics may count conversations
started and seller replies, but must not expose or analyze message content.

## 15. Quality requirements

- Every screen answers **“What does the user most likely want to do next?”**
  with one visually obvious primary action. Secondary actions remain available
  without competing for attention.
- Core routes meet WCAG 2.2 AA-oriented keyboard, focus, contrast, semantics,
  error-identification, and touch-target expectations.
- Mobile is the primary QA viewport; supported desktop layouts remain first
  class.
- Images use responsive derivatives, lazy loading below the fold, stable
  aspect-ratio placeholders, and meaningful alt text.
- Routes are lazy-loaded after error-boundary tests.
- Loading uses layout-matched skeletons; actions use local pending feedback.
- Every data screen has loading, empty, error, retry, offline, and permission
  states where relevant.
- Avoid decorative animation; respect reduced-motion preferences.
- No secret, service-role key, provider credential, or sensitive document is
  exposed to the browser.
- Messages and notifications have deliberate loading, empty, error, blocked,
  suspended-user, and permission-denied states; failures never reveal another
  user's data.

## 16. V1 acceptance criteria

Product approval requires all of the following in addition to Documents 1–4:

- only approved MVP routes and navigation are reachable;
- every non-MVP feature is disabled, unreachable, or explicitly archived
  under an approved data-preserving plan;
- the four marketplace categories can be browsed and searched completely;
- autocomplete, recent searches, filters, URL state, and stable server-side
  pagination work on the full public result set;
- a user can complete the full listing lifecycle and contact journey;
- business profiles show the approved lightweight fields and active listings;
- dealer pages reuse the business-profile architecture and provide vehicle
  inventory search without privileged dealer capabilities;
- listing-linked plain-text messaging passes participant isolation, input,
  rate-limit, block, report, retention, and negative authorization tests;
- only the five approved essential notification event types can be generated,
  and users cannot read or mutate another user's notifications;
- listing images pass storage ownership and hostile-file tests;
- favourites and reports pass owner/unrelated/admin authorization tests;
- the six admin destinations, including constrained Categories management,
  pass positive and negative role tests;
- no identity-verification claim or payment/AI action is visible;
- no lawyer or legal functionality is visible or reachable;
- the complete MVP screen, flow, responsive, accessibility, browser, security,
  backup/restore, monitoring, and deployment evidence is approved;
- all Critical and High findings that affect the V1 surface are closed.

## 17. Approval boundary

This specification is the authoritative V1 product scope. It changes product
scope, not the preservation and safety rules in Documents 1–4, and it does not
by itself authorize code deletion, data deletion, schema mutation, route
removal, or migration implementation. Those actions may begin only through the
approved migration plan and after production evidence decides the safe
additive, archival, or cutover strategy.
