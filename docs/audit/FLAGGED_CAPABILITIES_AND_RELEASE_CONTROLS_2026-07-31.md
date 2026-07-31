# Flagged Capabilities and Release Controls Audit

Reviewed: 2026-07-31  
Status: repository-owned findings closed  
Branch: `feature/listing-intelligence-foundation`  
Staging project: `bwgklpxoetrrkutottdb`  
Staging SQL boundary: canonical `0001` through `0101`  
Production SQL boundary: unchanged at `0049`

## Outcome

The audit identified feature-switch, maps, operational metadata, queue,
evidence, hygiene and public privileged-function defects. Repository-owned
findings are now corrected through migrations `0100` and `0101`.

Remaining blockers require external provider configuration, GitHub Actions
runner recovery or production operational approval; they are not hidden source
or staging-schema backlog.

## Feature and map corrections

- Currency conversion, phone verification, service radius and international
  publishing are forced false until complete contracts exist.
- Payments, subscriptions, escrow, premium listings, AI automation, expiry,
  reminders, Apple OAuth and legal-commerce flows remain deliberately disabled.
- Current location is a real opt-in flow with mandatory manual fallback.
- MapLibre GL JS `5.12.0` and MapTiler Cloud replace Leaflet/direct public OSM
  tiles.
- Map failure degrades to canonical list results.
- Coordinates are sent to MapTiler only to resolve a supported city.
- The resolver and Home whitelist retain only country, province, city, city name
  and source; exact coordinates and accuracy cannot persist through this flow.
- Leaflet and `@types/leaflet` are removed from the active manifest and source.
- Environment templates, release gates and staging workflows use the same
  MapTiler and fail-closed feature boundary.

## Migration 0100: release-control consistency

`0100_release_control_consistency.sql`:

- records the MapLibre/MapTiler provider boundary;
- records city-level public precision, consent and manual fallback;
- aligns recommendation metadata with seven enabled independent services;
- records personalization availability while preserving default-off consent;
- removes redundant browser grants from `recommendation_events_default`.

The migration, rollback, pgTAP, guarded ledger reconciliation and hosted
structural evidence passed.

## Migration 0101: authenticated privileged RPC isolation

Before migration `0101`, staging had exactly 57 authenticated-callable public
`SECURITY DEFINER` functions with catalog fingerprint
`ce6194659e01b758dc20948daf351bea`.

`0101_private_authenticated_rpc_implementations.sql`:

- moves all 57 implementations into non-exposed `private` without recreating
  their bodies;
- creates 57 public SQL `SECURITY INVOKER` compatibility wrappers;
- preserves names, arguments, defaults, results, volatility, strictness,
  parallel category, cost/rows and role grants;
- preserves 57 authenticated and 53 service-role execution paths;
- leaves zero anonymous and zero `PUBLIC` wrapper grants;
- leaves zero authenticated-callable public privileged functions.

Hosted semantics verified owner notes and transitions, notifications, full
messaging/report lifecycle, participant isolation, admin reads/actions, audit
writing, fail-closed submission/media/Peek paths and suspended-account denial.
All fixtures rolled back.

The exact rollback capsule restored all 57 original functions with the precise
catalog fingerprint and zero private residue inside a non-persisted transaction.
The live postcondition was then reconfirmed as zero public authenticated
definers and 57 public invoker wrappers.

## Staging state

- canonical migration rows: 101
- minimum version: `0001`
- maximum version: `0101`
- sequence mismatches: zero
- generated-version residue: zero
- due Peek cache invalidations: zero
- anonymous-callable public privileged functions: zero
- authenticated-callable public privileged functions: zero
- semantic fixture residue: zero

Seven due cache invalidations were boundedly recovered after GitHub Actions
scheduling stopped executing. The empty queue does not prove scheduler health.

## Repository evidence and hygiene

- authoritative reports and inventory are current through `0101`;
- seller profiles use `/seller/:sellerId`;
- SQL tip contracts and both database workflows include `0101`;
- repository hygiene checks production source for TODO, FIXME, HACK, XXX,
  “not implemented,” placeholder, dummy and temporary implementation markers;
- stale product-surface output was withdrawn as generated release evidence until
  a normal final-head regeneration runs.

## Advisor status

Cleared:

- anonymous-callable public `SECURITY DEFINER` functions: zero
- authenticated-callable public `SECURITY DEFINER` functions: zero
- redundant browser grants on `recommendation_events_default`: removed

Remaining provider/informational notices:

- leaked-password protection disabled;
- insufficient MFA options enabled;
- RLS-without-policy notices on fail-closed internal/deferred tables;
- zero-scan indexes that must not be dropped without production-like query-plan
  evidence.

The available connector can read Auth advisor state but does not expose a
supported mutation for leaked-password or MFA settings.

## CI and remaining order

The last complete three-workflow GitHub Actions certification remains migration
`0091`. Current jobs still fail before executable steps begin and expose no
steps or logs. Hosted evidence covers migrations `0092` through `0101`, but
conventional final-head certification remains required.

Remaining order:

1. Restore GitHub Actions execution and run all suites through `0101` on one
   unchanged commit.
2. Configure an origin-restricted MapTiler key, approved style and final CSP.
3. Enable leaked-password protection, founder/admin TOTP MFA and CAPTCHA/risk
   controls; configure production SMTP and Google OAuth callbacks.
4. Complete production domain, monitoring, backup/PITR, device/accessibility,
   capacity and owner-approved cutover gates.

No production project was queried or changed during these corrections.
