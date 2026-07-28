# FindIt V1 UI Improvement Plan

Status: **Approved prioritized plan; implementation in progress**

## Prioritization method

- **P0** — required for a correct, safe, understandable MVP.
- **P1** — required for launch-quality trust, accessibility, performance, and
  polish after the P0 structure is stable.
- **P2** — post-launch improvement supported by observed usage.

No item is approved merely because it is visually attractive. Priority follows
user outcome, correctness, trust, operational burden, and migration dependency.

## P0 — freeze and simplify the product surface

### 1. Approve the route and feature boundary

Adopt the Feature Decision Matrix and Screen Specifications. Produce a single
route manifest for the approved marketplace, account, help, and six admin
destinations. Record every excluded route as Deferred, Removed from V1, or
Future with its source/data preservation status.

Acceptance: no unclassified route/page/nav item; stakeholders approve the
surface before source changes.

### 2. Establish fail-closed scope controls

Design route, navigation, API, job, and server-side enforcement for excluded
payments, verification, rich messaging, non-essential notifications, legal,
AI, bulk, support ticket, and premium features. A hidden link is not a feature
flag. Excluded feature code must not perform imports, polling, subscriptions,
or mutations in the production runtime.

Acceptance: direct URL/API/job/network tests prove excluded functionality is
unreachable and inactive.

### 3. Standardize navigation and account hierarchy

Implement one marketplace navigation source and one admin navigation source.
Desktop: Browse, Services, Post, Favourites, Messages, essential notifications,
Account. Mobile: Home, Search, Post, Favourites, Account, with Messages and
notifications reached from the header/account. Merge Profile/Settings into Account and My
Listings/My Services into one owner inventory.

Acceptance: labels and active states are identical across viewports; keyboard,
screen reader, direct route, sign-in return, and role visibility tests pass.

## P0 — correct the marketplace core

### 4. Rebuild search at the repository boundary

Move query, autocomplete, filters, sort, deterministic pagination, publication
status, and counts to validated server/database queries. Persist approved state
in the URL, add private on-device recent searches, and remove
first-100 client filtering and business-profile fetches used only to decorate
seller type.

Acceptance: fixtures beyond 100 records, boundary prices/dates, location,
category facts, pagination stability, private-state denial, URL/back/share, and
query-plan tests pass.

### 5. Simplify Home

Keep one search hero, four categories, one recent-inventory section, safety
guidance, and footer. Remove repeated Hot/New/Latest data sections and reveal
animation. Use real inventory or an honest empty state.

Acceptance: first viewport communicates what/where/how to post; Home remains
usable if inventory query fails; no duplicate listing sections.

### 6. Standardize cards, grids, and pricing

Create one product card contract and one service card variation. Standardize
image ratio, title, price meaning, location, facts, favourite, loading/error,
and status. Remove generic verified, premium, view-count, gradient, and emoji
clutter.

Acceptance: category screenshot/interaction matrix passes at target widths;
cards have accessible names, stable layout, and correct price semantics.

### 7. Standardize detail and contact

Use a shared detail shell with typed facts, gallery, seller summary, safety,
report, Message seller, and direct contact. Add mobile sticky contact without covering content.
Replace email-based seller URLs with opaque IDs.

Acceptance: call/WhatsApp/email preference, own listing, missing contact,
unavailable listing, report, gallery keyboard/swipe, and responsive cases pass.

### 8. Reduce listing/service creation to five steps

Use shared schemas and fields for creation/editing. Remove package, documents,
variants, bidding, exact pin, and phone OTP. Provide reliable server-backed
draft/idempotent publish and secure media progress/retry.

Acceptance: every category completes successfully on phone/desktop; validation
focuses fields; reload/back/network/upload/publish retry preserves work; no
excluded field or call is emitted.

### 9. Consolidate owner inventory and editing

One paginated view manages product and service inventory. Use clear status
filters and protected transitions. Reuse creation components for full editing;
do not limit edit to contact fields.

Acceptance: owner/unrelated/admin, draft/published/paused/unavailable/expired,
concurrent edit, destructive confirmation, and audit tests pass.

### 10. Correct Favourites

Use one term/icon/route and a joined, paginated owner query. Implement
optimistic save/remove with rollback. Handle unavailable saved targets
deliberately.

Acceptance: guest return, duplicate prevention, unrelated-user denial, removed
target, offline/failure rollback, and multi-device consistency pass.

### 10A. Implement lightweight Business Profiles and Dealer Pages

Reuse one owner-managed public profile contract for business name, logo,
description, contacts, appropriate address, optional validated website/social
links, and active listings. Dealer is a vehicle-inventory presentation with
search within inventory, not a role or separate dashboard.

Acceptance: public/owner/unrelated/admin authorization, URL/link validation,
logo ownership, inactive inventory, dealer vehicle filtering, mobile states,
and absence of verification/subscription/analytics/staff/premium/payment tools
pass.

### 10B. Implement minimal listing messaging

Provide one participant-only buyer/listing conversation and plain-text thread,
with inbox context, unread indicator, rate limits, block/report, retention, and
account-status checks. Do not add attachments, media, receipts, typing,
presence, reactions, voice, groups, AI, or automated moderation.

Acceptance: participant/unrelated/suspended/admin matrix, spoofed sender,
listing ownership, duplicate conversation, length/rate, block, report,
retention, empty/error/offline, and message-content analytics denial pass.

### 10C. Implement essential operational notifications

Use one lightweight owner-only list for listing approved/rejected/expiring,
report resolved, and account suspended/restored. Creation is trusted-only;
each notice has explanation, time, read state, and safe relevant link.

Acceptance: event allowlist, owner isolation, trusted-only create, read/update,
safe-link, duplicate/idempotency, expiry, and absence of marketing/price/social
or duplicate message notices pass.

## P0 — trust, safety, and operations

### 11. Implement independent listing-image UX

Design direct upload through trusted authorization with type/size/dimension/
quota/signature checks, scan/quarantine where required, generated keys,
derivatives, ordering, retry, replacement, orphan cleanup, and clear errors.
V1 accepts only product/service images and business logos.

Acceptance: hostile file, MIME spoof, oversized/decompression image,
owner/unrelated, unpublished/published, replacement, deletion, signed/public
delivery, retry, and reconciliation pass.

### 12. Remove verification claims and collection from V1

Hide all verification routes, document steps, badges, admin queues, and API
calls. Replace badges with explicit facts only when proven. Preserve data/source
under the approved migration plan.

Acceptance: route/nav/bundle/network/data tests show no V1 verification flow or
generic verification claim.

### 13. Implement lightweight Help and Support

Transform SupportHub/FAQs/CreateTicket concepts into Help and Contact Support.
Remove attachment, chat, ticket list/detail, support team, templates, settings,
and AI. Route structured requests to a monitored inbox with limits and honest
response expectations.

Acceptance: form delivery/failure/rate/abuse/privacy/reference tests pass; no
ticket portal or discarded attachment picker remains.

### 14. Simplify and secure admin

Implement Overview, Marketplace, Users, Reports, Categories, Audit Log only. Server-page
all data; use protected reasoned mutations and durable audit. Remove generic
service-role browser paths.

Acceptance: anonymous/user/suspended/admin role matrix, stale state,
idempotency, audit failure, pagination/reconciliation, and accessibility pass.

## P0 — foundation quality

### 15. Establish the design tokens and semantic primitives

Implement the approved typography, spacing, colour, radius, elevation, button,
form, card, badge, icon, table, dialog, and alert system. Audit hardcoded
exceptions. Choose one toast system.

Acceptance: component-level accessibility and visual examples exist; no random
gradient/glass/radius/colour pattern remains on MVP screens.

### 16. Standardize all states

Every MVP query/mutation receives layout-matched loading, empty,
filtered-empty, error, retry, offline, permission, and success behavior. Remove
indefinite spinners, raw provider messages, silent catch, and toast-only durable
errors.

Acceptance: forced-state test matrix and screen-reader announcements pass on
every MVP screen.

### 17. Complete accessibility remediation

Fix landmarks/headings, labels/descriptions/errors, icon names, focus,
dialog/menu behavior, contrast, touch size, zoom/reflow, gallery/filter/wizard
keyboard use, and reduced motion.

Acceptance: automated checks plus manual keyboard, NVDA and VoiceOver spot
checks on every major journey; no Critical/Serious issue and approved Medium
exceptions documented.

### 18. Make mobile a release gate

Test representative small/large phones and tablet for navigation, filters,
forms, uploads, gallery, contact bar, keyboard, orientation, safe area, long
content, slow network, and browser UI interaction.

Acceptance: no blocked action, covered input/button, horizontal overflow, tiny
target, or lost draft at approved viewports/devices.

## P1 — performance and polish

### 19. Route-level loading and bundle reduction

Lazy-load page groups with route error boundaries, preload only probable next
routes, and remove excluded feature imports from the production graph. Measure
bundle by route rather than chasing arbitrary percentage reduction.

Acceptance: route navigation/error/offline tests and an approved initial/route
bundle budget pass.

### 20. Progressive media delivery

Use responsive derivatives, dimensions/aspect ratio, lazy loading below fold,
priority only for the leading image, safe fallback, and CDN cache/version rules.

Acceptance: no layout shift from known images; card/detail payload budgets and
slow-network visual tests pass.

### 21. Improve perceived navigation speed

Retain TanStack Query caching with domain keys, prefetch likely detail only on
intent where affordable, preserve search state/scroll, and use local optimistic
updates for favourites and safe status actions with rollback.

Acceptance: repeat/back transitions feel immediate without stale authorization
or incorrect states.

### 22. Content and trust copy review

Rewrite labels, errors, safety, contact, moderation, empty, and unavailable copy
in concise Zimbabwean English. Remove hype, generic verification, misleading
attachment/payment/response claims, and emoji status.

Acceptance: product/legal/support review and screen content inventory approve
all MVP text.

### 23. Browser and visual regression coverage

Capture approved reference states and run representative Chromium, Firefox,
and WebKit checks. Visual diffs protect shell, cards, detail, wizard, account,
help, and admin.

Acceptance: responsive/browser matrix passes with documented low-risk
differences only.

## P2 — evidence-led improvements

- Improve category taxonomy from search/no-result and moderation data.
- Add service favourites only if usage supports it.
- Add Google OAuth if sign-up friction and provider demand justify it.
- Add saved searches/alerts only with preference and delivery operations.
- Add multi-user organizations, dealer premium tools, analytics, financing, or
  staff capabilities only after supply and commercial research.
- Add route/map/analytics/ratings/booking capabilities only through separate
  approved future specifications.

## Recommended implementation order

1. Approve product documents and production-data evidence.
2. Route/feature boundary and test harness.
3. Design primitives/navigation/states.
4. Auth/account.
5. Search/home/cards/detail/contact.
6. Listing/service create/manage/storage.
7. Business/dealer profiles, minimal messaging, and essential notifications.
8. Favourites/reports/help.
9. Admin/categories/audit.
10. Accessibility/mobile/performance/browser/deployment acceptance.

This order follows usable vertical slices and trusted boundaries. The founder
authorized bounded implementation on 2026-07-17. Production cutover and any
destructive/data/provider action remain subject to `MIGRATION_SCOPE_UPDATE.md`
and Documents 1–4 evidence gates.
