# Maps, Location and Release-Control Certification

Date: 2026-08-01
Branch: `feature/listing-intelligence-foundation`  
Staging project: `bwgklpxoetrrkutottdb`  
SQL boundary: `0108`

## Implemented stack

- Renderer: MapLibre GL JS `5.12.0`
- Map style and tile provider: MapTiler Cloud
- Consented location resolution: first-party Supabase/PostGIS registry RPC
- Marketplace spatial database: Supabase PostgreSQL/PostGIS
- Public precision: supported city level

The old Leaflet import and direct use of the public OpenStreetMap tile server
have been removed from the active source and package manifest.

## Privacy boundary

Device location is optional. The browser does not request coordinates until the
user accepts FindIt’s explicit “Allow once” explanation and the browser’s native
permission prompt. Coordinates are sent once to FindIt’s Supabase/PostGIS
resolver, are not persisted by the flow, and are used to match a supported
country, first-level administrative area and populated place. The resolver
returns only:

- country id
- country name and ISO code
- province id
- province/state/region name
- populated-place id, name and type
- source (`device`)

Home browser storage applies a second whitelist before persistence. It cannot
store latitude, longitude, coordinates or accuracy values through this flow.
Manual location remains available when permission is denied, registry lookup
fails or the user does not want to use device location. A detected country never
locks the selector; a user in Zambia can immediately browse Botswana.

## Failure isolation

- Map runtime or provider failure does not block listing search results.
- List view remains the canonical fallback.
- Current-location failure does not block manual location selection.
- International listing remains disabled for the Zimbabwe-first release.
- Currency conversion, phone verification and service radius remain disabled
  until complete contracts exist.

## Database control consistency

Migration `0100_release_control_consistency.sql` records the MapLibre/MapTiler
boundary, aligns recommendation metadata with seven enabled services and
removes redundant browser grants from `recommendation_events_default`.

Hosted validation completed:

- rollback-only migration transaction passed;
- permanent staging application passed;
- guarded ledger reconciliation passed;
- rollback capsule passed inside a non-persisted transaction;
- staging ledger is contiguous `0001` through `0100`;
- generated-version residue is zero;
- due Peek cache invalidations are zero after bounded recovery.

## Deployment requirements

A real deployed map still requires a MapTiler public browser key restricted to
the exact deployment origins. The final host must configure CSP for the pinned
MapLibre runtime, MapTiler API resources and `worker-src blob:`, or self-host the
pinned runtime assets.

Provider-side Supabase Auth hardening and conventional GitHub Actions
certification remain separate production gates.
