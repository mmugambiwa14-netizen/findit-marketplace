# CATEGORY TREE — reconstructed from database + runtime

**Audited ref:** `origin/main` @ `ee6f212` · Live DB unverified (E-004) — this is the *migration-defined* tree.

## Axis 1 — `public.categories` (authoritative for listing submission)

Schema (`0016_v1_admin_operations.sql:13-27`):

| Column | Definition |
|---|---|
| `slug` | `check (slug ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')` |
| `parent_id` | self-FK, `on delete restrict` |
| `marketplace_kind` | `check in ('property','car','machinery','service')` |
| `display_label` | length 2-80 |
| `sort_order` | 0-10000 |
| `is_active`, `is_protected` | booleans; roots are protected |
| uniqueness | `unique nulls not distinct (parent_id, slug)` |

`create_v1_listing_submission` (`0046`) accepts a category only when
`slug = <input> and marketplace_kind = <kind> and parent_id is not null and is_active`.
**Only leaf categories are postable**, and the slug must match the listing kind.

Roots (`0016:69-73`, all `is_protected = true`): `property`/property, `vehicles`/car,
`machinery`/machinery, `services`/service.


### `property` → `marketplace_kind = property` — 90 leaf categories

_Abbreviated for readability; full list in `0016_v1_admin_operations.sql:75-175`._

| group | slugs |
|---|---|
| Residential sale/rent | `house_sale` `house_rent` `apartment_sale` `apartment_rent` `townhouse` `duplex` `cottage` `cluster` `bachelor` `penthouse` `studio_apartment` `granny_flat` `serviced_apartment` `shared_house` `commuter_room` `timeshare` `houseboat` `treehouse` |
| Student & care | `student_room` `student_studio` `student_apartment` `postgrad_accommodation` `hostel` `backpackers_hostel` `retirement_home` `assisted_living` `childcare_facility` |
| Hospitality | `bnb` `guesthouse` `guest_house_business` `hotel` `motel` `lodge` `resort` `chalet` `safari_camp` `safari_tent` `bush_camp` `game_lodge_residence` `glamping_site` `guest_farm` |
| Commercial & industrial | `office` `retail` `warehouse` `storage` `parking` `factory` `workshop` `showroom` `restaurant_space` `takeaway_space` `coworking_space` `data_centre` `petrol_station` `car_wash_facility` `medical_rooms` `dental_practice` `veterinary_clinic` `salon_spa` `gym_studio` `school_building` `place_of_worship` `embassy_consulate_space` `embassy_residence` |
| Land & agricultural (Zimbabwe-specific) | `land_sale` `farm` `agricultural` `game_farm` `smallholding` `commercial_plot` `residential_stand` `surveyed_stands` `mining_claims` `irrigation_land` `communal_land` `resettlement_farm` `a1_farm` `a2_farm` `old_commercial_farm` |
| Venues & events | `venue` `conference` `wedding_venue` `party_venue` `outdoor_venue` `sports_facility` `stadium` `exhibition_space` `filming_location` `drive_in_space` |
| Fallback | `property_other` |

### `vehicles` → `marketplace_kind = car` — 15 leaf categories

| # | slug | display label |
|---:|---|---|
| 1 | `cars_sale` | Cars for Sale |
| 2 | `cars_rent` | Cars for Rent |
| 3 | `minibus_kombi` | Minibuses & Kombis |
| 4 | `motorbike` | Motorbikes |
| 5 | `scooter` | Scooters & Mopeds |
| 6 | `bicycle` | Bicycles |
| 7 | `caravan_trailer` | Caravans & Trailers |
| 8 | `utility` | Utility / Bakkies |
| 9 | `van` | Vans & Panel Vans |
| 10 | `luxury_classic` | Luxury & Classic |
| 11 | `spare_parts` | Spare Parts & Accessories |
| 12 | `tyres_rims` | Tyres & Rims |
| 13 | `truck_lorry` | Trucks & Lorries |
| 14 | `bus_coach` | Buses & Coaches |
| 15 | `car_other` | Other Vehicle |

### `machinery` → `marketplace_kind = machinery` — 12 leaf categories

| # | slug | display label |
|---:|---|---|
| 1 | `heavy_vehicles` | Heavy Vehicles |
| 2 | `construction` | Construction Equipment |
| 3 | `agricultural` | Agricultural Machinery |
| 4 | `mining` | Mining Equipment |
| 5 | `material_handling` | Material Handling |
| 6 | `generators` | Generators |
| 7 | `compaction` | Compaction Equipment |
| 8 | `lifting` | Lifting Equipment |
| 9 | `surface_prep` | Surface Preparation |
| 10 | `welding` | Welding & Fabrication |
| 11 | `boats` | Boats & Marine |
| 12 | `machinery_other` | Other Machinery |

### `services` → `marketplace_kind = service` — 4 leaf categories

| # | slug | display label |
|---:|---|---|
| 1 | `property_developer` | Property Developer |
| 2 | `mechanic` | Mechanic |
| 3 | `construction` | Construction |
| 4 | `geological` | Geological & Surveying |

**Totals:** property 90, vehicles 15, machinery 12, services 4 = **121 leaf categories** plus 4 protected roots.

## Assessed strength — Zimbabwe land-tenure fit

The property tree carries genuinely market-specific land categories that a generic marketplace taxonomy
would not have: `a1_farm`, `a2_farm`, `resettlement_farm`, `communal_land`, `old_commercial_farm`,
`mining_claims`, `irrigation_land`, `surveyed_stands`, `residential_stand`. This reflects real Zimbabwean
land-tenure structure and is recorded as a product strength.

## Duplicate slugs across parents — correctly handled, not a defect

| slug | appears under | disambiguated by |
|---|---|---|
| `agricultural` | `property` ("Agricultural Land") and `machinery` ("Agricultural Machinery") | `marketplace_kind` |
| `construction` | `machinery` ("Construction Equipment") and `services` ("Construction") | `marketplace_kind` |

`unique nulls not distinct (parent_id, slug)` permits this, and the submission RPC matches on
`slug AND marketplace_kind`, so the pair always resolves to exactly one row. **No finding.**

## Modelling oddity — non-vehicle items under `listing_kind = 'car'`

`spare_parts`, `tyres_rims` and `bicycle` are leaves of `vehicles`, so a listing in those categories is
`listing_kind = 'car'` and is written to `car_details` (`brand`, `model`, `year`, `mileage`, `fuel_type`,
`transmission`, `condition`). Mileage, fuel type and transmission are meaningless for a tyre or a bicycle.
Low impact — the columns are nullable — but it degrades filter quality in those categories.
→ **F-024 (P3)**

## Axis 2 — `src/domain/listingSchema/` registry (DEAD — see F-019)

Not reachable from any live code path. Recorded for completeness.

| Category | `marketplace_kind` | Subtypes |
|---|---|---|
| Property | `property` | 5 — residential, commercial, industrial, agricultural, land |
| Vehicles | `car` | 7 — car, bakkie, suv, van, truck, motorcycle, trailer |
| Machinery | `machinery` | 10 — excavator, loader, bulldozer, grader, crane, forklift, tipper, tractor, generator, compressor |
| Services | `service` | 4 — property_developer, mechanic, construction, geological |

`SCHEMA_VERSION = 1` (`registry.js:19`).

## Axis 3 — `listing_kind` enum (`0001:14`)

`('car', 'property', 'machinery')` — **services are not a `listing_kind`**; they live in the separate
`public.services` table. "Four verticals" is therefore three listing kinds plus a parallel services entity.

## Drift assessment

| Comparison | Verdict |
|---|---|
| `categories.marketplace_kind` vs registry `CATEGORY_IDS` | **Aligned** — both are `property, car, machinery, service` |
| `categories` slugs vs registry subtypes | **Not comparable** — different granularity, different axes, and the registry side is dead |
| `categories` vs `listing_kind` enum | **Aligned**; `service` intentionally outside the enum |
| Leaf coverage across the four verticals | **Complete** — all four have active leaves. An earlier suspicion (F-024) that car/machinery lacked leaves was **withdrawn** after full extraction; only 15/12 vs 90 property leaves, an imbalance in depth rather than a gap. |
