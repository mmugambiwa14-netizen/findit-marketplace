# Flagged Capabilities and Release Controls Audit

Reviewed: 2026-07-31

Repository: `mmugambiwa14-netizen/findit-marketplace`
Branch: `feature/listing-intelligence-foundation`
Reviewed head: `c57912947cb2bea649e661274d04d2969d61d4f1`
Staging project: `bwgklpxoetrrkutottdb`
Staging SQL boundary: canonical migrations `0001` through `0099`
Production boundary: intentionally unchanged at migration `0049`

## Purpose

This audit pauses new schema hardening and inventories every known release flag,
dormant capability, database control, advisor notice, operational queue,
external dependency and stale report before migration `0100` begins.

A capability is not considered ready merely because one layer says `enabled`.
FindIt currently has separate browser, deployment, worker, database and provider
control layers. Release readiness requires those layers to agree.

## 1. Browser feature switches

### Required MVP capabilities

The production validator requires these flags to be enabled:

- business profiles
- messaging
- essential notifications
- Google OAuth
- international listing
- manual location
- current location
- reporting

Business profiles, messaging, essential notifications, Google OAuth and
reporting have active product surfaces. The location-related flags need
correction as described below.

### Accepted Peek release switches

Peek has a correctly layered release gate:

- browser route flag
- preview-only flag
- fixture flag
- backend flag
- worker flag
- processor mode
- release-accepted flag
- acceptance identifier
- database feature control
- operational controls for upload, processing, playback, cleanup, cache and
  observability

The live staging database enables the `tours` feature with a 120-second duration
limit, a 250 MiB source limit, three processing attempts and seven-day source
retention. Browser and worker activation still depend on deployment variables,
which are not readable through the current connector.

### Intentionally deferred capabilities

The following remain deliberately disabled and must not be treated as unfinished
MVP defects:

- payments
- subscriptions
- escrow
- premium listings
- AI content moderation
- AI ban-evasion detection
- AI ticket triage
- AI support chat
- scheduled reminders
- marketing emails
- listing expiry
- listing freshness reminders
- Apple OAuth
- legal-services commerce and booking flows

Their tables or scaffolding may remain in the schema, but the production
validator correctly requires the corresponding browser flags to remain off.

## 2. Feature-switch defects and drift

### High: incomplete optional capabilities can pass release validation

Four optional switches do not currently have a complete product contract:

1. `VITE_FEATURE_CURRENCY_CONVERSION`
   - Environment validation accepts it when `EXCHANGE_RATE_PROVIDER` is set.
   - `CurrencyContext` still uses static native-only identity rates and does not
     call a provider.
   - Enabling the flag would not create real conversion.

2. `VITE_FEATURE_PHONE_VERIFICATION`
   - Environment validation accepts it when Twilio credentials are set.
   - Registration requires a phone number but performs no phone verification
     flow and does not read the flag.
   - Enabling the flag would not produce verified phone ownership.

3. `VITE_FEATURE_SERVICE_RADIUS`
   - The flag is declared but is not checked by the service-creation flow.
   - The UI always exposes only a `can_travel` boolean and has no radius value,
     unit, validation or persisted radius contract.
   - The production validator neither requires this flag off nor validates a
     complete dependency set.

4. `VITE_FEATURE_CURRENT_LOCATION`
   - The production validator requires it on.
   - The current discover/search location surface is a manual hierarchical
     selector.
   - No active browser geolocation request was found in the reviewed source.

These flags should be forced off until real implementations and tests exist, or
the capabilities should be completed before release.

### High: international-listing flag overstates the current domain boundary

`VITE_FEATURE_INTERNATIONAL_LISTING` is required on in production, but staging
contains one active country configuration (`ZW`) and 79 active Zimbabwe
locations. Listing creation selects a city/town from the active database
location list and does not expose a country choice.

The underlying hierarchy can support additional countries, but the currently
configured product is Zimbabwe-first. The flag name and production requirement
therefore overstate current rollout readiness.

### Medium: maps dependency validation names the wrong provider

The maps UI is implemented with Leaflet and direct OpenStreetMap tiles. The
environment validator nevertheless requires `VITE_MAPTILER_PUBLIC_KEY` when
maps are enabled. The key is not consumed by the active map component.

Before enabling maps for production, choose and certify the actual tile
provider, update attribution/rate-limit/privacy requirements, and make the
validator match the implementation.

### Medium: Google OAuth template default conflicts with its own safety comment

`.env.example` defaults `VITE_AUTH_GOOGLE_ENABLED=true` while its surrounding
comment says a provider should be enabled only after provider configuration and
complete callback testing. Staging Google OAuth has been configured, but the
example remains unsafe as a generic production starting point and public OAuth
publication is still a production gate.

### Medium: recommendation control metadata contradicts active service policy

All seven live recommendation service policies are enabled on staging:

- nearby
- personalized
- recently listed
- related products
- related services
- seller recommendations
- similar listings

The `recommendation_foundation` operational-control configuration still says
`services_enabled=false`, `orchestration_executes_services=false` and
`personalization_used=false`. Those fields are stale and can mislead operators
even though the independent services and consent boundary are active.

### Low: development Peek preview defaults on

`toursPreview` falls back to true in Vite development mode. The separate preview
fixture and auth-bypass controls remain false, and the auth bypass has private
host restrictions. This is acceptable for development but should remain
explicitly false in every deployed environment.

## 3. Live staging operational controls

The database currently contains fourteen marketplace operational controls:

Enabled:

- geocoding
- maps
- media uploads
- new accounts
- new Peek submissions
- Peek playback
- recommendation foundation
- recommendation projection
- recommendation event collection
- recommendation retention
- contextual recommendation ecosystem
- aggregate-only recommendation analytics

Disabled:

- currency conversion (`fallback_native_only`)
- listing expiry (`muted`)

This is backend readiness, not proof that the corresponding browser feature is
published. Maps, for example, are enabled in database control but disabled by
the browser environment template.

## 4. Security Advisor inventory

### Cleared

- zero anonymous-callable `SECURITY DEFINER` functions remain
- targeted notification read-state warnings are cleared
- targeted personalization preference/data-clear warnings are cleared

### Remaining authenticated definer surface

Fifty-seven authenticated-callable public `SECURITY DEFINER` functions remain:

- 34 admin functions
- 10 messaging functions
- 4 media functions
- 4 owner functions
- 2 notification-query functions
- 1 listing-submission function
- 1 Peek-reporting function
- 1 audit-writing function

These functions generally contain explicit owner, participant or admin checks,
so the advisor warning is not proof of an authorization bypass. They remain a
public privileged attack surface and should continue through the private
implementation/public invoker hardening sequence.

### Auth provider warnings

- leaked-password protection is disabled
- insufficient MFA options are enabled

Both remain production blockers. Founder/admin TOTP enrollment and provider-side
leaked-password protection are required before production administration.

### RLS-enabled tables without policies

The advisor reports 39 RLS-enabled tables without policies. Thirty-eight expose
no anonymous or authenticated table privileges and are intentionally
service-only, deferred or internal. They fail closed.

`recommendation_events_default` is the only such table retaining browser table
privileges. RLS still denies browser access because no policy permits rows, but
the redundant grants should be revoked to remove ambiguity and advisor noise.

## 5. Performance Advisor inventory

Staging currently reports 154 zero-scan indexes across 63 tables. This is an
informational signal, not a removal list:

- statistics were reset on 2026-07-15
- staging traffic is limited
- many indexes were deliberately added for foreign-key enforcement, cleanup,
  keyset pagination or future production load
- several belong to deferred domains

No index should be dropped solely because it has zero staging scans. Reassess
with production-like query plans and load evidence after the release surface is
frozen.

## 6. Workers, queues and monitoring

### Healthy or intentionally waiting

- recommendation projection queue: empty
- essential notification fanout: two completed jobs and no pending jobs
- Peek source-retention cleanup: two pending jobs, neither due before
  2026-08-06
- operational alerts: six historical critical and four historical warning
  alerts, all resolved

### Active operational issue

Seven Peek cache invalidations are due now with zero attempts. Their reasons are
`service_content_changed` and `tour_state_changed`.

The latest recorded cache-invalidation completion was 2026-07-30 06:11 UTC,
while new invalidations were created through 2026-07-30 21:01 UTC. This matches
the GitHub Actions runner failure: scheduled worker workflows are not starting.

This does not block canonical listing pages, but cached Peek/service views can
remain stale until the invalidation worker runs.

### Monitoring freshness gap

The last observability queue snapshot was recorded around 2026-07-30 19:56 UTC.
Because scheduled Actions are failing, the absence of an open alert is not
proof of current health. Monitoring execution itself is stale and must be
restored with the runner service.

## 7. GitHub Actions and release evidence

The latest complete three-suite certification remains migration `0091`.
Current `0099` workflow runs fail before runner steps begin; the release job has
no logs and `steps=null`.

Consequences:

- source, build and clean-database suites through `0099` are present but have not
  conventionally executed on the final head
- scheduled recommendation, Peek, notification and observability workflows may
  not run
- failed workflow conclusions must not be described as test failures or passes

Hosted rollback-only staging transactions remain valid evidence, but final CI
on an unchanged head is still required.

## 8. Stale or misleading repository records

The following authoritative-looking files are materially stale and should be
updated, archived or clearly marked historical:

1. `DOCUMENTS_1_TO_4_CONSOLIDATED_REPORT.md`
   - says PR #1 is merged even though it is open and draft
   - reports old migration, file, module and table counts
   - contains superseded OAuth, hosting and blocker statements

2. `docs/audit/FEATURE_INVENTORY.md`
   - records the old `/seller/:email` route instead of `/seller/:sellerId`
   - contains old test counts and obsolete Docker/Supabase blocker language

3. `artifacts/product-audit/product-surface-audit.json`
   - was generated before the seller-identifier change
   - reports the obsolete email route while claiming zero warnings
   - must be regenerated on the current head before use as release evidence

4. `docs/audit/EXTERNAL_BLOCKERS.md`
   - the external categories remain valid
   - its migration and branch evidence stops around `0082` and must be advanced
     to `0099`

5. `tests/repositoryReleaseHygiene.test.mjs`
   - checks only that the SQL boundary source still contains a historical `0091`
     marker
   - it does not prove the test knows the current `0099` release tip

## 9. Marker and placeholder audit limitation

The repository hygiene script checks merge-conflict markers, prohibited symbols
and several secret patterns. It does not scan for `TODO`, `FIXME`, `HACK`,
`XXX`, placeholders or `not implemented` markers.

GitHub code search returned no indexed matches, but this branch is not fully
indexed and a local clone could not be completed because the execution
container had no GitHub DNS resolution. A repository-wide zero-marker claim
would therefore be unsupported.

Add a deterministic source-marker audit to CI rather than relying on GitHub
search.

## 10. External release blockers still valid

- explicit production authorization and cutover ownership
- final domain, DNS, TLS, CSP/HSTS and redirect origins
- production SMTP and verified sender domain
- Google OAuth public publication and callback acceptance
- leaked-password protection, TOTP MFA and CAPTCHA/risk controls
- monitoring destinations and incident ownership
- native backup/PITR and isolated restore evidence
- independent production secrets and worker schedules
- browser, mobile-device and assistive-technology acceptance
- production-like capacity, cost and degraded-mode acceptance
- successful final CI on the unchanged release head

## Required order before migration 0100

1. Correct release-gate drift for currency conversion, phone verification,
   service radius, current location, international listing and maps.
2. Reconcile recommendation operational-control metadata with live service
   policies.
3. Restore GitHub Actions runners and drain the seven due cache invalidations.
4. Regenerate current product-surface evidence and update stale status files.
5. Add a deterministic TODO/FIXME/placeholder source audit.
6. Re-run all conventional suites through migration `0099`.
7. Resume authenticated function hardening at migration `0100` only after this
   configuration boundary is coherent.

No production project was queried or changed during this audit.