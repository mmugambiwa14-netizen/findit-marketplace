# FindIt Behaviour Baseline

Date: 2026-07-17  
Source: authoritative Phase 2B archive

This is a source-derived baseline. It records observable intent and known
failure behavior without claiming that production behaves identically. No
configured tenant, production data, provider account, or staging deployment
was available. Items marked unknown require observation before replacement.

> **Current-state evidence — 2026-07-18:** local Auth API checks cover signup,
> confirmation delivery/link, login, session lookup, logout, recovery delivery,
> and profile-trigger creation. Public Home/Search and Property/Car/Machinery
> details now use Supabase repositories/services. Search performs database-side
> filtering, exact counts and stable 24-row pagination with URL state; clean
> Chromium verifies filter defaults, debounce, empty/out-of-range correction,
> and a missing-detail state without Base44 SDK errors. Favourites and listing
> reports use owner/reporter-scoped Supabase adapters and existing RLS, but have
> no authenticated fixture-browser acceptance yet. At that checkpoint the local
> listing database was empty. A later disposable 130-listing API smoke now
> proves exact six-page traversal, discovery beyond row 100 and server-side
> detail/price filters; fixture-browser, production query-plan/load and
> production contract parity remain explicit unverified cases.

## 1. Registration and email confirmation

- Entry/route/page: `/register`, `Register.jsx`.
- Components/services/entities: form UI, `authService.signUp`,
  `resendSignupConfirmation`, Supabase Auth, auth-user profile trigger in
  migrations `0002`/`0012`.
- Permissions/users: guest/new user.
- Input: email, password, password confirmation, phone; OAuth provider as an
  alternate path.
- Expected output: create an auth identity, store normalized phone in auth
  metadata/profile, show "check your email", allow confirmation resend.
- Success path: validation passes -> Supabase signup -> confirmation UI ->
  emailed link returns to the allowed application URL -> session/profile load.
- Failure path: validation/API error remains on form with readable feedback;
  resend failure is shown and must not create another profile.
- Edge cases: duplicate email, weak password, invalid/international phone,
  confirmation disabled, expired/used link, delayed/missing email, provider
  already linked, trigger/profile failure, rate limits.
- Rules/side effects: this intentionally replaces the old custom six-digit
  signup OTP with Supabase link confirmation. `phone_verified` remains false.
- Current uncertainty: provider settings, templates, redirects, delivery,
  trigger application, and hybrid Base44 access have not been tested.

## 2. Email/password and OAuth login

- Entry/route/page: `/login`, `Login.jsx`.
- Components/services/entities: `authService.signInWithPassword`,
  `signInWithOAuth`, `AuthContext`, Supabase Auth and `public.users`.
- Permissions/users: guest/existing user; admin redirect depends on role.
- Input: email/password or Google/Apple provider.
- Expected output: establish session/profile and navigate to `/admin` for an
  admin, otherwise `/`.
- Success path: Auth succeeds -> profile row loads -> account status checked ->
  context authenticated -> role-based redirect.
- Failure path: authentication/profile errors show login feedback or currently
  collapse to guest state; suspended/banned profile renders blocked UI.
- Edge cases: missing profile, stale/deleted account, refresh token, multiple
  tabs, OAuth cancellation, provider disabled, duplicate provider email,
  unconfirmed email, offline database.
- Rules/side effects: no service-role key in browser; UI role is not a security
  boundary.
- Current uncertainty: Supabase login does not create the Base44 token still
  required by many post-login operations and admin role verification.

## 3. Session restore and logout

- Entry: application mount/auth-state event; sidebar and account logout actions.
- Components/services: `AuthContext`, `authService.getCurrentUser`,
  `onAuthStateChange`, `signOut`, admin sidebars.
- Permissions/users: current user.
- Input: persisted Supabase session, token-refresh/sign-out event, logout click.
- Expected output: restore session/profile on refresh; keep blocked users out of
  UI; logout clears session/context and redirects when requested.
- Success path: valid session -> user row -> authenticated state; signout ->
  state cleared -> protected route redirects.
- Failure path: current implementation logs an error and treats profile/network
  failure as guest; signout error is logged.
- Edge cases: cross-tab signout, refresh during profile request, token expiry,
  deleted profile, clock skew, blocked status/ban expiry.
- Current uncertainty: live persistence/event ordering and Base44 session
  continuity are unverified; blocked accounts retain a valid Supabase session.

## 4. Password recovery

- Entry/routes/pages: `/forgot-password`, `/reset-password`;
  `ForgotPassword.jsx`, `ResetPassword.jsx`.
- Services: `resetPasswordForEmail`, `getSession`, auth-state subscription,
  `updatePassword`.
- Permissions/users: guest requesting recovery; user holding recovery session.
- Input: email, then new password/confirmation from recovery link.
- Expected output: always show request success to avoid account enumeration;
  accept a valid recovery session, update password, show completion.
- Success path: request -> email -> allowed redirect -> `PASSWORD_RECOVERY` or
  session -> validation -> password update.
- Failure path: invalid/expired link displays invalid-link state; update error
  remains on form.
- Edge cases: already-authenticated ordinary session, session/event race,
  initial `getSession` rejection, reused link, password policy, email delay,
  browser opening link twice.
- Current discrepancy: any existing session enables the reset form, and the
  initial session promise has no rejection handler. Real-browser timing is
  explicitly untested.

## 5. Browse home, listings and detail pages

- Entry/routes/pages: `/`, `/property/:id`, `/car/:id`, `/machinery/:id`;
  home and listing components.
- Entities/APIs: Base44 Car, Property, Machinery, User, saves, reports, ratings,
  inquiries; entity list/filter/get/subscribe calls.
- Permissions/users: guests browse; authenticated users take social/contact
  actions.
- Input: route ID, category, sorting and card interactions.
- Expected output: current listing cards/details, media, price/location/seller,
  verification/reputation, and allowed actions.
- Success path: entity query -> render normalized display -> user may save,
  message, review/report or navigate to seller.
- Failure path: missing/unavailable ID shows empty/not-found/error behavior;
  entity/network error must not fabricate listing data.
- Edge cases: draft/sold/expired listing, missing photo/contact/location,
  deleted seller, currency conversion, stale subscription, unauthorized draft.
- Side effects/rules: views/impressions and realtime behavior must be measured;
  draft visibility and target-view RLS are not yet verified.

## 6. Search and filtering

- Entry/route/page: `/search`, `Search.jsx`, search/filter/dealer components.
- Entities/APIs: Base44 listing entities and Location/Neighbourhood.
- Permissions/users: guest/user.
- Input: text, category, price, location, condition and category-specific
  filters, sort/pagination behavior.
- Expected output: matching listings with stable result/filter state.
- Success path: filters translate to entity queries -> results/cards -> detail.
- Failure path: query failure produces visible error/empty state without
  silently changing filters.
- Edge cases: no results, large datasets, case/diacritics, invalid numbers,
  stale results, deep-link query parameters, result limits.
- Current uncertainty: production sort semantics, pagination/limits, text
  search ranking and cross-category equivalence require captures/contract tests.

## 7. Create listing

- Entry/route/page: `/create`, `CreateListing.jsx`, multi-step
  `components/create-listing` wizard.
- Services/entities: Base44 current user; Car/Property/Machinery; UploadFile;
  listing/notification functions; feature flags for packages/AI.
- Permissions/users: authenticated user; phone verification may gate publish.
- Input: category, seller/contact data, category fields, price/currency,
  location, photos, documents, package and preview confirmation.
- Expected output: exactly one valid listing of selected type, durable media
  references, success state and downstream notification/moderation side effects.
- Success path: validate each step -> upload -> create entity -> notify/redirect.
- Failure path: field/upload/create failure remains recoverable without duplicate
  or orphaned records/files.
- Edge cases: refresh/back navigation, category switch, duplicate submit,
  partial uploads, very large/unsafe file, phone not verified, network timeout,
  package flag off, moderation failure.
- Current risk: the flow calls `base44.auth.me()` after Supabase-only login;
  target normalized inserts will require a transaction across base/detail rows.

## 8. Edit and delete listing

- Entry: listing cards/details/my-listings actions; `EditListingDialog`,
  `deleteListing` Base44 function/entity updates.
- Permissions/users: owner; admin moderation path separately authorized.
- Input: listing ID and changed fields or delete confirmation.
- Expected output: only authorized record changes/deletes; media and related
  data disposition follows existing policy; lists refresh.
- Failure path: authorization/conflict/network error leaves record intact and
  reports failure.
- Edge cases: stale edit, concurrent moderation, sold/expired listing, category
  change, partial media cleanup, related saves/inquiries/reviews.
- Current uncertainty: delete cascade/storage cleanup and production conflict
  behavior are unknown; target service must be transactional/audited.

## 9. Saved listings and follows

- Entry/pages/components: `/saved`, save buttons, FollowButton,
  FollowingSection, follower-count hook.
- Entities: SavedListing, Follow, relevant listing/user entities.
- Permissions/users: authenticated user owns records.
- Input: listing/seller identity and toggle action.
- Expected output: idempotent save/follow state, updated counts/lists, optional
  follower notification.
- Failure path: unauthenticated action redirects to login; API failure restores
  prior UI state and does not duplicate.
- Edge cases: deleted listing/seller, repeated clicks, cross-device changes,
  missing `listing_type`/`seller_name` in target schema.
- Current uncertainty: uniqueness and notification side effects need contract
  tests and data profiling.

## 10. Inquiries and listing messaging

- Entry/routes/components: listing MessageDialog, `/inquiries`, conversation
  thread components.
- Entities/functions: Inquiry, current user, new-message notifications.
- Permissions/users: authenticated buyer/seller participants.
- Input: listing, recipient, message, thread/reply actions.
- Expected output: participant-scoped thread, unread/read state and notification.
- Failure path: unknown/deleted listing/user or unauthorized thread access is
  denied; send error does not create false success.
- Edge cases: self-message, blocked user, duplicate send, stale recipient email,
  listing deletion, attachment support, Base44/Supabase identity mismatch.
- Security rule: target insert/read policies must verify the listing and both
  participants, not only `sender_id`.

## 11. Reviews and seller ratings

- Entry/components: listing review lists, rating prompt/modal, seller reviews.
- Entities: Review, SellerRating, User, listings/bookings as proof source.
- Permissions/users: authenticated eligible reviewer/buyer; public readers.
- Input: subject, rating, text and relationship reference.
- Expected output: one authorized rating/review, aggregate reputation update.
- Failure path: invalid/out-of-range/duplicate/ineligible review denied.
- Edge cases: refund/dispute, deleted listing, edited review, seller self-review,
  missing target `listing_type`.
- Current uncertainty: Base44 eligibility/uniqueness rules and target aggregate
  semantics are not proven by schema alone.

## 12. Alerts and notifications

- Entry/routes/components: `/alerts`, `/notifications`, unread hooks/nav badges.
- Entities/functions: AppAlert, notification functions, subscriptions.
- Permissions/users: alert owner; admin/system creates relevant alerts.
- Input: events, read/delete/toggle interactions.
- Expected output: owner-only ordered alerts, accurate unread count, read/delete
  state and realtime refresh.
- Failure path: subscription/query failure leaves recoverable UI; no cross-user
  alerts.
- Edge cases: duplicate events, reconnect, high volume, deleted target,
  notification preference, missing target `listing_type`.
- Current discrepancy: proposed RLS has no delete policy although UI exposes
  deletion; independent outbox/provider delivery is absent.

## 13. Profiles, settings and currency

- Entry/routes/pages: `/profile`, `/settings`, `/seller/:email`; profile,
  settings and currency components/context.
- Entities/integrations: Base44 User, UploadFile, exchange rates.
- Permissions/users: public reads permitted by profile rules; owner edits own
  safe fields; admin changes privileged fields only through protected actions.
- Input: name, phone, bio, avatar, currency and seller/provider fields.
- Expected output: persisted safe profile fields and consistent public display.
- Failure path: invalid/upload/API error leaves prior values intact.
- Edge cases: email change, missing profile, duplicate seller identity, stale
  cache, invalid currency/rate, Base44/Supabase user mismatch.
- Security rule: users must never self-edit role, super-admin, status, ban, or
  verification fields. Current Phase 1 RLS violates this requirement.

## 14. Business and professional services

- Entry/routes/pages: `/business-profiles`, `/services`, `/service/:id`,
  `/create-service`, `/my-services`; business/service components.
- Entities/functions: BusinessProfile, Service, ServiceBooking,
  ServiceDispute, uploads and `createService`.
- Permissions/users: guests browse; authenticated owners/providers manage;
  booking/dispute participants and admin act by role.
- Input: business/provider identity, service details/pricing/location/media,
  booking and dispute state.
- Expected output: public active offerings and owner-managed records with
  participant-scoped booking/dispute lifecycle.
- Failure path: unauthorized update or invalid transition denied; partial
  service/upload creation recoverable.
- Edge cases: provider type ambiguity, inactive provider, overlapping booking,
  cancellation/refund, dispute, missing `practitioner_id` relation.
- Current uncertainty: provider/counterparty access implied by UI is not fully
  represented in proposed RLS.

## 15. Legal practitioner and booking workflows

- Entry/pages: legal directory/profile, practitioner signup, booking request,
  booking detail, user/practitioner portals, earnings/payment pages.
- Route state: retained but commented out/Hidden in `App.jsx`.
- Entities/functions: LegalSpecialization, LegalPractitioner, LegalBooking,
  PractitionerReview, resolveLegalDispute, credentials/uploads, payments.
- Permissions/users: guest/user/practitioner/admin by action.
- Input/output: credentials/profile -> verification -> public directory;
  request -> booking lifecycle -> payment/dispute/review.
- Failure/edge cases: unverified practitioner, confidential files, double
  booking, cancellation, dispute/refund, payout, hidden route accessed by old
  link.
- Rule: hidden is not removed. Production route/use evidence and confidential
  storage rules are required before migration or reactivation.

## 16. Bulk listing workflows

- Entry/routes/pages: `/bulk`, `/bulk/csv`, `/bulk/duplicate`, `/bulk/pdf`;
  bulk components and `bulkCreate.js`, `bulkDuplicate.js`, `bulkPdf.js`.
- Entities/integrations: listing entities, current user, uploads, file
  extraction.
- Permissions/users: authenticated seller/provider.
- Input: CSV/PDF file or source listing plus mapping/duplicates/options.
- Expected output: validated preview, per-item results, retryable failures and
  no silent partial success.
- Failure path: parse/schema/upload/create errors identify exact rows/items.
- Edge cases: large files, malicious content, duplicate rows, retry idempotency,
  mixed categories, rate limits, partial batch, Supabase/Base44 identity.
- Current uncertainty: PDF extraction is provider-dependent; target bulk
  transaction/job contract does not exist.

## 17. Verification

- Entry/route/page: `/verification`, verification forms/components; admin
  verification page.
- Entities/functions/integrations: VerificationRequest,
  submit/review/backfill/extract functions, uploads.
- Permissions/users: authenticated applicant; admin reviewer.
- Input: user/provider type, identity/trade/credential documents, selfie and
  extracted fields.
- Expected output: private durable evidence, pending review, audited decision,
  profile verification update and notification.
- Failure path: invalid/missing/unsafe files, extraction failure, duplicate or
  unauthorized review must fail safely without exposing documents.
- Edge cases: re-verification/reuse, name mismatch, expired credential,
  rejected appeal, admin conflict, retention/deletion request.
- Current blocker: storage classification/privacy, extraction provider,
  production workflow, and target authorization are unknown.

## 18. Support ticket lifecycle

- Entry/routes/pages: `/support`, `/support/new`, `/support/tickets`,
  `/support/tickets/:id`; active admin dashboard/queue/detail/settings/agents.
- Entities/functions: SupportTicket, SupportMessage, TicketAttachment,
  TicketActivityLog, SupportAgent, TicketTemplate, SupportSetting and support
  functions/email notifications.
- Permissions/users: ticket owner, assigned support/admin; templates/settings
  staff-only.
- Input: category, subject, description, priority/attachments; replies,
  assignment/status/satisfaction.
- Expected output: unique ticket, participant-scoped chat/files, audited staff
  state transitions and notifications.
- Failure path: unauthorized ticket/message/file access denied; send/update
  failure must not report success.
- Edge cases: duplicate ticket number, attachment privacy, concurrent agent
  assignment, reopen/close, escalation, satisfaction timing, notification retry.
- Current discrepancies: four support-related/reference tables lack complete
  RLS coverage, message insert lacks ticket participation check, ticket owner
  update is too broad, and attachment insert policy is absent. New-ticket file
  selection currently submits only filename/size metadata; the user ticket
  detail flow clears selected reply files without uploading or associating
  them. Preserve these as confirmed baseline defects until intended attachment
  behavior and private-storage controls are approved.

## 19. Administration

- Entry/routes/pages: all `/admin/*` routes in `App.jsx`; admin layouts,
  navigation, tables and dialogs.
- Services/entities: Base44 User, all domain/admin entities and privileged
  functions; AuditLog.
- Permissions/users: admin; super-admin for highest privilege actions.
- Input: filters, listing/report/verification decisions, role/status/ban,
  content/location/support/payment settings and operations.
- Expected output: authorized durable change, accurate refresh and immutable
  audit; non-admin denied.
- Failure path: fail closed with no partial privileged mutation or misleading
  success.
- Edge cases: Supabase-only admin without Base44 token, stale/demoted role,
  self-demotion, last super-admin, concurrent moderation, missing audit write,
  ban expiry, provider outage.
- Security rule: privileged operations require server/database enforcement and
  must not trust cached UI role. Current admin route recheck is hybrid/blocked.

## 20. Payments, subscriptions, escrow and payouts

- Entry/pages: pricing/package choices, PaymentPage, transaction history,
  practitioner earnings and admin payment/subscription pages.
- State: schemas/UI/contracts retained; relevant feature flags default off;
  several legal routes Hidden.
- Entities/functions: Payment, EscrowTransaction, Subscription,
  PractitionerPayout, `cancelSubscription`, `getRevenueStats`, Stripe packages.
- Permissions/users: transaction participants, provider/practitioner, admin.
- Input/output when enabled: amount/currency/method/plan/reference -> idempotent
  provider intent -> webhook-confirmed durable state -> receipt/reconciliation.
- Failure path: while disabled, fail closed and never create false paid state.
- Edge cases: duplicate webhook, timeout, mobile-money/manual reconciliation,
  refund/dispute, currency mismatch, cancellation race, payout failure.
- Rule: no money movement or privileged status update in the browser. Gateway,
  webhook, secrets, finance operations and audit are not implemented.

## 21. AI and scheduled automation

- Entry: moderation, ban-evasion, ticket triage, support assistants,
  document extraction, listing expiry, reminders and marketing email.
- Components/contracts: three Base44 agents, relevant functions and feature
  flags.
- Permissions/users: server/admin automation; provider secrets never in browser.
- Input/output: user content/files/events -> structured decision/suggestion/job
  result with audit/human review where high impact.
- Failure path: fail closed or use documented deterministic fallback; never
  fabricate extraction or silently enforce an unsafe model decision.
- Edge cases: prompt injection, personal data, provider outage, duplicate job,
  retries, cost runaway, unsafe output, consent/unsubscribe.
- State: feature flags default off; provider, queue, scheduler, monitoring and
  policy are absent.

## 22. Hidden/unrouted behavior preservation

- Hidden pages/routes: map and legal/practitioner/business/payment groups are
  commented in `App.jsx`.
- Unrouted pages: duplicate/legacy support and admin ticket-detail modules.
- Expected behavior: remain present and unchanged until production routing,
  analytics, bookmarks, product ownership and data use are verified.
- Failure/edge cases: direct historic links, deployment rewrites, stale
  navigation, externally linked profiles, unfinished parallel workflows.
- Rule: do not activate, merge, or delete based only on current route comments.

## Screenshot and test baseline

No screenshots were captured because a configured staging environment and
representative fixtures were not provided. Once available, capture each
workflow's success, validation, permission-denied, empty, error, loading,
mobile and relevant edge states. Record build, environment, role, fixture IDs,
viewport and timestamp.

The minimum automated baseline before broad migration is:

1. Auth browser tests for registration/confirmation/login/refresh/logout/
   recovery/blocked/admin.
2. Database apply test plus RLS action matrix for every table/view.
3. Contract tests for Base44 entity/function input, output, errors and side
   effects before each adapter cutover.
4. Critical browser journeys for listing, search, inquiry, verification,
   support and admin.
5. Storage/privacy tests and provider sandbox tests for every enabled
   integration.
