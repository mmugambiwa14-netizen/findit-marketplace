# Flagged Capabilities and Release Controls Audit

Reviewed: 2026-07-31  
Status: repository-owned findings corrected  
Branch: `feature/listing-intelligence-foundation`  
Staging project: `bwgklpxoetrrkutottdb`  
Staging SQL boundary: canonical `0001` through `0100`  
Production SQL boundary: unchanged at `0049`

## Outcome

The pre-0100 audit identified feature-switch, maps, operational metadata,
queue, evidence and hygiene defects. Repository-owned findings have now been
corrected. Remaining items require external provider configuration, GitHub
Actions recovery or the next authenticated-function hardening sequence.

## Corrections completed

### Feature controls

- `VITE_FEATURE_CURRENCY_CONVERSION` is forced false until a real rate-provider
  contract and customer flow exist.
- `VITE_FEATURE_PHONE_VERIFICATION` is forced false until phone ownership is
  actually verified.
- `VITE_FEATURE_SERVICE_RADIUS` is forced false until a radius value, unit,
  validation and persistence contract exist.
- `VITE_FEATURE_INTERNATIONAL_LISTING` is forced false for the current
  Zimbabwe-first release.
- Current location is now a real opt-in browser flow with manual fallback.
- Google OAuth defaults false in `.env.example` and remains provider-gated.
- Payments, subscriptions, escrow, premium listings, AI automation, expiry,
  reminders, Apple OAuth and legal-commerce flows remain deliberately disabled.

### Maps stack

The old Leaflet/direct OpenStreetMap-tile path has been replaced with:

- MapLibre GL JS `5.12.0`
- MapTiler Cloud vector styles
- MapTiler reverse geocoding
- Supabase/PostGIS spatial data

The environment validator now requires a non-placeholder
`VITE_MAPTILER_PUBLIC_KEY` and valid `VITE_MAPTILER_STYLE_ID` when maps or
current location are enabled. Map failures degrade to the canonical listing
view rather than blocking results.

Device coordinates are used only to match an active supported city. The
location selector does not persist exact coordinates and manual selection
remains a required fallback.

Leaflet and `@types/leaflet` are removed from the active package manifest and
no active map source imports Leaflet.

### Migration 0100

`0100_release_control_consistency.sql`:

- records MapLibre/MapTiler as the certified maps provider boundary;
- records city-level public precision and no exact-coordinate exposure;
- aligns recommendation operational metadata with seven enabled independent
  services;
- records personalization as available but default-off and consent-gated;
- removes redundant anonymous and authenticated table grants from
  `recommendation_events_default` while preserving service-role access.

The migration has an exact rollback capsule, pgTAP coverage, source contracts,
a guarded staging-ledger reconciliation and hosted evidence.

### Staging state

- migration rows: 100
- minimum version: `0001`
- maximum version: `0100`
- sequence mismatches: zero
- generated-version residue: zero
- due Peek cache invalidations: zero

Seven previously due invalidations were boundedly claimed and finalized after
GitHub Actions scheduling stopped executing.

### Repository evidence and hygiene

- stale consolidated migration report replaced;
- feature inventory advanced to `/seller/:sellerId`, migration `0100` and the
  MapLibre/MapTiler stack;
- external blockers advanced to the current boundary;
- SQL tip contract advanced to `0100`;
- repository hygiene now scans production source for TODO, FIXME, HACK, XXX,
  “not implemented,” placeholder, dummy and temporary implementation markers;
- GitHub searches found no indexed matches for those marker classes, while the
  new gate provides deterministic full-tree enforcement.

## Security Advisor status

Cleared:

- anonymous-callable public `SECURITY DEFINER` functions: zero
- redundant browser grants on `recommendation_events_default`: removed

Remaining:

- 57 authenticated-callable public definer functions, to continue through the
  private implementation/public invoker sequence beginning at migration `0101`;
- leaked-password protection disabled;
- insufficient MFA options enabled;
- informational RLS-without-policy notices on fail-closed internal/deferred
  tables;
- informational zero-scan indexes that must not be dropped without
  production-like query-plan evidence.

The current connector can read Auth advisor state but does not expose a
supported mutation for leaked-password or MFA settings. Those remain explicit
provider-side production gates.

## CI and operations

The last complete three-workflow GitHub Actions certification remains the
`0091` boundary. Later migrations have hosted staging evidence, but recent
workflows fail before runner steps begin. Final source, build and clean-database
certification through `0100` is still required on one unchanged commit.

Manual queue recovery closes the existing backlog but does not prove scheduler
health. Scheduled worker and observability execution must be restored.

## Remaining order

1. Restore GitHub Actions execution and run all conventional suites through
   `0100`.
2. Configure a protected, origin-restricted MapTiler key and approved style for
   each deployment environment.
3. Enable leaked-password protection, TOTP MFA and CAPTCHA/risk controls in
   Supabase Auth; configure production SMTP and public Google OAuth callbacks.
4. Continue the 57 authenticated-function hardening backlog at migration
   `0101`.
5. Complete production domain, monitoring, backup/PITR, device acceptance,
   capacity and owner-approved cutover gates.

No production project was queried or changed during these corrections.
