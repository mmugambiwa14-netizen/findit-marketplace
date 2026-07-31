# Maps, Location and Release-Control Certification

Date: 2026-07-31  
Branch: `feature/listing-intelligence-foundation`  
Staging project: `bwgklpxoetrrkutottdb`  
SQL boundary: `0100`

## Implemented stack

- Renderer: MapLibre GL JS `5.12.0`
- Map style and tile provider: MapTiler Cloud
- Reverse geocoding: MapTiler Geocoding API
- Marketplace spatial database: Supabase PostgreSQL/PostGIS
- Public precision: supported city level

The old Leaflet import and direct use of the public OpenStreetMap tile server
have been removed from the active source and package manifest.

## Privacy boundary

Device location is optional. Browser coordinates are sent to MapTiler only when
the user selects “Use my current location.” They are used to match an active
supported city. The resolver returns only:

- country id
- province id
- city id
- city name
- source (`device`)

Home browser storage applies a second whitelist before persistence. It cannot
store latitude, longitude, coordinates or accuracy values through this flow.
Manual location remains available when permission is denied, geocoding fails or
the user does not want to use device location.

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
