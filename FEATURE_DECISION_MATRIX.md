# FindIt V1 Feature Decision Matrix

Status: **Approved V1 scope; implementation authorized through the migration plan**  
Basis: full repository, route, page, component, entity, function, migration,
feature-flag, and migration-record inventory dated 2026-07-17

## Decision rules

- **MVP** — required to deliver the V1 promise safely.
- **Deferred** — existing or partially implemented capability retained behind
  a fail-closed flag, but unavailable at launch.
- **Removed** — excluded from the V1 product surface. Source/data removal still
  requires the evidence and approval process in Documents 1–4.
- **Future Version** — valuable product expansion to design after launch data
  proves the need.

Complexity, operations, and maintenance use Low/Medium/High/Very High. Launch
priority uses P0 (launch blocker), P1 (important launch quality), P2 (after
launch), or P3 (speculative). Every row has exactly one product decision.

## Requested capability summary

| Capability | Decision | V1 interpretation |
|---|---|---|
| Authentication | MVP | Email/password confirmation, session, logout, and recovery; OAuth deferred. |
| Profiles | MVP | One basic account profile and simple public seller summary. |
| Listings | MVP | Property, vehicle, machinery, and simple service advertisements. |
| Categories | MVP | Four curated top-level categories with controlled subcategories. |
| Search | MVP | Defining capability: autocomplete, recent searches, complete server-side filtering, URL state, and stable pagination. |
| Filtering | MVP | Location, price, category, and essential category facts only. |
| Messaging | MVP | Minimal listing-linked, participant-only plain-text buyer/seller conversations; no rich or social features. |
| Notifications | MVP | Lightweight operational notifications for the five approved marketplace event types only. |
| Saved Listings | MVP | Consolidated into one Favourites feature for product listings. |
| Favorites | MVP | Same feature as Favourites/Saved Listings; no second concept. |
| Businesses | MVP | Lightweight public identity, contact details, optional links, and active listings; no enterprise tools. |
| Dealer Pages | MVP | Vehicle-inventory specialization of the Business Profile architecture; no separate role or premium suite. |
| Lawyer Pages | Future Version | Part of a separately approved legal-services product. |
| Support | MVP | Static Help/Safety plus Contact Support to one founder inbox; full ticketing deferred. |
| Admin Dashboard | MVP | Simplified Overview within the six-page admin, including constrained Categories management. |
| Analytics | Future Version | Only actionable overview counts and privacy-safe launch metrics in V1. |
| Reports | MVP | Listing/user/service reporting and manual admin resolution. |
| Payments | Deferred | V1 is contact-based; no checkout or funds handling. |
| Escrow | Deferred | Financial custody/dispute obligations are outside V1. |
| Premium Listings | Deferred | No paid promotion or discovery bias at launch. |
| Subscriptions | Deferred | No billing or entitlement system in V1. |
| Verification | Deferred | Disabled at launch and redesigned before return. |
| Identity Verification | Deferred | No sensitive identity-document collection or generic badge in V1. |
| Business Verification | Future Version | Returns only with organisation ownership and expiry/appeal operations. |
| Dealer Verification | Future Version | Returns with the future dealer product and precise credential claim. |
| Lawyer Verification | Future Version | Returns with the future legal product and professional-registry process. |
| AI | Deferred | No AI request or agent in V1; individual unsafe/unrouted agents are removal candidates. |
| Reviews | Future Version | Requires a defensible interaction/transaction proof and moderation model. |
| Ratings | Removed | Separate seller-rating system duplicates reviews and has no trusted proof. |
| Moderation | MVP | Manual reports, listing/service controls, user controls, and durable audit. |
| Uploads | MVP | Product/service images only; all documents and attachments deferred. |
| Storage | MVP | Independent validated image storage, metadata, derivatives, ownership, and cleanup. |
| Feature Flags | MVP | Fail closed across routes, navigation, APIs, jobs, and server operations. |

## Platform and accounts

| Feature | Decision | User value | Implementation | Operations / maintenance | Commercial importance / priority | Reason |
|---|---|---|---|---|---|---|
| Application shell, routing, error boundaries | MVP | Essential | High | Medium / Medium | Foundational / P0 | Every approved route depends on a dependable shell, lazy loading, route errors, and fail-closed access. |
| Public and account navigation | MVP | High | Medium | Low / Medium | Conversion / P0 | V1 needs one understandable path to browse, post, save, manage, and get help. Existing navigation is too broad and duplicated. |
| Admin navigation | MVP | High for operations | Medium | Low / Low | Trust / P0 | A six-destination admin shell is required: Overview, Marketplace, Users, Reports, Categories, and Audit Log. |
| Email/password registration | MVP | High | High | Medium / Medium | Supply growth / P0 | Required for users to advertise, save, report, and manage listings. |
| Email confirmation | MVP | High trust baseline | High | Medium / Medium | Abuse reduction / P0 | Confirms control of an address without claiming identity verification. Delivery and redirect behavior must be production-tested. |
| Email/password login/logout/session | MVP | Essential | High | Medium / Medium | Retention / P0 | Required account foundation; must include refresh, revocation, cross-tab, and blocked-account behavior. |
| Password recovery | MVP | Essential | High | Medium / Medium | Retention / P0 | A launchable account system needs safe, enumeration-resistant recovery and tested recovery-session semantics. |
| Google OAuth | Deferred | Medium | Medium | Medium / Medium | Conversion / P2 | Helpful, but provider configuration, account linking, recovery, and support add launch risk. Enable after core auth is stable. |
| Apple OAuth | Future Version | Low initially | Medium | Medium / Medium | Limited early impact / P3 | Current audience evidence does not justify another provider at launch. Add with measured device demand. |
| Blocked/suspended account enforcement | MVP | High trust | High | Medium / High | Safety / P0 | Browser-only blocking is insufficient; database and trusted-server denial are mandatory. |
| Basic user profile | MVP | High | Medium | Low / Medium | Trust and contact / P0 | Keep name, phone, contact preferences, account age, and security actions. Avoid profile bloat. |
| Avatar upload | Future Version | Low | Medium | Medium / Medium | Low / P3 | Initials and seller name are adequate; image moderation and storage cost are not justified for launch. |
| Phone verification OTP | Deferred | Medium | High | High / High | Trust / P2 | Provider cost, delivery reliability, abuse limits, country formatting, and recovery require an operating model. Do not block posting in V1. |
| Currency conversion/picker | Removed | Low and potentially misleading | Medium | High / High | Low / P3 | Store/display the seller's chosen currency. Live conversion creates accuracy, rate-provider, and comparison promises unnecessary for V1. |
| Dark mode | Deferred | Low | Low | Medium / Medium | Low / P3 | Preserve support in source, but one polished light theme reduces visual and accessibility QA at launch. |
| Feature flags | MVP | Operationally essential | Medium | Low / Medium | Risk control / P0 | Non-MVP capabilities must fail closed across routes, navigation, APIs, jobs, and server mutations. |
| Environment validation | MVP | Indirect but essential | Low | Low / Low | Reliability / P0 | Invalid or insecure configuration must stop build/start rather than fail unpredictably. |
| Shared error, loading, empty, retry, and offline states | MVP | High | Medium | Low / Medium | Trust / P0 | Marketplace confidence falls quickly when screens spin forever or fail silently. |

## Marketplace discovery

| Feature | Decision | User value | Implementation | Operations / maintenance | Commercial importance / priority | Reason |
|---|---|---|---|---|---|---|
| Home/landing marketplace | MVP | High | Medium | Low / Medium | Acquisition / P0 | Search, four categories, and recent quality inventory communicate the product immediately. Remove repeated “hot/new/latest” sections. |
| Categories | MVP | High | Medium | Low / Medium | Core discovery / P0 | Property, Vehicles, Machinery, and Services are the V1 product. Category pages are filtered search states, not duplicate implementations. |
| Unified search | MVP | Very High | High | Medium / High | Marketplace liquidity / P0 | Search is a defining strength. It must query the full dataset server-side and include safe autocomplete and private on-device recent searches. |
| Filtering and sorting | MVP | Very High | High | Medium / High | Conversion / P0 | Keep location, price, category, and a few category facts. Persist state in the URL and use deterministic stable pagination. |
| Property marketplace | MVP | Very High | High | Medium / High | Core supply / P0 | Existing mature vertical and a primary Zimbabwe need; retain sale/rent and essential property facts. |
| Vehicle marketplace | MVP | Very High | High | Medium / High | Core supply / P0 | Existing mature vertical; keep essential make/model/year/condition facts without over-filtering. |
| Machinery marketplace | MVP | High | High | Medium / High | Differentiating supply / P0 | Valuable niche already represented in the product; same listing lifecycle keeps incremental operating cost controlled. |
| Professional services discovery | MVP | High | High | Medium / High | Mission-critical / P0 | The product context explicitly includes services. V1 supports simple advertise/browse/contact only, not booking or disputes. |
| Map browsing | Future Version | Medium | High | High / High | P2 expansion | Requires geocoding accuracy, privacy rules, map quotas, clustering, and mobile performance. List search is sufficient for launch. |
| Market insights | Removed | Unproven | High | High / High | Low / P3 | Current data volume and analytics accuracy cannot support authoritative trends. It distracts from discovery. |
| Valuation tool | Removed | Attractive but untrustworthy | Very High | High / High | Low without data / P3 | A reliable valuation needs representative local datasets, methodology, monitoring, and liability language absent today. |
| Dealer page | MVP | High | Medium | Low / Medium | Vehicle supply trust / P0 | Reuse Business Profile architecture for dealer information, contact details, vehicle inventory, and search within inventory. No directory, verification, premium tools, or separate dashboard. |
| Agent directory | Removed | Low and overlapping | Medium | High / Medium | Low / P3 | “Agent” is ambiguous and duplicates seller/business discovery. Reconsider only with a defined market segment. |
| Business profiles | MVP | High | Medium | Low / Medium | Supply credibility / P0 | Keep a lightweight public identity with name, logo, description, contacts, appropriate address, optional website/social links, and active listings. No directory or enterprise suite. |
| Lawyer directory and legal pages | Future Version | Niche high value | Very High | Very High / Very High | Later vertical / P3 | Credentials, malpractice expectations, bookings, payments, disputes, and sensitive documents demand a separate product launch. |
| Pricing/packages page | Removed | No V1 value | Medium | High / Medium | Monetization later / P3 | V1 has no paid plan. A pricing page would advertise unavailable functionality and reduce trust. |

## Listing and service supply

| Feature | Decision | User value | Implementation | Operations / maintenance | Commercial importance / priority | Reason |
|---|---|---|---|---|---|---|
| Create product listing | MVP | Very High | High | Medium / High | Supply / P0 | Core seller action. Reduce nine steps to five and remove package/document/verification complexity. |
| Create service listing | MVP | High | High | Medium / High | Supply / P0 | Supports the product promise using the same ownership/contact model without booking. |
| Draft, preview, and publish | MVP | High | High | Low / Medium | Completion / P0 | Draft recovery and preview reduce abandonment and errors. Publish must be idempotent. |
| Edit, pause, mark unavailable, renew, delete | MVP | Very High | High | Medium / High | Inventory quality / P0 | Sellers must maintain accurate supply. Every state transition needs ownership and audit rules. |
| My Listings/My Services | MVP | High | Medium | Low / Medium | Seller retention / P0 | Merge products and services into one management surface with clear status and actions. |
| Listing photos | MVP | Very High | Very High | High / High | Conversion and trust / P0 | Essential, but only after independent storage, server validation, ownership, derivatives, quotas, and cleanup exist. |
| Listing document uploads | Deferred | Low at launch | Very High | Very High / Very High | Trust experiment / P3 | Sensitive/private documents create fraud, access, scanning, retention, and reviewer obligations. Remove the creation step in V1. |
| Package selection/premium upsell | Deferred | None while free | High | High / High | Future revenue / P2 | Preserve behind flags; the V1 creation flow has one free path. |
| Listing variants and bidding | Removed | Low for core classifieds | High | High / High | Low / P3 | They complicate price meaning, search, moderation, and creation. One listing represents one offer in V1. |
| Bulk CSV import | Future Version | High for power sellers | Very High | High / High | Dealer growth / P2 | Add after normal listing quality, idempotent import, validation, error correction, and dealer model are proven. |
| Bulk PDF extraction | Deferred | Medium | Very High | Very High / Very High | Low initially / P3 | Depends on private uploads and extraction/AI; keep disabled. |
| Duplicate listing tool | Future Version | Medium | Medium | Medium / Medium | Seller efficiency / P2 | Useful after abuse controls prevent repetitive spam and stale duplicate inventory. |
| Listing expiry jobs | MVP | High indirect value | Medium | Medium / Medium | Inventory quality / P1 | Stale listings damage trust. Use a simple configurable expiry and seller renewal flow. |
| Location reference data | MVP | High | Medium | Low / Medium | Discovery / P0 | Zimbabwe city/area selection must be curated and searchable; avoid unnecessary admin taxonomy tools. |
| Exact map pin/address | Removed | Privacy risk | High | High / High | Low / P3 | V1 shows approximate area. Exact residential coordinates create safety and geocoding complexity. |

## Contact, engagement, and trust

| Feature | Decision | User value | Implementation | Operations / maintenance | Commercial importance / priority | Reason |
|---|---|---|---|---|---|---|
| Call seller | MVP | Very High | Low | Low / Low | Contact conversion / P0 | Direct, familiar, and low operational burden. Respect seller contact preference. |
| WhatsApp seller | MVP | Very High | Low | Low / Low | Zimbabwe conversion / P0 | Likely the fastest contact path; use a safe prefilled message without claiming an on-platform transaction. |
| Email seller | MVP | Medium | Medium | Medium / Medium | Contact fallback / P1 | Offer only when permitted; guard against scraping and abuse. |
| In-app inquiries/messaging | MVP | High | High | Medium / High | Contact confidence / P0 | Keep one listing-linked buyer/seller conversation with plain text, participant RLS, rate limits, block/report, retention, and inbox unread state. No realtime presence is required. |
| Messaging attachments | Deferred | Medium | Very High | Very High / Very High | Low initially / P3 | Images, files, voice, and other rich media remain off; V1 messaging is plain text only. |
| Favourites/Saved Listings | MVP | High | Medium | Low / Medium | Return visits / P1 | Keep one table, one term, one route, and one action. “Saved” and “Favourites” must not be separate concepts. |
| Follows | Future Version | Low initially | Medium | High / Medium | Engagement later / P3 | Adds social graph and notification expectations without improving the core contact journey. |
| Reviews | Future Version | Medium | Very High | Very High / High | Trust later / P2 | Without a verified transaction/interaction, reviews are easy to manipulate and expensive to moderate. |
| Seller ratings | Removed | Low as separate system | High | Very High / High | Low / P3 | Duplicates reviews and creates conflicting scores. If reviews return, derive one transparent reputation model. |
| Alerts and price-drop notifications | Deferred | Medium | High | High / High | Retention later / P2 | Needs saved-search/listing events, delivery rules, preferences, realtime/jobs, and opt-out operations. |
| Essential notification list | MVP | High | Medium | Low / Medium | Marketplace clarity / P0 | One lightweight list covers listing approved/rejected/expiring, report resolved, and account suspended/restored, with read state and relevant links. |
| Email/SMS marketplace notifications | Deferred | Medium | High | High / High | Retention later / P2 | Marketing, reminders, campaigns, and preference-heavy delivery wait; V1 keeps only essential operational product notices. |
| User/listing reporting | MVP | High | High | Medium / High | Safety / P0 | A direct report path and admin queue are the minimum viable moderation loop. |
| Manual moderation | MVP | Very High | High | High / High | Trust / P0 | Founder-operable listing/user/report controls are mandatory. Use reasons, status history, and durable audit. |
| Identity verification | Deferred | Potentially high | Very High | Very High / Very High | Trust later / P3 | Disable collection and badges. Redesign with a specialist provider, fraud model, retention, appeals, expiry, and precise claims. |
| Business/dealer verification | Future Version | Medium | Very High | Very High / Very High | B2B revenue later / P3 | Requires organisation ownership, current registry evidence, expiry, reviewer training, and appeal handling. |
| Lawyer verification | Future Version | High for legal vertical | Very High | Very High / Very High | Later vertical / P3 | Must be designed alongside the legal product and relevant professional registry processes. |
| Phone-confirmed badge | Deferred | Medium | High | High / High | Trust / P2 | Only return after provider and abuse/recovery behavior are reliable. Badge copy must state “phone confirmed,” not “verified seller.” |
| Safety guidance | MVP | High | Low | Low / Low | Trust / P0 | Detail and contact surfaces should warn against deposits, unsafe meetings, and off-platform fraud without overwhelming the buyer. |

## Support and content

| Feature | Decision | User value | Implementation | Operations / maintenance | Commercial importance / priority | Reason |
|---|---|---|---|---|---|---|
| Help/FAQ/safety pages | MVP | High | Low | Low / Low | Trust / P1 | A small curated static help centre answers common questions without a CMS. |
| Contact support form/email | MVP | High | Medium | Medium / Medium | Retention and safety / P1 | Send a structured request to one monitored founder inbox with reference ID and rate limits. No customer ticket portal. |
| Full support ticket lifecycle | Deferred | Medium | Very High | Very High / Very High | Scale later / P3 | Queue, assignment, chat, attachments, templates, status emails, agents, and settings exceed solo-founder V1 needs. |
| Support attachments | Deferred | Low | Very High | Very High / Very High | Low / P3 | Current UI discards selected files. Do not collect them until private storage and retention are defined. |
| Support agents/teams/settings | Removed | No V1 value | High | High / High | Low / P3 | The founder inbox and admin role are sufficient at launch. |
| FAQ administration | Removed | Low | Medium | Medium / Medium | Low / P3 | Keep V1 FAQs version-controlled; two duplicate admin implementations are unnecessary. |
| Announcements | Future Version | Low | Medium | Medium / Medium | Engagement later / P3 | Use deploy-time/static notices initially. Add targeted announcements only when an audience and policy exist. |
| Email template administration | Removed | Low | High | High / High | Low / P3 | Transactional templates belong in provider-controlled, reviewed configuration, not a broad browser editor at launch. |
| Marketing emails | Deferred | Low initially | High | Very High / High | Growth later / P3 | Requires consent, unsubscribe, segmentation, deliverability, privacy, and suppression operations. |
| Scheduled reminders | Deferred | Medium | High | High / High | Retention later / P3 | Needs event semantics, preferences, reliable jobs, provider configuration, retries, and observability. |

## Payments, legal, and automation

| Feature | Decision | User value | Implementation | Operations / maintenance | Commercial importance / priority | Reason |
|---|---|---|---|---|---|---|
| Payments/checkout | Deferred | Future convenience | Very High | Very High / Very High | Future revenue / P3 | V1 is a contact marketplace. Gateway, webhook, refund, fraud, reconciliation, and compliance work are not launch-critical. |
| Escrow | Deferred | Potential trust | Very High | Very High / Very High | Future differentiation / P3 | Holding/releasing money and disputes create legal, financial, security, reconciliation, and support obligations. |
| Premium listings | Deferred | Seller promotion | High | High / High | Future revenue / P2 | Do not bias discovery before baseline marketplace quality and payment operations exist. |
| Subscriptions | Deferred | Dealer monetization | Very High | Very High / Very High | Future revenue / P3 | Requires entitlements, billing lifecycle, cancellation, tax, reconciliation, and support. |
| Transaction history | Removed | None without payments | Medium | High / Medium | Low / P3 | A live route for dormant transactions is confusing and should not exist in V1. |
| Practitioner payouts/earnings | Deferred | Legal-provider value | Very High | Very High / Very High | Later vertical / P3 | Depends on legal bookings and payments, both outside V1. |
| Service bookings and disputes | Future Version | Medium | Very High | Very High / Very High | Potential service revenue / P3 | V1 allows contact only. Add booking after service discovery and provider supply are proven. |
| Legal bookings/disputes/portal | Future Version | Niche | Very High | Very High / Very High | Later vertical / P3 | Requires a dedicated product, verification, payment, dispute, privacy, and operational model. |
| AI content moderation | Deferred | Operational aid | Very High | High / Very High | Cost reduction later / P3 | Manual rules/moderation launch first. AI needs accuracy, appeal, privacy, cost, and human-review controls. |
| AI ban-evasion detection | Deferred | Safety aid | Very High | Very High / Very High | Safety later / P3 | High false-positive and privacy risk; use deterministic controls initially. |
| AI ticket triage | Deferred | Low without ticket system | High | High / High | Low / P3 | Full support ticketing is outside V1. |
| AI support agents/chat | Removed | Low and trust-risking | Very High | Very High / Very High | Low / P3 | Unrouted hosted agents add cost, hallucination, disclosure, privacy, and escalation obligations. |
| AI/document extraction | Deferred | Power-user efficiency | Very High | Very High / Very High | Low / P3 | Depends on sensitive storage and bulk/verification features excluded from V1. |

## Administration

| Feature | Decision | User value | Implementation | Operations / maintenance | Commercial importance / priority | Reason |
|---|---|---|---|---|---|---|
| Admin overview | MVP | High operational value | Medium | Low / Medium | Trust / P0 | Show actionable counts, platform health, and recent moderation activity only. |
| Listing/service moderation | MVP | Very High | High | High / High | Trust / P0 | Search, inspect, hide/restore/reject, and record a reason with audit. |
| User administration | MVP | Very High | High | High / High | Safety / P0 | Search, inspect, suspend/ban/unban with reason and expiry; ordinary admin cannot silently create higher privilege. |
| Report queue | MVP | Very High | High | High / High | Safety / P0 | Connect user reports to listing/user decisions with status, assignee if needed later, and audit. |
| Audit log | MVP | High | High | Medium / High | Accountability / P0 | Privileged actions must be durable and filterable; writes must not fail open. |
| Category management | MVP | High operational value | Medium | Low / Medium | Search quality / P0 | A constrained admin surface can activate, reorder, relabel, and manage approved subcategories without changing stable IDs or deleting referenced categories. |
| Separate analytics page | Future Version | Medium | High | High / High | Decision support / P2 | Start with a few overview metrics and external privacy-safe product analytics. Build a page after questions are known. |
| Verification administration | Deferred | None while disabled | Very High | Very High / Very High | Future trust / P3 | Hide while document verification is disabled; redesign with the future verification system. |
| Payment/subscription administration | Deferred | None while disabled | Very High | Very High / Very High | Future revenue / P3 | Keep inaccessible until providers, ledgers, reconciliation, refunds, and entitlements exist. |
| Legal administration | Future Version | None for V1 | Very High | Very High / Very High | Later vertical / P3 | Ships only with the legal product. |
| Support dashboard/queue/agents/settings | Removed | No V1 value | Very High | Very High / Very High | Low / P3 | Use one monitored support inbox; current pages are overlapping and operationally excessive. |
| Neighbourhood administration | Removed | Low | Medium | Medium / Medium | Low / P3 | V1 location data is curated through controlled configuration/migrations, not a founder-facing CRUD suite. |
| FAQ managers | Removed | Low | Medium | Medium / Medium | Low / P3 | Two overlapping admin screens are unnecessary; V1 help content is version-controlled. |
| Announcements administration | Future Version | Low | Medium | Medium / Medium | Engagement later / P3 | Not needed until targeted product communication is justified. |
| Email template editor | Removed | Low | High | High / High | Low / P3 | Keep transactional templates narrowly controlled at the provider/configuration boundary. |

## Experimental and duplicate surfaces

| Feature | Decision | User value | Implementation | Operations / maintenance | Commercial importance / priority | Reason |
|---|---|---|---|---|---|---|
| Duplicate public support pages | Removed | None | Low | Medium / Medium | None / P3 | `Support`, `SupportCenter`, `SupportTickets`, and `TicketDetail` overlap the active support family and should not enter V1. |
| Duplicate admin support pages | Removed | None | Low | Medium / Medium | None / P3 | `AdminSupport` and `AdminTicketDetail` duplicate the active admin support family, which is itself outside V1. |
| Alternate practitioner/business dashboards | Removed | None for V1 | Medium | High / High | None / P3 | They belong to future legal/business products and should not create hidden V1 routes. |
| Decorative reveal/gradient animation | Removed | Low | Low | Medium / Medium | None / P3 | It adds generic visual noise and reduced-motion QA without improving marketplace comprehension. |

## Summary

The MVP invests deeply in the browse → detail → contact and register → post →
manage loops. It keeps direct contact, bounded plain-text messaging,
lightweight business/dealer identity, essential notifications, manual
moderation, and one founder support channel while excluding the expensive
rich-realtime, financial, verification, social, and enterprise systems
currently present in the repository.
