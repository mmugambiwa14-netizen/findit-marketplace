# Changelog

## 2026-07-27 — Extensive product audit and remediation

- Parsed all 42 routed patterns and 34 page modules, cataloguing 539 unique interactive controls and 731 route-expanded control instances.
- Added a permanent product-surface audit gate, route matrix, page/control matrix, findings manifest and CI/staging enforcement.
- Corrected protected registration returns, truthful logout recovery, missing-profile detection, role-check outage handling and reset-password validation.
- Moved listing and service Tour signing to explicit Play, with expired-link recovery and photo continuity.
- Corrected dependent location resets, longest-prefix phone parsing, browser-storage failure handling, search debounce/keyboard navigation and share outcome reporting.
- Added a global application error boundary, bundled listing placeholders, removed remote font/media fallbacks and replaced native destructive confirmations with focus-managed dialogs.
- Added keyset pagination to public services, saved content, owner inventories and public seller/business inventories through migration `0043_v1_inventory_pagination_and_audit_hardening.sql`.
- Added migration `0044_v1_admin_keyset_pagination.sql` and converted Marketplace, Users, Reports, Support, Audit Log and Tour moderation to bounded keyset pages without exact totals.
- Expanded the repository contract suite to 239 tests and added remediation regression coverage.
- Closed all source-level product-surface warnings; only installed-toolchain, live Supabase and interactive browser/device acceptance remain release blockers.
- Recorded those environment-dependent gates as unresolved rather than inferring passes.

## 2026-07-27 — Milestone 7: Scale hardening and release candidate

- Replaced active Chats offset/full-thread loading with bounded keyset inbox and message pages.
- Replaced public listing search offsets with keyset newest/price pages, normalized search documents and hot-path indexes.
- Replaced notification offsets with owner-scoped keyset pages and moved saved-listing unavailability delivery to a leased bounded fan-out queue.
- Added one canonical secret-protected notification worker, idempotent delivery, retry/dead-letter handling, aggregate alerts and completed-job retention.
- Added a partial public Tours feed cursor index for high-volume publication order.
- Added compact hourly operational metrics, serialized storage snapshots, deterministic alerts, founder health and an authenticated observability worker.
- Added guarded public-search, notification, messaging, Tours-scale and observability smoke suites.
- Added production acceptance identity enforcement, release-candidate CI and a manual hosted staging acceptance workflow.
- Added source-graph verification, release certification manifest, migrations `0040`–`0042`, targeted reverse-order rollback and production acceptance runbooks.
- Added repository-wide emoji/secret/conflict-marker hygiene and contiguous SQL/rollback verification as release-candidate CI gates.

## Unreleased — Milestone 6 / F Tour reporting and administration

- Added video-specific Tour reporting from catalogue and detail playback with eight deterministic reasons, duplicate-report prevention, and bounded daily report rates.
- Added durable report `target_type`/`target_id` identity while preserving canonical listing/service relationships, including safe backfill for historical reports whose parent was already removed.
- Replaced the generic Tour report decision path so actioning removes only the Tour, dismissal restores only an eligible ready Tour, and neither operation deletes the canonical parent.
- Expanded the existing founder moderation surface with pending, reported, failed, rejected, approved, and all-Tour queues; parent, seller, report, failure, and repeat-offender context; and manual reason-gated actions.
- Added JWT-protected, admin-only short-lived review playback and thumbnail signing without exposing private source video paths.
- Added audited Tour report decisions, reporter resolution notifications, manual seller suspension, cache invalidation, migration `0039_v1_tour_reporting_and_admin.sql`, targeted rollback, contracts, and guarded moderation smokes.

## Unreleased — Milestone 5 / E public Tours catalogue

- Added a service-only `public_tour_feed` read model for Property, Vehicles, Equipment, and eligible Services with deterministic `(published_at, tour_id)` keyset pagination and bounded page sizes.
- Added the public `tour-feed` Edge Function to validate filters, batch-sign private thumbnails and cover images, and withhold playback until explicit user interaction.
- Added one-hour signed card assets while retaining the separate five-minute eligibility-checked playback boundary.
- Replaced the preview route with the real `/tours` catalogue only when `VITE_FEATURE_TOURS=true`; the controlled preview remains available while the public flag is closed.
- Added cinematic 16:9 Tour cards, search, category and location filters, manual pagination, explicit muted playback, low-data handling, poster fallback, and playback retry.
- Preserved canonical marketplace identity for View listing, Share, Save, Chat, and Contact. No saved-Tour, video conversation, creator feed, public engagement, or social ranking model was introduced.
- Added URL-backed filter state and session restoration for feed position, selected Tour, and practical playback position.
- Excluded unavailable parent listings, inactive/legal services, and every Tour that is not ready, approved, published, complete, and currently eligible.
- Added migration `0038_v1_public_tours_catalogue.sql`, targeted rollback, 11 Milestone 5 contracts, and guarded local/hosted discovery smoke commands.
- Corrected card-asset signing to use the intended one-hour lifetime rather than the shorter playback lifetime, preventing expired posters during long or restored catalogue sessions.

## Unreleased — Milestone 4 / D listing and Tour integration

- Added metadata-only public Tour summaries for listing and service cards while keeping signed playback behind the eligibility-controlled detail boundary.
- Integrated Tour badges and canonical `?media=tour` deep links across search, saved listings, seller/dealer/business inventory, and service surfaces. Saving and messaging continue to use listing identity only.
- Added explicit-playback detail media with photo fallback and playback failure recovery. Services use “See their work”; asset listings use Tour/Watch tour language.
- Kept available and under-offer inventory in active browse/search; unavailable listings leave active discovery and public Tour eligibility.
- Preserved unavailable saved listings and existing conversation detail links, including authorized private listing media and image access, without making those rows or objects public or creating saved-Tour records.
- Restricted new conversations to available and under-offer listings while preserving existing conversation history after listing status changes.
- Added listing thumbnail, title, price, availability, Tour badge, and View listing context to chat inbox and thread headers without exposing private Tour storage paths.
- Opened seller Tour management for pending-review and live available/under-offer listings, avoided duplicate explicit review submission on live edits, and based the success message on the backend-returned listing status so Tour-only changes are not misreported as resubmissions.
- Added canonical React Query invalidation across list, detail, saved, seller/business profile, and messaging projections after Tour, edit, and lifecycle mutations.
- Extended database invalidation to card/feed-relevant listing and service content changes and suppressed no-op update events.
- Added migration `0037_v1_listing_tour_integration.sql`, targeted rollback, Milestone 4 contracts, and guarded local/hosted Supabase integration smoke commands.

## Unreleased — Milestone 3 / C seller Tour workflow

- Added optional Record, Upload and Skip controls to listing and service creation without creating a separate Tour-post identity.
- Added owner Tour management to listing and eligible non-legal service editing: current/pending states, atomic replacement, removal, processing retry, rejection/failure feedback and background status refresh. Rejected records remain visible with their reason and must be removed before a corrected replacement is uploaded.
- Added direct private-storage upload progress plus recoverable intent handling. Interrupted uploads reuse the exact authorization and idempotency key; expired authorizations first confirm an exact already-accepted object and otherwise renew the same server-owned intent, Tour identity and path only while the canonical parent remains eligible.
- Preserved canonical publication: the listing or service is created first, remains usable when Tour upload or processing fails, and exposes an immediate Resume path after interrupted publication.
- Added migration `0036_v1_seller_tour_workflow.sql` and rollback to allow owner uploads during normal listing review/correction/renewal states while continuing to reject sold, unavailable and legal-service parents. Public Tour eligibility remains unchanged.
- Added seller workflow contracts and a guarded Supabase smoke covering pending-review and rejected listings, active services, unavailable parents and the legal-service exclusion.
- Closed a runtime parse defect in the service edit dialog caused by a duplicated legal-service Tour condition, and added a regression assertion requiring exactly one exclusion boundary.
- Preserved edit-screen interruption recovery after backend status refresh: the selected local file and exact signed upload intent remain mounted so the seller can resume rather than accidentally starting a duplicate Tour.
- Blocked step changes and listing/service saves while Tour metadata validation, upload, removal or processing-retry mutations are active.

## Unreleased — founder administration, legal baseline, and UI refinement

- Added Google sign-in directly to the Home hero and corrected OAuth feature
  flag evaluation to use Vite-compatible static environment references.
- Reworked the Home hero, category navigation, application chrome, design
  tokens, guest banner, and restricted-action prompt for a cleaner responsive
  marketplace experience.
- Removed redundant Browse and Services links from the desktop top bar and
  removed Zimbabwe-focused positioning from active UI and page metadata.
- Added review-ready Privacy, Data Protection, Terms, Cookies, and Community
  Guidelines drafts with legal links across application, authentication,
  administration, blocked-account, error, and not-found shells.
- Added 13 consistent classic FindIt Supabase Auth and security-notification
  email templates plus deployment documentation. Hosted publication remains
  blocked until custom SMTP or a compatible Supabase plan is configured.
- Added and deployed migration `0030_v1_founder_admin_lock.sql`; hosted
  verification reports exactly one active admin matching the founder identity
  hash, and hosted schema lint is clean.
- Expanded contracts to 88 passing tests and active typechecking to 170 source
  modules. Production build, Base44 elimination, bundle budgets, lint, full and
  migration typechecks, and production dependency audit pass.

## 2026-07-26 — V1 engineering migration and Base44 elimination

- Deployed and accepted all 30 migrations and four Edge Functions on hosted
  Supabase staging.
- Added guarded hosted suites for Auth, owner listings, services, admin,
  business/dealer profiles, listing media, messaging, notifications, workers
  and 130-fixture search scale; all pass and clean fixtures.
- Added dedicated rotated worker secrets and GitHub Actions schedules.
- Added subpath-safe Vite/Router/Auth behavior and deployment workflow.
- Strengthened hosted Auth to 10-character mixed-case/digit passwords and
  eight-character OTPs.
- Removed the Base44 SDK, export tree, client/bootstrap, 171 unreachable source
  modules, seven unused AI/entity artifacts and 87 other unused npm packages.
- Added a source/package/export/config elimination gate.
- Full typecheck now passes; contract suite passes 78/78.
- Production build passes at 542,121 bytes raw / 158,563 gzip entry JS and
  58,563 / 10,239 gzip CSS.
- Created a 49-table/two-bucket logical staging backup and verified 51 hashes.
- Refreshed status, QA, readiness, elimination, environment, flags, recovery
  and handover documentation.

All entries describe repository changes, not production releases. FindIt has
not reached a production release.

## Unreleased — 2026-07-26

### Phase 8 hosted staging checkpoint

- Created the private GitHub baseline and provisioned `FindIt Staging` in
  London. Applied migrations `0001`–`0029`, passed hosted `public,storage`
  schema lint, and deployed all four Edge Functions.
- Added a guarded hosted Auth smoke with an explicit staging opt-in and exact
  project-ref check. It passes confirmed synthetic account creation, profile
  trigger, password login, own-profile RLS, anonymous denial, logout and
  complete fixture cleanup.
- Extended the existing listing/upload smoke with the same exact-project
  hosted guard. Hosted staging now passes session/origin/content denial,
  metadata stripping, private product-image upload, listing submission,
  moderation, signed exact-byte download, direct-photo bypass denial, atomic
  replacement and fixture cleanup.
- Verified hosted public REST and anonymous denial for all four functions.
  The first maintenance-worker acceptance run found that using Supabase's
  platform database key as the scheduler bearer failed in the hosted runtime.
  Both workers now use separate environment-specific scheduler secrets while
  keeping the Supabase admin key internal; hosted empty-queue calls pass.
- Recorded that linked pgTAP currently stops before assertions because the
  managed CLI login role lacks `USAGE` on the `extensions` schema. Hosted
  schema lint and API/RLS smokes pass, while the local 258-assertion suite
  remains authoritative until the hosted runner receives supported access.

### Phases 4–7 local completion

- Closed the approved V1 Phase 4 storage boundary locally. Upload responses
  are non-cacheable and disable MIME sniffing; contracts cover generated
  owner-scoped paths, one-hour signed previews and the 5 MiB/8000 px/40 MP
  image limits. Clean reset/lint, all 258 database assertions and the real
  listing/service/business upload and cleanup smokes pass.
- Completed Phase 5 as a safe V1 deferral. Migration `0029` removes every
  browser policy and table grant from retained payment, escrow, subscription
  and practitioner-payout tables while preserving service reconciliation.
  Commerce/premium/AI/outbound flags must remain false in production, no
  commerce screen is in the active graph, and unused Stripe browser packages
  were removed.
- Completed the local Phase 6 essential-notification runtime with a
  service-authenticated listing-expiry Edge worker. The real HTTP smoke proves
  browser/mixed-key denial, trusted safe-link creation and idempotency.
  Notification loading/error/count semantics were made accessible.
- Completed the bounded local Phase 7 pass. Added keyboard skip navigation,
  named mobile navigation and active-page semantics; added an enforced 560 KiB
  raw/170 KiB gzip entry budget; and retained the narrow, documented RSC-only
  audit exception because the SPA has no RSC surface. Lint, the 165-module
  active typecheck, 79 contracts, build/budget/Base44 scans, database lint,
  258 SQL assertions and the 130-listing search-scale smoke pass.

## Unreleased — 2026-07-25

### Active graph type closure and React Router security upgrade

- Added `typecheck:active`, which compiles the exact 165-module graph reachable
  from `App.jsx`. Shared UI contracts and active call sites were corrected
  without blanket suppression; the gate now passes with zero diagnostics.
- Upgraded `react-router` and `react-router-dom` from 6.30.4 to 7.18.1 and
  documented the Node 20 minimum. The two Moderate advisories are removed;
  lint, both scoped type gates, all 69 source contracts and the Base44-free
  109-asset production build pass after the upgrade.
- Added an applicability-aware production audit gate. It fails every reachable
  Moderate, High or Critical advisory except the explicitly documented
  RSC-action advisory, whose execution mode is absent from this declarative
  browser application. The raw development audit remains documented.
- Extended the read-only GitHub Actions workflow with the active graph type
  gate and the applicability-aware production audit.
- Current browser/mobile/accessibility acceptance was attempted through the
  in-app browser, but its webview could not attach after documented recovery.
  The local Docker/Supabase runtime then became unresponsive during the full
  smoke batch and requires host-level WSL recovery. No browser or local API
  pass was inferred from these environmental failures.

### Repeatable frontend migration gate

- Added a least-privilege GitHub Actions workflow for locked installation,
  production dependency audit, environment validation, lint, the expanded
  migration typecheck, all source contracts and the generated-output Base44
  boundary.
- Centralized active-route graph collection so source-boundary checks and
  measured type coverage use the same 165-module graph.
- The workflow source is locally aligned with passing commands; a shared
  GitHub run, database CI, browser E2E and deployment remain open.
- This earlier checkpoint reported two Moderate React Router advisories; the
  later 7.18.1 upgrade recorded above supersedes that checkpoint.

### Future legal-domain isolation

- Added migration `0028_v1_legal_domain_isolation.sql`. The five retained legal
  profile/specialization/booking/review/payout tables now expose no browser
  grants or policies; service-role reconciliation remains available.
- Shared `services` policies now require a nonlegal category for public reads
  and every browser insert/update/delete path, closing direct-API visibility
  and category-mutation bypasses outside the UI filters.
- Added an adversarial legal-domain SQL suite. All 28 migrations apply cleanly,
  database lint is clean and all 253 pgTAP assertions pass.

### Search scale correctness

- Added a local-only disposable 130-listing API smoke for the public property
  search boundary. It proves exact counts, stable 24-row ordering across six
  pages, no repeated rows, discovery beyond the original 100-row cutoff and
  server-side detail/price filters.
- Fixture teardown is verified at both the listing and Auth boundaries. Search
  correctness is now locally accepted; production-volume query plans/latency
  and populated browser acceptance remain open.

### Chart style injection boundary

- Removed `dangerouslySetInnerHTML` from the shared chart style component.
  Chart IDs and custom-property keys now use bounded identifiers; colors accept
  only strict hex, numeric RGB/HSL, safe CSS-variable forms or four explicit
  keywords. Unsafe keys and values are omitted before CSS is rendered.
- Added three executable injection-regression contracts. The current source
  suite passes 69 tests, lint passes, and the production build remains
  Base44-free across 109 generated text assets.

### Image lifecycle cleanup and function privilege hardening

- Added migrations `0026_v1_image_lifecycle_cleanup.sql` and
  `0027_v1_function_execute_hardening.sql`. Expired, unattached upload intents
  are claimed into a non-attachable state before deletion, stale claims are
  recoverable, failed removals back off for 15 minutes, attached media is
  excluded, and successful cleanup retains a minimal ledger state.
- Added the internal `media-lifecycle-cleanup` Edge Function. It accepts only
  the configured Supabase secret/service credential, processes at most 100
  candidates, removes objects from both private buckets, finalizes each intent
  idempotently, and returns counts/correlation without object paths.
- Adversarial testing exposed explicit default `anon`/`authenticated` execute
  grants on functions that had revoked only `PUBLIC`. The new privilege
  migration removes browser execution from the listing-expiry worker,
  notification-construction helper, nested/trigger helpers and every other
  non-public RPC, then restates the exact public/authenticated/service matrix.
- At the original lifecycle checkpoint, clean application of all 27
  migrations, schema lint, 241 database assertions, 66 source contracts, lint
  and migration-scoped type checking passed.
- The real lifecycle-worker HTTP smoke now passes against a freshly restarted
  local stack. Browser-key and mixed-key gateway requests are denied; the
  trusted scheduler credential cleans both private buckets, finalizes both
  ledgers and produces an idempotent zero-claim repeat run.

### Active V1 Base44 runtime isolation

- Added a recursive module-graph contract that walks every import reachable
  from `src/App.jsx`, including readiness-flagged routes, and fails if the
  active graph reaches `@/api/base44Client` or `@base44/sdk`.
- Added `scripts/verify-built-boundary.mjs` to the mandatory production build.
  The current build scans 109 generated HTML/JavaScript/CSS/JSON assets and
  contains zero Base44 text.
- Reconciled the dependency reports: 79 exact-ledger imports remain only in
  retained dormant/future source. This locally closes the Phase 3 V1 source/
  build boundary, but does not remove the SDK, retained source, 59 functions,
  three agents, production data, or the need for production no-traffic proof.

### Trusted image metadata sanitization

- Added shared pre-storage sanitization for all approved V1 image classes.
  JPEG EXIF/IPTC/comment/application metadata, PNG text/EXIF/time chunks, WebP
  EXIF/XMP chunks and trailing payloads are removed before checksum,
  authorization metadata or Storage upload. WebP feature flags and container
  length are repaired after removal.
- Added direct PNG/JPEG/WebP sanitization contracts. Product, service and
  business-logo HTTP smokes now upload a PNG carrying a fake GPS text chunk,
  require `metadataRemoved: true`, verify the stored byte count and download
  the exact clean original. All three smokes pass and leave zero users,
  intents, media rows or objects.
- At this metadata checkpoint the clean source suite passed 63 contracts. Metadata privacy is now
  locally verified; full pixel re-encoding, malware/content scanning or an
  approved image-only exception, derivatives and lifecycle jobs remain open.

### V1 Favourites and lightweight Contact Support

- Replaced the active Favourites page's Base44 entity/current-user/realtime
  path with one owner-scoped Supabase query, explicit public listing
  hydration, stable saved order and shared cache invalidation. The owner API
  smoke now covers save, list, hydrate and remove with zero leftover fixtures.
- Added migration `0025_v1_contact_support.sql` and a purpose-built private
  `support_requests` founder inbox. Guest/account submission validates a small
  V1 contract, applies serialized per-email/account limits and returns an
  opaque reference without exposing a customer lookup or ticket portal.
- Added `/help/contact`, a clear Help CTA, and a Support requests view inside
  the existing Admin Reports destination. Admin resolution requires a reason
  and is durably audited without copying contact email/message into the audit
  log. Legacy ticket chat, attachments, agents and settings remain dormant.
- At this Favourites/Support checkpoint the clean gates passed 63 source contracts, 217 database assertions,
  schema lint, lint, scoped typecheck, production build and the expanded real
  admin API smoke. The active dependency ledger remains exact at 79/79 Base44
  imports. A recursive regression test proves none are reachable from the
  active App route graph, including readiness-flagged V1 routes.

### V1 service photos and business/dealer logos

- Added migration `0022_v1_marketplace_profile_media.sql`, the private
  `marketplace-images` bucket, purpose-bound upload intents, ordered service
  media, protected profile-logo metadata and three owner/publication-aware
  Storage policies.
- Added the authenticated `marketplace-image-upload` Edge Function and a
  shared binary image validator used by both upload functions. Real
  JPEG/PNG/WebP signatures, MIME, size, dimensions, pixel count, ownership,
  generated paths and SHA-256 metadata are checked before attachment.
- Added service-photo upload during service creation and business/dealer-logo
  add, replace and remove behavior. Public images use short-lived signed URLs;
  unattached, paused and suspended-owner media remain private.
- Found an anonymous-read Storage policy that directly queried a private
  intent table and therefore raised a permission error. Replaced the direct
  table dependency with narrowly scoped `SECURITY DEFINER` predicates and
  added the denial/publication regression matrix.
- Real authenticated HTTP smokes now prove service-photo and business-logo
  upload, hidden-before-attach behavior, exact-byte signed download, direct
  metadata bypass denial, unpublication hiding and cleanup. The current gates
  passed 53 contracts and 193 database assertions at that checkpoint.

### V1 product and service edit-media lifecycle

- Added migrations `0023_v1_service_media_edit.sql` and
  `0024_v1_listing_media_edit.sql`. Owner-scoped replacement RPCs validate and
  lock every kept/new object before atomically detaching old metadata,
  consuming new intents and rebuilding compatibility photo arrays.
- Added trusted image add/remove controls to the service and product edit
  dialogs. Cancelled staged uploads are cleaned up; legacy external images are
  shown read-only until their source objects have a reconciled migration.
- Product edits must retain at least one image, service edits allow up to six,
  product edits allow up to twenty, and media changes to a live product force
  `pending_review`. Direct owner mutation of `listings.photos` is now denied in
  every lifecycle state.
- Extended real HTTP smokes to replace attached product/service images, prove
  detached objects immediately become non-public, download replacements byte-
  for-byte, exercise review/unpublication behavior and remove all fixtures.
- Corrected the product smoke teardown to use `audit_logs.target_record_id`;
  the earlier wrong field could leave its disposable admin user behind. The
  exact leftover fixture was removed and a rerun proves zero smoke users,
  intents, media rows and Storage objects.
- The complete local gates now pass 55 contracts, 206 database assertions,
  schema lint, lint, scoped typecheck, production build and all three real V1
  media smokes.

### Phase 2D Base44 authentication source closure

- Repointed the final 15 runtime Base44 auth operations across 14 client
  consumers to the shared Supabase auth context and login redirect.
- Added an automated contract guard that fails if a Base44-client consumer
  reintroduces `base44.auth.*`.
- Updated the local auth smoke to remove its generated user in a `finally`
  cleanup path; signup, confirmation, profile creation, login/logout, recovery,
  password replacement and zero-fixture cleanup pass.
- The authentication checkpoint passed 50 contracts, lint, scoped typecheck and the
  production build. Production SMTP/OAuth, refresh/revocation, blocked-account
  lifecycle and existing-user transition acceptance remain external blockers.

### V1 product listing creation and minimum trusted Storage

- Added migrations `0020`–`0021` for explicit review/rejection/pause/
  unavailable states, atomic idempotent product/detail/media submission,
  protected owner transitions, state-aware moderation, upload intents,
  listing-media metadata, deterministic launch locations and RPC-only browser
  creation.
- Added one private `listing-images` bucket with 5 MiB JPEG/PNG/WebP limits
  and three owner/admin/publication-aware Storage policies.
- Added the authenticated `listing-image-upload` Edge Function. It checks
  allowed origins and real file signatures, enforces MIME/size/dimension/pixel
  limits, computes SHA-256, generates owner-scoped paths, rate-limits intents,
  confirms stored ownership/type/size and returns a short-lived signed preview.
- Replaced the active Base44 product-create wizard with the approved five-step
  V1 flow and submit-for-review outcome. Updated My Listings and Admin Listings
  to use the protected lifecycle; editing live content now forces re-review.
- Public, owner, seller and business/dealer listing reads now resolve private
  Supabase media paths to signed URLs while retaining safe legacy HTTP images.
- Added 5 product/media contract assertions, a 48-assertion adversarial SQL
  suite and a real local HTTP upload-to-approved-download smoke. The complete
  gates at that checkpoint passed 50 contracts, 166 database assertions, schema lint, lint,
  scoped typecheck, production build and all domain regression smokes.
- Production acceptance remains blocked by unavailable in-app browser UI QA,
  hosted Edge/Storage operations, scanner/re-encoding/derivative/lifecycle
  decisions, remaining asset classes and Base44 object reconciliation.

## Unreleased — 2026-07-18

### Phase 1 local database closure

- Added migration `0013_v1_rls_hardening.sql` to enforce active-account
  checks, protected managed fields, V1 owner/participant relationships,
  validated new writes, public business projection, trusted audit writes, and
  fail-closed deferred-domain access.
- Added a 43-assertion V1 RLS matrix; at that checkpoint the complete local
  database suite passed 65 assertions after a clean 13-migration reset/lint.
- Added checked-in reconciliation SQL and SHA-256-verified local backup/
  restore rehearsal scripts. The rehearsal restored 41 public and 41
  RLS-enabled tables into an exact disposable database and removed it.
- Reconciled current-state architecture, database, QA, risk, debt, bug, and
  project-status records. Provider recovery, production-like upgrade, and
  imported-data acceptance remain explicitly blocked.

### Phase 2 authentication hardening

- Added explicit auth-state handling so missing profiles and unavailable
  Supabase sessions are no longer silently treated as guest sessions; users see
  a safe retry state instead.
- Updated Login and Register to await and report OAuth initiation failures,
  prevent duplicate OAuth/resend actions, and handle immediate-session signup
  responses correctly.
- Added four pure auth-state contract assertions. At that checkpoint the
  repository gates passed 10 contract tests, lint, scoped migration typecheck,
  and production build.
- Added `npm run test:auth-local`, a repeatable local signup, confirmation,
  profile/phone-trigger, login/logout, recovery, password-replacement, and
  old/new-password smoke flow using Supabase Auth and Mailpit.
- After the authorized Docker restart, the clean 13-migration reset, SQL lint,
  65 database/RLS assertions, and zero-data reconciliation pass again.
- Chromium confirms invalid login feedback, registration validation, no-event
  reset denial, and a genuine emailed recovery callback that opens the new-
  password form. Shared SMTP/OAuth and full lifecycle/browser QA remain.

### Phase 3 public marketplace browse and details

- Added the first marketplace repository/service boundary for normalized
  Supabase Property, Car, Machinery, and Location data.
- Cut Home's three latest-listing reads from Base44 to Supabase with explicit
  public fields, available-only filtering, stable ordering, and a compatibility
  mapper for the existing listing cards.
- Added full-dataset server-side Search with exact counts, stable 24-row
  pagination, URL-persisted filters, recent searches, and listing/location
  suggestions.
- Cut public Property, Car, and Machinery details, shared Favourite controls,
  active locations, and listing reports to Supabase repositories/services.
- Removed unverified badges and view counters from migrated public surfaces;
  kept truthful USD-only V1 currency behavior.
- Removed the Base44 Vite plugin, restored the standard `@` alias, and
  lazy-loaded routes so dormant legacy pages do not initialize on migrated
  public routes.
- Added six mapper/search contract tests and a scoped migrated-boundary typecheck.
- Corrected the earlier broad-typecheck pass claim; the legacy UI/dependency
  graph remains a tracked failing baseline.

### Phase 3 owner listings, profiles, sellers, and services

- Migrated owner listing read/edit/publish/renew/delete, account full-name and
  seller-bio settings, password change, and the public seller page to bounded
  Supabase repositories/services.
- Added migration `0014_public_seller_profile.sql`; the active-only seller RPC
  exposes id, name, bio and avatar without private account, role, status or
  verification fields.
- Migrated V1 service browse/search/detail and provider create/manage/edit/
  pause/delete to Supabase. Removed active legal, verification, fake view,
  service-favourite and Base44-upload behavior from V1 service surfaces.
- Added migration `0015_service_owner_delete.sql`, four service contracts and
  a repeatable local service smoke command.
- Fixed a production-only seller-profile failure where an inline JSDoc return
  disappeared from the minified chunk; configured Preview QA now covers the
  deployable seller and services bundles.
- The current gates pass a clean 15-migration reset, schema lint, 72 database
  assertions, 21 source contracts, Auth/owner-listing/services smokes, scoped
  typecheck, lint, configured production build and targeted guest/owner
  Chromium flows.

### Phase 3 active V1 administration

- Added migration `0016_v1_admin_operations.sql` with the founder-managed
  category taxonomy, reason/result/correlation audit fields, server-paginated
  admin reads and narrow transactional moderation/user/report/category writes.
- Migrated Overview, Marketplace, Users, Reports, Categories and Audit Log from
  Base44 to the Supabase repository/service boundary; dormant legal, payment,
  verification, analytics, content and support-suite admin source stays
  unreachable and classified.
- Added self-lockout prevention, super-admin-only role assignment, essential
  account-status notifications, immutable category identity and protected
  top-level category rules.
- Added eight admin contract tests, 23 admin SQL assertions and a repeatable
  local admin API smoke. The current gates pass 16 migrations, 42 RLS-enabled
  tables, 70 policies, 95 database assertions, 29 contract tests, schema lint,
  scoped typecheck, lint and a configured production build.
- Authenticated Chromium renders all six pages, executes reason-gated service
  moderation and report review, verifies durable audit evidence and confirms
  the collapsed 390 px admin navigation remains accessible without viewport
  overflow.

### Phase 3 lightweight business and dealer profiles

- Added migration `0017_v1_business_profiles.sql`: one profile per owner,
  generated business/dealer presentation, active-owner public projection,
  validated contact/website/social fields and V1 legal-firm exclusion.
- Replaced the active Base44 business form with one Supabase owner page and a
  shared public `/business/:id` / `/dealer/:id` profile architecture. Dealer
  pages expose only active vehicle inventory and URL-persisted inventory search;
  business pages group active product and service inventory.
- Removed verification documents, ratings, multi-business creation, analytics,
  deletion and a separate business/dealer dashboard from the active V1 path.
  Logo editing remains pending the trusted storage slice.
- Added six contract assertions and a repeatable local profile API smoke. All
  17 migrations, 95 database assertions, 35 source contracts, schema lint,
  scoped typecheck, lint and configured build pass.
- Desktop and 390 px Chromium verify guest/owner routes, dealer search, contact
  actions, labels and overflow. The browser pass exposed and drove correction
  of undersized mobile contact targets.

### Phase 3 minimal messaging

- Added migration `0018_v1_messaging.sql` with first-class listing
  conversations, participant-only reads, immutable plain-text messages,
  per-participant unread positions, block controls, retention metadata and
  report handling. New direct client message inserts are denied.
- Added trusted conversation start/send/read/seen/block/report RPCs with
  active-account checks, 2,000-character validation and sender rate limits.
  Founder report review now supports closing a reported conversation with
  durable audit evidence.
- Replaced the active listing message dialog, inbox, conversation thread and
  admin message-report path with Supabase repository/service boundaries. Guest
  WhatsApp, call and email contact remain separate from authenticated messaging.
- All 18 migrations apply cleanly; database lint, 95 pgTAP assertions, 40
  source contracts, the current configured build and adversarial buyer/seller/
  stranger/admin API smokes pass. Messaging remains disabled because targeted
  desktop/mobile browser acceptance could not run: the in-app browser runtime
  reported no available browser instance.

### Phase 3 essential notifications

- Added migration `0019_v1_essential_notifications.sql`, preserving legacy
  alerts while exposing only listing-approved, listing-rejected,
  listing-expiry, report-resolved and account-status events to the V1 client.
- Removed authenticated client insert/direct-update access to alerts. Added
  owner-only paginated reads, unread count, single/all read-state RPCs,
  allowlisted internal links and idempotent trusted event source keys.
- Added server-managed 30-day listing expiries and a service-role-only worker
  for three-day notices and due expiry. Admin moderation, final report decisions
  and account-status changes now emit the approved events transactionally.
- Replaced the active Base44 Notification Center and unread hook with Supabase
  repository/service boundaries. The V1 UI has one chronological view and no delete,
  realtime, sound, price-drop, social, marketing or recommendation behavior.
- All 19 migrations apply cleanly; schema lint, 117 pgTAP assertions, 44 source
  contracts, scoped typecheck, lint, configured build, adversarial notification
  smoke and the regression admin/messaging smokes pass. The flag remains off
  pending browser acceptance and deployed expiry scheduling/monitoring.

### Approved MVP V1 scope and launch surface

- Made the revised MVP product specification authoritative and reconciled the
  supporting product, role, database, admin, UI/UX, flow, component, design,
  and migration plans.
- Narrowed registered application routes and all admin navigation variants to
  the approved implemented V1 surface while preserving dormant source.
- Added migration-readiness gates for required Business Profiles, plain-text
  messaging, and essential notifications. Business Profiles now default on
  after local verification; the other two remain off until their cutovers pass.
- Removed legacy support/alert realtime subscriptions, sounds, navigation
  pending-count calls, and unsupported Home/Help claims from the active shell.
- Simplified Home navigation, category entry, hero copy, and guest account
  messaging around Discover, Advertise, Evaluate, and Contact.

### Phase 2C

- Replaced the Base44 admin-route role check with Supabase database role RPCs.
- Changed `AdminUsers` to use the Supabase-backed auth-context profile for its
  display-only super-admin state.
- Required a genuine Supabase password-recovery event before password update
  and handled reset-session lookup failure.
- Expanded the focused database suite from 18 to 22 assertions.

### Production-readiness and documentation

- Added local Supabase configuration and focused migration/RLS/Auth checks.
- Corrected migration trigger, RLS, compatibility-view, and policy-literal
  issues found during clean local application.
- Removed seven unused direct dependencies and remediated the lockfile audit.
- Added environment, deployment, backup/DR, observability, QA, bug, debt, and
  Document 4 handover records.
- Replaced the legacy Base44 publishing README with independent-project
  operating guidance.

## Historical baseline — Phase 0 through 2B archive

The supplied `findit-phase2b-registration-reset.zip` remains the authoritative
starting codebase. Its implementation history and archive-era findings are
preserved in `docs/history/MIGRATION.md` and `docs/history/PHASE_0_TO_2B_VERIFICATION.md`.
