/**
 * Seed the staging catalogue with ordinary marketplace records.
 *
 * This intentionally writes only catalogue data. It does not write
 * recommendation results, recommendation weights, or map aggregates; the
 * database triggers and services must derive those from the inserted records.
 * The script is scoped to the staging admin fixture owner and is safe to
 * rerun because all IDs are derived from the seed namespace.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.FINDIT_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.FINDIT_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.FINDIT_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const FFMPEG_PATH = process.env.FFMPEG_PATH;
const ADMIN_ID = "97965916-11ee-4d94-894d-fe66f58a11ab";
const SEED_NAMESPACE = "peekalisting-staging-catalogue-2026-08";
const COUNTRY_CODE = "ZW";
const MODE = process.argv[2] ?? "default";
const EMIT_CATALOGUE_SQL = MODE === "emit-catalogue-sql";
const EMIT_TOURS_SQL = MODE === "emit-tours-sql";
const DIRECT_SEED = MODE === "seed";
const EMIT_SQL_MODE = EMIT_CATALOGUE_SQL || EMIT_TOURS_SQL;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("FINDIT_SUPABASE_URL and FINDIT_SUPABASE_ANON_KEY are required");
}
if (!EMIT_SQL_MODE && !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("FINDIT_SUPABASE_SECRET_KEY is required for direct privileged writes");
}
if (EMIT_TOURS_SQL && (!FFMPEG_PATH || !fs.existsSync(FFMPEG_PATH))) {
  throw new Error("FFMPEG_PATH must point to the ffmpeg executable used for staging media");
}

const root = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let supabase = root;

const PROPERTY_CATEGORY_PLAN = [
  "house_sale",
  "house_rent",
  "apartment_sale",
  "apartment_rent",
  "townhouse",
  "duplex",
  "cottage",
  "bachelor",
  "studio_apartment",
  "student_room",
  "office",
  "retail",
  "warehouse",
  "land_sale",
  "surveyed_stands",
];

const CAR_CATEGORY_PLAN = [
  "cars_sale",
  "cars_rent",
  "minibus_kombi",
  "motorbike",
  "scooter",
  "bicycle",
  "caravan_trailer",
  "utility",
  "van",
  "luxury_classic",
  "spare_parts",
  "tyres_rims",
  "truck_lorry",
  "bus_coach",
  "car_other",
];

const MACHINERY_CATEGORY_PLAN = [
  "heavy_vehicles",
  "construction",
  "agricultural",
  "mining",
  "material_handling",
  "generators",
  "compaction",
  "lifting",
  "surface_prep",
  "welding",
  "boats",
  "machinery_other",
  "construction",
  "agricultural",
  "generators",
];

const SERVICE_CATEGORY_PLAN = [
  "maintenance_repair",
  "pre_purchase_inspection",
  "general_contracting",
  "plumbing",
  "land_surveying",
  "machinery_repair",
  "plant_hire",
  "roadside_assistance",
  "electrical_installation",
  "roofing",
  "cadastral_survey",
  "solar_installation",
  "property_management",
  "operator_hire",
  "geological_consultancy",
];

const REQUIRED_TAXONOMY = [
  ["property", "house_sale"],
  ["property", "house_rent"],
  ["property", "apartment_sale"],
  ["property", "apartment_rent"],
  ["car", "cars_sale"],
  ["car", "cars_rent"],
  ["car", "minibus_kombi"],
  ["car", "utility"],
  ["machinery", "construction"],
  ["machinery", "agricultural"],
  ["machinery", "mining"],
  ["machinery", "generators"],
  ["service", "maintenance_repair"],
  ["service", "pre_purchase_inspection"],
  ["service", "general_contracting"],
  ["service", "plumbing"],
  ["service", "land_surveying"],
  ["service", "machinery_repair"],
];

const CITY_PLAN = [
  "Harare",
  "Bulawayo",
  "Mutare",
  "Gweru",
  "Kwekwe",
  "Masvingo",
  "Marondera",
  "Chitungwiza",
  "Victoria Falls",
  "Kadoma",
  "Hwange",
  "Chinhoyi",
  "Zvishavane",
  "Ruwa",
  "Beitbridge",
];

const PHOTO_POOLS = {
  property: [
    "https://images.unsplash.com/photo-1564013799919-ab600027ffc6",
    "https://images.unsplash.com/photo-1560185008-b033106af5c3",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
    "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea",
    "https://images.unsplash.com/photo-1600585154526-990dced4db0d",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750",
    "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde",
    "https://images.unsplash.com/photo-1600607688969-a5bfcd646154",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3",
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0",
    "https://images.unsplash.com/photo-1600573472550-8090b5e0745e",
    "https://images.unsplash.com/photo-1600585152915-d208bec867a1",
    "https://images.unsplash.com/photo-1600566753051-1f6eacb857e1",
  ],
  car: [
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7",
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
    "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd",
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d",
    "https://images.unsplash.com/photo-1560958089-b8a1929cea89",
    "https://images.unsplash.com/photo-1580273916550-e323be2ae537",
    "https://images.unsplash.com/photo-1511919884226-fd3cad34687c",
    "https://images.unsplash.com/photo-1542362567-b07e54358753",
    "https://images.unsplash.com/photo-1485291571150-772bcfc10da5",
    "https://images.unsplash.com/photo-1502877338535-766e1452684a",
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8",
    "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d",
    "https://images.unsplash.com/photo-1553440569-bcc63803a83d",
    "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf",
    "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
  ],
  machinery: [
    "https://images.pexels.com/photos/11973729/pexels-photo-11973729.jpeg",
    "https://images.pexels.com/photos/7910068/pexels-photo-7910068.jpeg",
    "https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg",
    "https://images.pexels.com/photos/162553/loader-construction-site-heavy-162553.jpeg",
    "https://images.pexels.com/photos/1199055/pexels-photo-1199055.jpeg",
    "https://images.pexels.com/photos/159298/tractor-agriculture-machine-159298.jpeg",
    "https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg",
    "https://images.pexels.com/photos/1631677/pexels-photo-1631677.jpeg",
    "https://images.pexels.com/photos/2101137/pexels-photo-2101137.jpeg",
    "https://images.pexels.com/photos/219906/pexels-photo-219906.jpeg",
    "https://images.pexels.com/photos/1238864/pexels-photo-1238864.jpeg",
    "https://images.pexels.com/photos/450516/pexels-photo-450516.jpeg",
    "https://images.pexels.com/photos/1592983/pexels-photo-1592983.jpeg",
    "https://images.pexels.com/photos/2760241/pexels-photo-2760241.jpeg",
    "https://images.pexels.com/photos/7064667/pexels-photo-7064667.jpeg",
  ],
  service: [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952",
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e",
    "https://images.unsplash.com/photo-1521791055366-0d553872125f",
    "https://images.unsplash.com/photo-1556761175-b413da4baf72",
    "https://images.unsplash.com/photo-1531482615713-2afd69097998",
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952",
    "https://images.unsplash.com/photo-1551836022-d5d88e9218df",
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf",
    "https://images.unsplash.com/photo-1556761175-4b46a572b786",
    "https://images.unsplash.com/photo-1521737711867-e3b97375f902",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7",
    "https://images.unsplash.com/photo-1552664730-d307ca884978",
    "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d",
  ],
};

const PROPERTY_PROFILES = [
  ["family house", 4, 3, 320, "solar backup, borehole, fitted kitchen, double garage"],
  ["garden townhouse", 3, 2, 210, "private garden, secure complex, covered parking, fibre ready"],
  ["sunny apartment", 2, 2, 120, "balcony, lift access, backup power, secure parking"],
  ["compact apartment", 1, 1, 68, "built-in cupboards, communal garden, controlled access"],
  ["executive townhouse", 4, 3, 285, "staff quarters, swimming pool, solar geyser, borehole"],
  ["split-level duplex", 3, 2, 190, "open-plan kitchen, study, patio, private courtyard"],
  ["country cottage", 3, 2, 175, "fireplace, veranda, mature trees, water tank"],
  ["modern bachelor flat", 1, 1, 46, "fitted kitchenette, secure entry, prepaid power"],
  ["studio apartment", 1, 1, 52, "city views, fibre internet, lift, basement parking"],
  ["student room", 1, 1, 24, "furnished, shared kitchen, Wi-Fi, near transport"],
  ["serviced office suite", 0, 1, 90, "reception, meeting room, generator, parking"],
  ["street-front retail unit", 0, 1, 150, "display frontage, loading access, customer parking"],
  ["distribution warehouse", 0, 2, 850, "roller doors, yard, three-phase power, offices"],
  ["residential land parcel", 0, 0, 1800, "serviced stand, road access, title documentation"],
  ["surveyed building stand", 0, 0, 1200, "survey pegs, water connection, electricity nearby"],
];

const CAR_PROFILES = [
  ["Toyota", "Fortuner 2.8", 2021, 68000, "diesel", "automatic", "excellent", "SUV"],
  ["Honda", "Fit Hybrid", 2019, 72000, "hybrid", "automatic", "good", "hatchback"],
  ["Mazda", "CX-5 AWD", 2020, 59000, "petrol", "automatic", "excellent", "SUV"],
  ["Nissan", "Serena Highway Star", 2018, 104000, "petrol", "automatic", "good", "minibus"],
  ["Yamaha", "MT-07", 2022, 9100, "petrol", "manual", "excellent", "motorbike"],
  ["Honda", "PCX 150", 2021, 8400, "petrol", "automatic", "good", "scooter"],
  ["Trek", "Marlin 7", 2023, 500, "human", "manual", "excellent", "bicycle"],
  ["Loadstar", "Double Cab 4x4", 2017, 132000, "diesel", "manual", "good", "utility"],
  ["Ford", "Transit Custom", 2019, 88000, "diesel", "manual", "good", "van"],
  ["Mercedes-Benz", "W123 Classic", 1985, 146000, "petrol", "automatic", "restored", "classic"],
  ["Bosch", "Professional Service Kit", 2024, 0, "n/a", "n/a", "new", "spare parts"],
  ["Ridgeway", "Alloy Wheel Set", 2024, 0, "n/a", "n/a", "new", "tyres and rims"],
  ["Hino", "500 Series Truck", 2016, 182000, "diesel", "manual", "good", "truck"],
  ["Isuzu", "Urban Coach", 2015, 210000, "diesel", "manual", "good", "bus"],
  ["Suzuki", "Swift Sport", 2020, 44000, "petrol", "manual", "excellent", "hatchback"],
];

const MACHINERY_PROFILES = [
  ["Volvo", "A40 Articulated Hauler", "excellent", 2020, 4100, "haulage"],
  ["Caterpillar", "D6 Bulldozer", "good", 2018, 6200, "earthmoving"],
  ["John Deere", "5075E Tractor", "excellent", 2021, 1800, "farming"],
  ["Komatsu", "PC210 Excavator", "good", 2017, 7350, "excavation"],
  ["Toyota", "8FG25 Forklift", "good", 2019, 3400, "material handling"],
  ["FG Wilson", "P110 Generator", "excellent", 2022, 900, "backup power"],
  ["Bomag", "BW213 Roller", "good", 2016, 4800, "road compaction"],
  ["Genie", "S-65 Boom Lift", "excellent", 2020, 2600, "access and lifting"],
  ["Husqvarna", "PG 450 Grinder", "new", 2024, 120, "surface preparation"],
  ["Lincoln Electric", "Power MIG 350", "excellent", 2023, 300, "welding"],
  ["Yamaha", "Workboat 24", "good", 2018, 1250, "marine operations"],
  ["JCB", "3CX Backhoe Loader", "good", 2017, 5700, "general plant"],
  ["Caterpillar", "336 Excavator", "good", 2019, 5100, "quarry work"],
  ["Massey Ferguson", "6713 Tractor", "excellent", 2022, 1100, "crop production"],
  ["Perkins", "P150 Standby Generator", "new", 2024, 80, "industrial power"],
];

const PEEK_CATEGORIES = [
  "condition",
  "operation",
  "close_up",
  "measurements",
  "surroundings",
  "availability",
  "demonstration",
  "documentation",
  "custom",
];

const SERVICE_PRICING = ["starting_from", "hourly", "quote", "daily", "fixed"];
const SERVICE_DELIVERY = [
  "fixed_and_mobile",
  "travels_to_customer",
  "fixed_location",
  "remote",
];

function uuidFor(key) {
  const digest = crypto.createHash("sha256").update(`${SEED_NAMESPACE}:${key}`).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function photoUrl(base, index, slot) {
  const crop = slot === 0 ? "fit=crop" : "fit=fill";
  const width = slot === 0 ? 1600 : 1200;
  const query = base.includes("pexels.com")
    ? `?auto=compress&cs=tinysrgb&w=${width}`
    : `?auto=format&${crop}&fm=jpg&q=84&w=${width}&ixlib=rb-4.1.0`;
  return `${base}${query}&catalogue=${SEED_NAMESPACE}-${index}-${slot}`;
}

function asNumber(value) {
  return Number(value ?? 0);
}

function cityFor(index, locations) {
  return locations[index % locations.length];
}

function coordinateFor(location, index) {
  const lat = asNumber(location.latitude);
  const lon = asNumber(location.longitude);
  const latOffset = ((index % 5) - 2) * 0.003;
  const lonOffset = (((index + 2) % 5) - 2) * 0.003;
  return { latitude: lat + latOffset, longitude: lon + lonOffset };
}

function dateFor(index) {
  const date = new Date(Date.now() - (index + 1) * 36 * 60 * 60 * 1000);
  return date.toISOString();
}

function safeSlugLabel(slug) {
  return slug.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function listingTypeFor(slug, index) {
  if (slug.includes("rent")) return "rent";
  if (slug.includes("sale")) return "sale";
  return index % 3 === 0 ? "rent" : "sale";
}

function propertyDetailTypeFor(category) {
  if (category.includes("house")) return "house";
  if (["apartment_sale", "apartment_rent", "bachelor", "studio_apartment", "student_room"].includes(category)) return "apartment";
  if (category === "townhouse") return "townhouse";
  if (category === "cottage") return "cottage";
  if (category === "office") return "office";
  if (category === "retail") return "retail";
  if (category === "warehouse") return "warehouse";
  if (["land_sale", "surveyed_stands"].includes(category)) return "stand";
  return "other";
}

function machineryDetailTypeFor(category) {
  const mapped = {
    heavy_vehicles: "transport",
    construction: "excavator",
    agricultural: "tractor",
    mining: "industrial",
    material_handling: "forklift",
    generators: "generator",
    compaction: "grader",
    lifting: "crane",
    surface_prep: "industrial",
    welding: "industrial",
    boats: "transport",
    machinery_other: "other",
  };
  return mapped[category] ?? "other";
}

function carDetailValueFor(profile, index) {
  const body = profile[7];
  const fuel = profile[4] === "human" || profile[4] === "n/a" ? null : profile[4];
  const transmission = profile[5] === "n/a" ? null : profile[5];
  const year = index >= 10 && body !== "spare parts" && body !== "tyres and rims" ? profile[2] : profile[2];
  return { fuel, transmission, year };
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(value, json = false) {
  if (value === null || value === undefined) return "NULL";
  if (json) return `${sqlString(JSON.stringify(value))}::jsonb`;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return sqlString(value);
}

function buildInsertSql(table, rows, columns, jsonColumns, conflictColumns = ["id"]) {
  const values = rows.map((row) =>
    `(${columns.map((column) => sqlValue(row[column], jsonColumns.has(column))).join(", ")})`,
  );
  const updates = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${column} = excluded.${column}`)
    .join(",\n  ");
  return `insert into public.${table} (${columns.join(", ")})\nvalues\n${values.join(",\n")}\non conflict (${conflictColumns.join(", ")}) do update set\n  ${updates};`;
}

function buildCatalogueSql(listingData, serviceData) {
  const listingColumns = [
    "id", "kind", "seller_id", "seller_name", "contact_phone", "contact_whatsapp", "contact_email",
    "title", "description", "price", "currency", "deposit", "accepts_offers", "variants", "photos",
    "location_id", "latitude", "longitude", "category", "listing_type", "status", "created_via",
    "verified", "views", "country_code", "public_latitude", "public_longitude", "public_location_label",
    "location_visibility", "attributes", "created_at", "updated_at",
  ];
  const listingJson = new Set(["variants", "photos", "attributes"]);
  const propertyColumns = ["listing_id", "property_type", "bedrooms", "bathrooms", "size_sqm"];
  const carColumns = ["listing_id", "brand", "model", "year", "mileage", "fuel_type", "transmission", "condition"];
  const machineryColumns = ["listing_id", "machinery_type", "brand", "model", "condition", "year", "usage_hours"];
  const serviceColumns = [
    "id", "provider_id", "provider_name", "contact_phone", "contact_whatsapp", "contact_email", "title", "description",
    "category", "subcategory", "subcategories", "price", "currency", "pricing_type", "photos", "location_id", "location_name",
    "can_travel", "status", "verified", "views", "country_code", "base_location_id", "delivery_mode", "service_radius_km",
    "remote_available", "fixed_premises", "location_visibility", "attributes", "created_at", "updated_at",
  ];
  const serviceJson = new Set(["subcategories", "photos", "attributes"]);
  const peeks = buildPeeks([...listingData.catalogueParents, ...serviceData.catalogueParents]);
  const peekColumns = [
    "id", "listing_id", "service_id", "requester_id", "category", "body", "status", "supporter_count",
    "moderation_status", "moderation_reason", "created_at", "updated_at",
  ];
  const sections = {
    listings: buildInsertSql("listings", listingData.rows, listingColumns, listingJson),
    property: buildInsertSql("listings", listingData.rows.filter((row) => row.kind === "property"), listingColumns, listingJson),
    car: buildInsertSql("listings", listingData.rows.filter((row) => row.kind === "car"), listingColumns, listingJson),
    machinery: buildInsertSql("listings", listingData.rows.filter((row) => row.kind === "machinery"), listingColumns, listingJson),
    details: [
      buildInsertSql("property_details", listingData.propertyDetails, propertyColumns, new Set(), ["listing_id"]),
      buildInsertSql("car_details", listingData.carDetails, carColumns, new Set(), ["listing_id"]),
      buildInsertSql("machinery_details", listingData.machineryDetails, machineryColumns, new Set(), ["listing_id"]),
    ].join("\n\n"),
    services: buildInsertSql("services", serviceData.services, serviceColumns, serviceJson),
    peeks: buildInsertSql("peek_requests", peeks, peekColumns, new Set()),
  };
  const requestedSection = process.argv[3] ?? "all";
  const selected = requestedSection === "all"
    ? [sections.listings, sections.details, sections.services, sections.peeks]
    : sections[requestedSection]
      ? [sections[requestedSection]]
      : null;
  if (!selected) throw new Error(`unknown catalogue SQL section: ${requestedSection}`);
  return [
    "begin;",
    `select set_config('request.jwt.claim.sub', ${sqlString(ADMIN_ID)}, true);`,
    ...selected,
    "commit;",
  ].join("\n\n");
}

async function upsertInChunks(table, rows, options = {}) {
  for (const group of chunk(rows, 20)) {
    const { error } = await supabase.from(table).upsert(group, options);
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

async function fetchTaxonomy() {
  const { data, error } = await supabase
    .from("categories")
    .select("id,slug,display_label,marketplace_kind,parent_id,node_type,is_active,is_postable")
    .eq("is_active", true);
  if (error) throw new Error(`taxonomy query failed: ${error.message}`);

  const byKey = new Map(data.map((row) => [`${row.marketplace_kind}:${row.slug}`, row]));
  const missing = REQUIRED_TAXONOMY.filter(
    ([kind, slug]) => !byKey.get(`${kind}:${slug}`)?.is_postable,
  );
  if (missing.length) {
    throw new Error(`taxonomy guard failed; missing active postable rows: ${JSON.stringify(missing)}`);
  }

  for (const [kind, plan] of [
    ["property", PROPERTY_CATEGORY_PLAN],
    ["car", CAR_CATEGORY_PLAN],
    ["machinery", MACHINERY_CATEGORY_PLAN],
    ["service", SERVICE_CATEGORY_PLAN],
  ]) {
    const absent = plan.filter((slug) => !byKey.get(`${kind}:${slug}`)?.is_postable);
    if (absent.length) throw new Error(`seed category plan contains invalid ${kind} slugs: ${absent.join(", ")}`);
  }
  return { rows: data, byKey };
}

async function fetchLocations() {
  const { data, error } = await supabase
    .from("locations")
    .select("id,name,latitude,longitude,type,country_code")
    .eq("country_code", COUNTRY_CODE)
    .in("name", CITY_PLAN);
  if (error) throw new Error(`location query failed: ${error.message}`);

  const typeRank = { city: 0, town: 1, province: 2, village: 3 };
  const chosen = [];
  for (const city of CITY_PLAN) {
    const candidates = data
      .filter(
        (row) =>
          row.name.toLowerCase() === city.toLowerCase() &&
          row.latitude !== null &&
          row.longitude !== null,
      )
      .sort((a, b) => (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9));
    if (candidates[0]) chosen.push(candidates[0]);
  }
  if (chosen.length < 12) {
    throw new Error(`location guard failed; only ${chosen.length} mapped Zimbabwe locations were found`);
  }
  return chosen;
}

function serviceParentCategory(slug, taxonomyRows) {
  const byId = new Map(taxonomyRows.map((row) => [row.id, row]));
  let row = taxonomyRows.find((candidate) => candidate.marketplace_kind === "service" && candidate.slug === slug);
  const chain = [];
  for (let guard = 0; row && guard < 8; guard += 1) {
    chain.push(row.slug);
    row = byId.get(row.parent_id);
  }
  if (chain.includes("mechanic")) return "mechanic";
  if (chain.includes("geological")) return "geological";
  if (chain.includes("property_developer")) return "property_developer";
  if (chain.includes("construction")) return "construction";
  if (["machinery_repair", "plant_hire", "operator_hire", "machinery_transport"].includes(slug)) {
    return "construction";
  }
  if (slug === "property_management") return "property_developer";
  if (["land_surveying", "cadastral_survey", "geological_consultancy"].includes(slug)) {
    return "geological";
  }
  throw new Error(`could not resolve service parent category for ${slug}; chain=${chain.join("/")}`);
}

function buildListings(locations) {
  const rows = [];
  const propertyDetails = [];
  const carDetails = [];
  const machineryDetails = [];
  const catalogueParents = [];

  for (let index = 0; index < 15; index += 1) {
    const location = cityFor(index, locations);
    const coordinates = coordinateFor(location, index);
    const profile = PROPERTY_PROFILES[index];
    const category = PROPERTY_CATEGORY_PLAN[index];
    const listingType = listingTypeFor(category, index);
    const id = uuidFor(`listing:property:${index + 1}`);
    const date = dateFor(index);
    const price = listingType === "rent" ? 450 + index * 115 : 68000 + index * 18500;
    const title = `${profile[0][0].toUpperCase()}${profile[0].slice(1)} ${listingType === "rent" ? "to Rent" : "for Sale"} in ${location.name}`;
    rows.push({
      id,
      kind: "property",
      seller_id: ADMIN_ID,
      seller_name: `Admin Property Catalogue ${String(index + 1).padStart(2, "0")}`,
      contact_phone: `+263 77 100 ${String(index + 1).padStart(4, "0")}`,
      contact_whatsapp: `+263 77 100 ${String(index + 1).padStart(4, "0")}`,
      contact_email: `staging-property-${index + 1}@findit.invalid`,
      title,
      description: `${title}. This staging record includes ${profile[1]} bedrooms, ${profile[2]} bathrooms and approximately ${profile[3]} square metres. Highlights: ${profile[4]}. Location is mapped to the ${location.name} area; viewings, documentation and availability are subject to the seller conversation.`,
      price,
      currency: "USD",
      deposit: listingType === "rent" ? price : null,
      accepts_offers: index % 2 === 0,
      variants: [{ label: listingType === "rent" ? "monthly" : "asking price", value: price }],
      photos: [
        photoUrl(PHOTO_POOLS.property[index], index, 0),
        photoUrl(PHOTO_POOLS.property[(index + 5) % 15], index, 1),
      ],
      location_id: location.id,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      category,
      listing_type: listingType,
      status: "available",
      created_via: "developer",
      verified: true,
      views: 6 + index * 9,
      country_code: COUNTRY_CODE,
      public_latitude: coordinates.latitude,
      public_longitude: coordinates.longitude,
      public_location_label: `${location.name} area`,
      location_visibility: "approximate",
      attributes: {
        version: 1,
        values: {
          seed_namespace: SEED_NAMESPACE,
          category_slug: category,
          listing_type: listingType,
          property_type: profile[0],
          bedrooms: profile[1],
          bathrooms: profile[2],
          size_sqm: profile[3],
          amenities: profile[4].split(", "),
          mapped_city: location.name,
        },
      },
      created_at: date,
      updated_at: date,
    });
    propertyDetails.push({ listing_id: id, property_type: propertyDetailTypeFor(category), bedrooms: profile[1], bathrooms: profile[2], size_sqm: profile[3] });
    catalogueParents.push({ parentType: "listing", kind: "property", id, index, title, photos: rows.at(-1).photos });
  }

  for (let index = 0; index < 15; index += 1) {
    const location = cityFor(index + 3, locations);
    const coordinates = coordinateFor(location, index + 20);
    const profile = CAR_PROFILES[index];
    const category = CAR_CATEGORY_PLAN[index];
    const listingType = listingTypeFor(category, index + 1);
    const id = uuidFor(`listing:car:${index + 1}`);
    const date = dateFor(index + 15);
    const price = index >= 10 ? 180 + index * 75 : 6800 + index * 2800;
    const title = `${profile[0]} ${profile[1]} ${listingType === "rent" ? "Hire" : "Available"} — ${location.name}`;
    rows.push({
      id,
      kind: "car",
      seller_id: ADMIN_ID,
      seller_name: `Admin Auto Catalogue ${String(index + 1).padStart(2, "0")}`,
      contact_phone: `+263 77 200 ${String(index + 1).padStart(4, "0")}`,
      contact_whatsapp: `+263 77 200 ${String(index + 1).padStart(4, "0")}`,
      contact_email: `staging-car-${index + 1}@findit.invalid`,
      title,
      description: `${title}. ${profile[7]} with ${profile[2]} model year, approximately ${profile[3]} km and a ${profile[4]} powertrain. Condition is ${profile[6]}; transmission is ${profile[5]}. Inspection, service history and ownership documents can be discussed through the listing.`,
      price,
      currency: "USD",
      deposit: listingType === "rent" ? Math.round(price * 0.5) : null,
      accepts_offers: index % 3 !== 1,
      variants: [{ label: "odometer", value: `${profile[3]} km` }, { label: "body", value: profile[7] }],
      photos: [
        photoUrl(PHOTO_POOLS.car[index], index, 0),
        photoUrl(PHOTO_POOLS.car[(index + 4) % 15], index, 1),
      ],
      location_id: location.id,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      category,
      listing_type: listingType,
      status: "available",
      created_via: "developer",
      verified: true,
      views: 4 + index * 11,
      country_code: COUNTRY_CODE,
      public_latitude: coordinates.latitude,
      public_longitude: coordinates.longitude,
      public_location_label: `${location.name} area`,
      location_visibility: "approximate",
      attributes: {
        version: 1,
        values: {
          seed_namespace: SEED_NAMESPACE,
          category_slug: category,
          listing_type: listingType,
          brand: profile[0],
          model: profile[1],
          year: profile[2],
          mileage: profile[3],
          fuel_type: profile[4],
          transmission: profile[5],
          condition: profile[6],
          body_style: profile[7],
          mapped_city: location.name,
        },
      },
      created_at: date,
      updated_at: date,
    });
    const carDetail = carDetailValueFor(profile, index);
    carDetails.push({ listing_id: id, brand: profile[0], model: profile[1], year: carDetail.year, mileage: profile[3], fuel_type: carDetail.fuel, transmission: carDetail.transmission, condition: profile[6] });
    catalogueParents.push({ parentType: "listing", kind: "car", id, index: index + 15, title, photos: rows.at(-1).photos });
  }

  for (let index = 0; index < 15; index += 1) {
    const location = cityFor(index + 6, locations);
    const coordinates = coordinateFor(location, index + 40);
    const profile = MACHINERY_PROFILES[index];
    const category = MACHINERY_CATEGORY_PLAN[index];
    const listingType = listingTypeFor(category, index + 2);
    const id = uuidFor(`listing:machinery:${index + 1}`);
    const date = dateFor(index + 30);
    const price = listingType === "rent" ? 280 + index * 65 : 42000 + index * 17500;
    const title = `${profile[0]} ${profile[1]} ${listingType === "rent" ? "for Hire" : "for Sale"} — ${location.name}`;
    rows.push({
      id,
      kind: "machinery",
      seller_id: ADMIN_ID,
      seller_name: `Admin Plant Catalogue ${String(index + 1).padStart(2, "0")}`,
      contact_phone: `+263 77 300 ${String(index + 1).padStart(4, "0")}`,
      contact_whatsapp: `+263 77 300 ${String(index + 1).padStart(4, "0")}`,
      contact_email: `staging-machinery-${index + 1}@findit.invalid`,
      title,
      description: `${title}. ${profile[5]} equipment with ${profile[2]} condition, model year ${profile[3]} and approximately ${profile[4]} operating hours. Suitable for contractors, farmers, mines, logistics operators or site teams. Inspection, operator availability and transport can be arranged through the listing.`,
      price,
      currency: "USD",
      deposit: listingType === "rent" ? Math.round(price * 0.25) : null,
      accepts_offers: true,
      variants: [{ label: "usage", value: `${profile[4]} hours` }, { label: "application", value: profile[5] }],
      photos: [
        photoUrl(PHOTO_POOLS.machinery[index], index, 0),
        photoUrl(PHOTO_POOLS.machinery[(index + 6) % 15], index, 1),
      ],
      location_id: location.id,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      category,
      listing_type: listingType,
      status: "available",
      created_via: "developer",
      verified: true,
      views: 8 + index * 13,
      country_code: COUNTRY_CODE,
      public_latitude: coordinates.latitude,
      public_longitude: coordinates.longitude,
      public_location_label: `${location.name} area`,
      location_visibility: "approximate",
      attributes: {
        version: 1,
        values: {
          seed_namespace: SEED_NAMESPACE,
          category_slug: category,
          listing_type: listingType,
          machinery_type: profile[5],
          brand: profile[0],
          model: profile[1],
          condition: profile[2],
          year: profile[3],
          usage_hours: profile[4],
          mapped_city: location.name,
        },
      },
      created_at: date,
      updated_at: date,
    });
    machineryDetails.push({ listing_id: id, machinery_type: machineryDetailTypeFor(category), brand: profile[0], model: profile[1], condition: profile[2], year: profile[3], usage_hours: profile[4] });
    catalogueParents.push({ parentType: "listing", kind: "machinery", id, index: index + 30, title, photos: rows.at(-1).photos });
  }

  return { rows, propertyDetails, carDetails, machineryDetails, catalogueParents };
}

function buildServices(locations, taxonomyRows) {
  const services = [];
  const catalogueParents = [];
  for (let index = 0; index < 15; index += 1) {
    const location = cityFor(index + 9, locations);
    const category = SERVICE_CATEGORY_PLAN[index];
    const parentCategory = serviceParentCategory(category, taxonomyRows);
    const id = uuidFor(`service:${index + 1}`);
    const date = dateFor(index + 45);
    const label = safeSlugLabel(category);
    const pricingType = SERVICE_PRICING[index % SERVICE_PRICING.length];
    const deliveryMode = SERVICE_DELIVERY[index % SERVICE_DELIVERY.length];
    const price = 25 + index * 12;
    const title = `${label} specialists serving ${location.name}`;
    services.push({
      id,
      provider_id: ADMIN_ID,
      provider_name: `Admin Services Catalogue ${String(index + 1).padStart(2, "0")}`,
      contact_phone: `+263 77 400 ${String(index + 1).padStart(4, "0")}`,
      contact_whatsapp: `+263 77 400 ${String(index + 1).padStart(4, "0")}`,
      contact_email: `staging-service-${index + 1}@findit.invalid`,
      title,
      description: `${title}. The provider offers documented ${label.toLowerCase()} support with clear scope, scheduling and quotation steps. Coverage includes ${location.name} and nearby districts; customers can ask for examples, availability, equipment, response time and a written estimate before booking.`,
      category: parentCategory,
      subcategory: category,
      subcategories: [category, SERVICE_CATEGORY_PLAN[(index + 1) % 15], SERVICE_CATEGORY_PLAN[(index + 5) % 15]],
      price,
      currency: "USD",
      pricing_type: pricingType,
      photos: [
        photoUrl(PHOTO_POOLS.service[index], index, 0),
        photoUrl(PHOTO_POOLS.service[(index + 7) % 15], index, 1),
      ],
      location_id: location.id,
      location_name: location.name,
      can_travel: deliveryMode !== "remote" && deliveryMode !== "fixed_location",
      status: "active",
      verified: true,
      views: 5 + index * 8,
      country_code: COUNTRY_CODE,
      base_location_id: location.id,
      delivery_mode: deliveryMode,
      service_radius_km: deliveryMode === "remote" ? null : 25 + index * 5,
      remote_available: deliveryMode === "remote" || index % 4 === 0,
      fixed_premises: deliveryMode === "fixed_location" || deliveryMode === "fixed_and_mobile",
      location_visibility: "approximate",
      attributes: {
        version: 1,
        values: {
          seed_namespace: SEED_NAMESPACE,
          taxonomy_subcategory: category,
          taxonomy_parent: parentCategory,
          coverage_city: location.name,
          response_time_hours: 4 + (index % 5) * 4,
          service_radius_km: deliveryMode === "remote" ? null : 25 + index * 5,
          capabilities: ["quote", "availability", "portfolio", "messaging"],
        },
      },
      created_at: date,
      updated_at: date,
    });
    catalogueParents.push({ parentType: "service", kind: "service", id, index: index + 45, title, photos: services.at(-1).photos });
  }
  return { services, catalogueParents };
}

function buildPeeks(parents) {
  const selectedParents = [
    ...parents.slice(0, 7),
    ...parents.slice(15, 22),
    ...parents.slice(30, 37),
    ...parents.slice(45, 51),
  ];
  return selectedParents.map((parent, index) => ({
    id: uuidFor(`peek:${parent.parentType}:${parent.id}`),
    listing_id: parent.parentType === "listing" ? parent.id : null,
    service_id: parent.parentType === "service" ? parent.id : null,
    requester_id: ADMIN_ID,
    category: PEEK_CATEGORIES[index % PEEK_CATEGORIES.length],
    body: `Please show the ${PEEK_CATEGORIES[index % PEEK_CATEGORIES.length].replaceAll("_", " ")} for this ${parent.parentType === "service" ? "service" : "listing"}, including the location context and the key details before I decide whether to enquire.`,
    status: "pending",
    supporter_count: 0,
    moderation_status: "approved",
    moderation_reason: "staging catalogue fixture approved for preproduction observation",
    created_at: dateFor(index + 60),
    updated_at: dateFor(index + 60),
  }));
}

async function generateMedia(tempDir, parent) {
  const slug = `${parent.kind}-${String(parent.index + 1).padStart(2, "0")}`;
  const sourceImagePath = path.join(tempDir, `${slug}-source.jpg`);
  const videoPath = path.join(tempDir, `${slug}.mp4`);
  const thumbnailPath = path.join(tempDir, `${slug}.webp`);
  const sourceImageUrl = parent.photos?.[0];
  if (!sourceImageUrl) throw new Error(`no real source photo available for ${slug}`);
  const response = await fetch(sourceImageUrl, { headers: { "user-agent": "Peekalisting staging seed" } });
  if (!response.ok) throw new Error(`source photo download failed for ${slug}: ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) throw new Error(`source photo for ${slug} was not an image: ${contentType}`);
  fs.writeFileSync(sourceImagePath, Buffer.from(await response.arrayBuffer()));
  const result = spawnSync(
    FFMPEG_PATH,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-loop",
      "1",
      "-i",
      sourceImagePath,
      "-vf",
      "scale=800:450:force_original_aspect_ratio=increase,crop=800:450,zoompan=z='min(zoom+0.0015,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=45:s=640x360:fps=15",
      "-t",
      "3",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      videoPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`ffmpeg video generation failed for ${slug}: ${result.stderr}`);

  const thumbnailResult = spawnSync(
    FFMPEG_PATH,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-c:v",
      "libwebp",
      thumbnailPath,
    ],
    { encoding: "utf8" },
  );
  if (thumbnailResult.status !== 0) throw new Error(`ffmpeg thumbnail generation failed for ${slug}: ${thumbnailResult.stderr}`);
  return { videoPath, thumbnailPath };
}

async function uploadObject(bucket, objectPath, filePath, contentType) {
  const buffer = fs.readFileSync(filePath);
  const { error } = await root.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error(`storage upload failed for ${bucket}/${objectPath}: ${error.message}`);
  return buffer;
}

async function seedTours(parents, tempDir, { persist = true } = {}) {
  const rows = [];
  for (const parent of parents) {
    const tourId = uuidFor(`tour:${parent.parentType}:${parent.id}`);
    const assetId = uuidFor(`tour-asset:${parent.parentType}:${parent.id}`);
    const { videoPath, thumbnailPath } = await generateMedia(tempDir, parent);
    const video = await uploadObject(
      "tour-sources",
      `${ADMIN_ID}/${tourId}/source/${assetId}.mp4`,
      videoPath,
      "video/mp4",
    );
    const playbackPath = `${parent.parentType === "listing" ? "listing" : "service"}/${parent.id}/${tourId}.mp4`;
    const thumbnailObjectPath = `${parent.parentType === "listing" ? "listing" : "service"}/${parent.id}/${tourId}.webp`;
    await uploadObject("tour-playback", playbackPath, videoPath, "video/mp4");
    const thumbnail = await uploadObject("tour-thumbnails", thumbnailObjectPath, thumbnailPath, "image/webp");
    const checksum = crypto.createHash("sha256").update(video).digest("hex");
    const now = new Date().toISOString();
    rows.push({
      id: tourId,
      owner_id: ADMIN_ID,
      listing_id: parent.parentType === "listing" ? parent.id : null,
      service_id: parent.parentType === "service" ? parent.id : null,
      source_storage_path: `${ADMIN_ID}/${tourId}/source/${assetId}.mp4`,
      playback_storage_path: playbackPath,
      thumbnail_storage_path: thumbnailObjectPath,
      status: "ready",
      moderation_status: "approved",
      duration_seconds: 3,
      width: 640,
      height: 360,
      aspect_ratio: 640 / 360,
      mime_type: "video/mp4",
      detected_container: "mp4",
      detected_video_codec: "h264",
      detected_audio_codec: null,
      source_byte_size: video.length,
      processed_byte_size: video.length,
      checksum_sha256: checksum,
      processor_name: "catalogue_seed",
      processor_job_id: `catalogue-seed-${parent.index + 1}`,
      processing_attempts: 1,
      uploaded_at: now,
      processing_started_at: now,
      ready_at: now,
      approved_at: now,
      published_at: now,
      peek_kind: "main",
    });
    if (thumbnail.length < 100) throw new Error(`thumbnail generation produced an unexpectedly small asset for ${parent.id}`);
  }

  if (!persist) return rows;

  await upsertInChunks("listing_tours", rows, { onConflict: "id" });

  const listingParents = rows.filter((row) => row.listing_id).map((row) => ({ listing_id: row.listing_id, service_id: null, current_tour_id: row.id }));
  const serviceParents = rows.filter((row) => row.service_id).map((row) => ({ listing_id: null, service_id: row.service_id, current_tour_id: row.id }));
  const { data: existingSlots, error: slotQueryError } = await supabase
    .from("listing_tour_slots")
    .select("id,listing_id,service_id")
    .or(`listing_id.in.(${listingParents.map((row) => row.listing_id).join(",")}),service_id.in.(${serviceParents.map((row) => row.service_id).join(",")})`);
  if (slotQueryError) throw new Error(`tour slot query failed: ${slotQueryError.message}`);
  const existingByParent = new Map(
    (existingSlots ?? []).map((slot) => [slot.listing_id ?? slot.service_id, slot]),
  );
  const newSlots = [];
  for (const desired of [...listingParents, ...serviceParents]) {
    const parentId = desired.listing_id ?? desired.service_id;
    const existing = existingByParent.get(parentId);
    if (existing) {
      const { error } = await supabase
        .from("listing_tour_slots")
        .update({ current_tour_id: desired.current_tour_id, pending_tour_id: null })
        .eq("id", existing.id);
      if (error) throw new Error(`tour slot update failed for ${parentId}: ${error.message}`);
    } else {
      newSlots.push({ owner_id: ADMIN_ID, ...desired, pending_tour_id: null });
    }
  }
  if (newSlots.length) await upsertInChunks("listing_tour_slots", newSlots, { onConflict: "id" });
  return rows;
}

function buildToursSql(tours) {
  const tourColumns = [
    "id", "owner_id", "listing_id", "service_id", "source_storage_path", "playback_storage_path",
    "thumbnail_storage_path", "status", "moderation_status", "duration_seconds", "width", "height",
    "aspect_ratio", "mime_type", "detected_container", "detected_video_codec", "detected_audio_codec",
    "source_byte_size", "processed_byte_size", "checksum_sha256", "processor_name", "processor_job_id",
    "processing_attempts", "uploaded_at", "processing_started_at", "ready_at", "approved_at", "published_at", "peek_kind",
  ];
  const tourSql = buildInsertSql("listing_tours", tours, tourColumns, new Set());
  const slotSql = [];
  for (const tour of tours) {
    const parentColumn = tour.listing_id ? "listing_id" : "service_id";
    const parentId = tour.listing_id ?? tour.service_id;
    const slotId = uuidFor(`tour-slot:${tour.listing_id ? "listing" : "service"}:${parentId}`);
    slotSql.push(
      `update public.listing_tour_slots set owner_id = ${sqlValue(ADMIN_ID)}, current_tour_id = ${sqlValue(tour.id)}, pending_tour_id = NULL, updated_at = now() where ${parentColumn} = ${sqlValue(parentId)};`,
      `insert into public.listing_tour_slots (id, owner_id, ${parentColumn}, current_tour_id, pending_tour_id) select ${sqlValue(slotId)}, ${sqlValue(ADMIN_ID)}, ${sqlValue(parentId)}, ${sqlValue(tour.id)}, NULL where not exists (select 1 from public.listing_tour_slots where ${parentColumn} = ${sqlValue(parentId)});`,
    );
  }
  return [
    "begin;",
    `select set_config('request.jwt.claim.sub', ${sqlString(ADMIN_ID)}, true);`,
    tourSql,
    ...slotSql,
    "commit;",
  ].join("\n\n");
}

async function verifyRemotePhotos(parents) {
  const urls = [];
  for (const kind of ["property", "car", "machinery", "service"]) {
    for (let index = 0; index < 15; index += 1) urls.push(photoUrl(PHOTO_POOLS[kind][index], index, 0));
  }
  const outcomes = [];
  for (const group of chunk(urls, 10)) {
    outcomes.push(
      ...(await Promise.all(
        group.map(async (url) => {
          try {
            const response = await fetch(url, { method: "GET", headers: { "user-agent": "Peekalisting staging seed" } });
            return response.ok && (response.headers.get("content-type") ?? "").startsWith("image/");
          } catch {
            return false;
          }
        }),
      )),
    );
  }
  const ok = outcomes.filter(Boolean).length;
  if (ok < urls.length) console.warn(`remote image check: ${ok}/${urls.length} primary images returned image responses`);
  else console.log(`remote image check: ${ok}/${urls.length} primary images returned image responses`);
  return { ok, total: urls.length };
}

async function main() {
  if (!EMIT_SQL_MODE) {
    const { data: admin, error: adminError } = await root
      .from("users")
      .select("id,email,role,super_admin")
      .eq("id", ADMIN_ID)
      .single();
    if (adminError) throw new Error(`admin query failed: ${adminError.message}`);
    if (admin.role !== "admin" || admin.super_admin !== true) throw new Error("staging owner is not the expected admin/super-admin");
  }

  const taxonomy = await fetchTaxonomy();
  const locations = await fetchLocations();
  const listingData = buildListings(locations);
  const serviceData = buildServices(locations, taxonomy.rows);
  const parents = [...listingData.catalogueParents, ...serviceData.catalogueParents];

  if (MODE === "emit-catalogue-sql") {
    process.stdout.write(buildCatalogueSql(listingData, serviceData));
    return;
  }

  if (MODE === "emit-tours-sql") {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "peekalisting-catalogue-"));
    try {
      const requestedKind = process.argv[3] ?? "all";
      const selectedParents = requestedKind === "all"
        ? parents
        : parents.filter((parent) => parent.kind === requestedKind);
      if (!selectedParents.length) throw new Error(`no tour parents found for ${requestedKind}`);
      const tours = await seedTours(selectedParents, tempDir, { persist: false });
      process.stdout.write(buildToursSql(tours));
      return;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  if (!DIRECT_SEED) {
    throw new Error("Use seed, emit-catalogue-sql or emit-tours-sql.");
  }

  await upsertInChunks("listings", listingData.rows, { onConflict: "id" });
  await upsertInChunks("property_details", listingData.propertyDetails, { onConflict: "listing_id" });
  await upsertInChunks("car_details", listingData.carDetails, { onConflict: "listing_id" });
  await upsertInChunks("machinery_details", listingData.machineryDetails, { onConflict: "listing_id" });
  await upsertInChunks("services", serviceData.services, { onConflict: "id" });
  await upsertInChunks("peek_requests", buildPeeks(parents), { onConflict: "id" });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "peekalisting-catalogue-"));
  try {
    const tours = await seedTours(parents, tempDir);
    const photoCheck = await verifyRemotePhotos(parents);
    console.log(JSON.stringify({
      owner: ADMIN_ID,
      taxonomy_verified: true,
      locations_used: locations.length,
      listings_seeded: listingData.rows.length,
      services_seeded: serviceData.services.length,
      peeks_seeded: parents.length,
      tours_seeded: tours.length,
      distinct_video_assets: new Set(tours.map((tour) => tour.checksum_sha256)).size,
      primary_images_checked: photoCheck,
    }, null, 2));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

await main();
