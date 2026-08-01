#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUB_SAHARAN_COUNTRIES,
  SUB_SAHARAN_COUNTRY_CODES,
} from './location-registry/sub-saharan-countries.mjs';

const ADMIN1_SOURCE_URL = 'https://download.geonames.org/export/dump/admin1CodesASCII.txt';
const GEONAMES_LICENSE_URL = 'https://www.geonames.org/about.html';
const GEOBOUNDARIES_API_ORIGIN = 'https://www.geoboundaries.org/api/current/gbOpen';
const EXPECTED_MIGRATION = '0103_canonical_sub_saharan_admin1_hierarchy.sql';
const MAX_QUERY_BYTES = 1_500_000;

const SAFE_NAME_ALIASES = Object.freeze({
  KE: Object.freeze({
    'elegeyo marakwet': 'elgeyo marakwet county',
    tharaka: 'tharaka nithi',
  }),
  NA: Object.freeze({ caprivi: 'zambezi region' }),
  ZA: Object.freeze({ 'nothern cape': 'northern cape' }),
});

// Provider-code identity remains authoritative. These narrowly scoped display
// corrections are backed by current government naming and protect users from
// known spelling/capitalization defects in the upstream ADM1 label feed.
const CANONICAL_ADMIN1_NAME_OVERRIDES = Object.freeze({
  AO: Object.freeze({
    '02': 'Bié',
    '06': 'Cuanza Sul',
    '17': 'Lunda Norte',
    CUB: 'Cuando',
    ICB: 'Icolo e Bengo',
    MLE: 'Moxico Leste',
  }),
  ET: Object.freeze({
    '45': 'Afar',
    '47': 'Benishangul-Gumuz',
    '50': 'Harari',
    '51': 'Oromia',
  }),
  KE: Object.freeze({
    '14': 'Elgeyo Marakwet County',
    '42': 'Nyamira County',
  }),
});

function parseArguments(argv) {
  const options = {
    applyLinked: false,
    sourceDirectory: resolve(tmpdir(), 'findit-location-registry-sources'),
    outputDirectory: resolve(tmpdir(), 'findit-admin1-reconciliation-sql'),
    expectedProjectRef: '',
    countryCodes: SUB_SAHARAN_COUNTRY_CODES,
    refresh: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      index += 1;
      return value;
    };
    if (argument === '--apply-linked') options.applyLinked = true;
    else if (argument === '--source-dir') options.sourceDirectory = resolve(next());
    else if (argument === '--output-dir') options.outputDirectory = resolve(next());
    else if (argument === '--expected-project-ref') options.expectedProjectRef = next().trim();
    else if (argument === '--countries') options.countryCodes = next().split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
    else if (argument === '--refresh') options.refresh = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  const allowed = new Set(SUB_SAHARAN_COUNTRY_CODES);
  options.countryCodes = [...new Set(options.countryCodes)];
  if (!options.countryCodes.length || options.countryCodes.some((code) => !allowed.has(code))) {
    throw new Error('--countries must contain only supported Sub-Saharan ISO alpha-2 codes');
  }
  if (options.applyLinked && !options.expectedProjectRef) throw new Error('--apply-linked requires --expected-project-ref');
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/reconcile-sub-saharan-admin1.mjs [options]

Options:
  --source-dir PATH          GeoNames/boundary cache used by the registry sync
  --output-dir PATH          Generated, disposable SQL directory
  --countries AO,BW,...      Reconcile a subset (all 48 by default)
  --apply-linked             Apply to the linked Supabase project
  --expected-project-ref REF Required safety check for --apply-linked
  --refresh                  Refresh cached provider source files
  --help                     Show this message`);
}

function cleanText(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizedName(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function comparisonName(value) {
  return normalizedName(value)
    .split(' ')
    .filter((token) => !['province', 'region', 'district', 'state', 'county', 'city', 'area', 'autonomous'].includes(token))
    .join(' ');
}

function tokenSignature(value) {
  return comparisonName(value).split(' ').filter(Boolean).sort().join(' ');
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function nameScore(leftValue, rightValue) {
  const left = comparisonName(leftValue);
  const right = comparisonName(rightValue);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (tokenSignature(left) === tokenSignature(right)) return 0.98;
  const distanceScore = 1 - (levenshtein(left, right) / Math.max(left.length, right.length));
  const leftTokens = new Set(left.split(' '));
  const rightTokens = new Set(right.split(' '));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const tokenScore = union ? intersection / union : 0;
  return Math.max(distanceScore, tokenScore * 0.92);
}

function sqlText(value) {
  if (value === null || value === undefined || value === '') return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function ensureDownload(url, path, refresh) {
  if (!refresh && existsSync(path)) return readFile(path);
  await mkdir(dirname(path), { recursive: true });
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!response.ok) throw new Error(`Unable to download ${url}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(path, buffer);
  return buffer;
}

async function ensureAdmin1Source(sourceDirectory, refresh) {
  const path = join(sourceDirectory, 'admin1CodesASCII.txt');
  const buffer = await ensureDownload(ADMIN1_SOURCE_URL, path, refresh);
  return { path, buffer };
}

function parseCountryBoundary(country, metadata, buffer) {
  const collection = JSON.parse(buffer.toString('utf8'));
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error(`${country.code} ADM0 source is not a GeoJSON FeatureCollection`);
  }
  const coordinates = [];
  for (const feature of collection.features) {
    const geometry = feature?.geometry;
    if (geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
      coordinates.push(geometry.coordinates);
    } else if (geometry?.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
      coordinates.push(...geometry.coordinates);
    }
  }
  if (!coordinates.length) throw new Error(`${country.code} ADM0 source contains no polygon geometry`);
  return {
    providerId: cleanText(metadata?.boundaryID || `${country.iso3}-ADM0`),
    boundaryUrl: cleanText(metadata?.simplifiedGeometryGeoJSON || metadata?.gjDownloadURL),
    license: cleanText(metadata?.licenseDetail || 'See source'),
    licenseSource: cleanText(metadata?.licenseSource),
    checksum: sha256(buffer),
    geometryJson: JSON.stringify({ type: 'MultiPolygon', coordinates }),
  };
}

async function ensureCountryBoundarySource(country, sourceDirectory, refresh) {
  const boundaryDirectory = join(sourceDirectory, 'geoboundaries');
  const metadataPath = join(boundaryDirectory, `${country.code}-ADM0-metadata.json`);
  const geometryPath = join(boundaryDirectory, `${country.code}-ADM0-simplified.geojson`);
  const metadataBuffer = await ensureDownload(
    `${GEOBOUNDARIES_API_ORIGIN}/${country.iso3}/ADM0/`,
    metadataPath,
    refresh,
  );
  const parsedMetadata = JSON.parse(metadataBuffer.toString('utf8'));
  const metadata = Array.isArray(parsedMetadata) ? parsedMetadata[0] : parsedMetadata;
  const boundaryUrl = cleanText(metadata?.simplifiedGeometryGeoJSON || metadata?.gjDownloadURL);
  if (!boundaryUrl) throw new Error(`geoBoundaries returned no ADM0 source for ${country.code}`);
  const boundaryBuffer = await ensureDownload(boundaryUrl, geometryPath, refresh);
  return parseCountryBoundary(country, metadata, boundaryBuffer);
}

function parseAdmin1Rows(buffer, selectedCodes) {
  const selected = new Set(selectedCodes);
  const byCountry = new Map(selectedCodes.map((code) => [code, []]));
  for (const line of buffer.toString('utf8').split(/\r?\n/)) {
    if (!line) continue;
    const [compoundCode, name, asciiName, geonameId] = line.split('\t');
    const separator = compoundCode.indexOf('.');
    if (separator < 1) continue;
    const countryCode = compoundCode.slice(0, separator);
    const adminCode = compoundCode.slice(separator + 1);
    if (!selected.has(countryCode) || !adminCode || !/^\d+$/.test(geonameId || '')) continue;
    const displayName = CANONICAL_ADMIN1_NAME_OVERRIDES[countryCode]?.[adminCode] || cleanText(name);
    const searchName = normalizedName(displayName || asciiName);
    if (!displayName || !searchName) continue;
    byCountry.get(countryCode).push({
      adminCode,
      providerId: geonameId,
      name: displayName,
      searchName,
    });
  }
  for (const [countryCode, rows] of byCountry) {
    if (!rows.length) throw new Error(`GeoNames ADM1 source contains no rows for ${countryCode}`);
    if (new Set(rows.map(({ adminCode }) => adminCode)).size !== rows.length) throw new Error(`${countryCode} ADM1 codes are not unique`);
  }
  return byCountry;
}

function parseBoundaryRows(country, buffer) {
  const collection = JSON.parse(buffer.toString('utf8'));
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) return [];
  return collection.features.flatMap((feature, index) => {
    const name = cleanText(feature?.properties?.shapeName);
    const shapeIso = cleanText(feature?.properties?.shapeISO);
    const foreignIsoPrefix = /^([A-Z]{2})-/.exec(shapeIso)?.[1];
    if (!name || (foreignIsoPrefix && foreignIsoPrefix !== country.code)) return [];
    const providerId = cleanText(feature?.properties?.shapeID || shapeIso || `${country.iso3}-${index}`);
    return providerId ? [{ providerId, name }] : [];
  });
}

function matchBoundaries(countryCode, admins, boundaries) {
  const aliases = SAFE_NAME_ALIASES[countryCode] || {};
  const candidates = [];
  for (const boundary of boundaries) {
    const boundaryName = aliases[normalizedName(boundary.name)] || boundary.name;
    for (const admin of admins) {
      const score = nameScore(boundaryName, admin.name);
      const compound = /[/&]/.test(boundary.name) && comparisonName(boundaryName) !== comparisonName(admin.name);
      if (score >= 0.76 && !compound) candidates.push({ boundary, admin, score });
    }
  }
  candidates.sort((left, right) => right.score - left.score
    || left.admin.providerId.localeCompare(right.admin.providerId)
    || left.boundary.providerId.localeCompare(right.boundary.providerId));
  const usedAdmins = new Set();
  const usedBoundaries = new Set();
  const matches = new Map();
  for (const candidate of candidates) {
    if (usedAdmins.has(candidate.admin.providerId) || usedBoundaries.has(candidate.boundary.providerId)) continue;
    usedAdmins.add(candidate.admin.providerId);
    usedBoundaries.add(candidate.boundary.providerId);
    matches.set(candidate.admin.providerId, candidate.boundary.providerId);
  }
  return matches;
}

function insertAdminRows(admins, matches) {
  return `insert into findit_canonical_admin1 (provider_id, admin_code, name, search_name, boundary_provider_id) values\n${admins.map((admin) => `  (${sqlText(admin.providerId)}, ${sqlText(admin.adminCode)}, ${sqlText(admin.name)}, ${sqlText(admin.searchName)}, ${sqlText(matches.get(admin.providerId) || null)})`).join(',\n')};`;
}

function generateCountrySql(country, admins, matches, countryBoundary, releaseId, checksum) {
  const expectedMatches = matches.size;
  return `-- Canonical GeoNames ADM1 reconciliation for ${country.code}; ${releaseId}.
begin;
set local lock_timeout = '15s';
set local statement_timeout = '20min';
select pg_advisory_xact_lock(hashtextextended('findit-sub-saharan-location-registry', 0));

create temporary table findit_canonical_admin1 (
  provider_id text primary key,
  admin_code text not null unique,
  name text not null,
  search_name text not null,
  boundary_provider_id text
) on commit drop;

${insertAdminRows(admins, matches)}

-- Refresh rows already reconciled by a prior idempotent run.
update public.locations existing
set
  name = canonical.name,
  search_name = canonical.search_name,
  type = 'province'::public.location_type,
  country_code = ${sqlText(country.code)},
  is_active = true,
  administrative_labels = existing.administrative_labels || jsonb_build_object(
    'geonames_admin1_code', canonical.admin_code,
    'registry_admin1_release', ${sqlText(releaseId)}
  ),
  source = 'provider'::public.location_source,
  promoted_at = coalesce(existing.promoted_at, now())
from findit_canonical_admin1 canonical
where existing.provider_name = 'geonames-admin1'
  and existing.provider_place_id = canonical.provider_id;

-- A later provider refresh may discover a safe polygon match that was not
-- available during the first reconciliation. Enrich the existing canonical
-- row without changing its stable ID or the place foreign keys that target it.
update public.locations canonical_area
set
  boundary_geometry = boundary_area.boundary_geometry,
  administrative_labels = canonical_area.administrative_labels || jsonb_build_object(
    'boundary_provider_id', canonical.boundary_provider_id
  )
from findit_canonical_admin1 canonical
join public.locations boundary_area
  on boundary_area.provider_name = 'geoboundaries'
 and boundary_area.provider_place_id = canonical.boundary_provider_id
where canonical_area.provider_name = 'geonames-admin1'
  and canonical_area.provider_place_id = canonical.provider_id
  and boundary_area.boundary_geometry is not null;

-- Preserve IDs and attached boundary geometries from a unique boundary or
-- same-name canonical row before inserting a new ADM1 row.
with available as (
  select
    canonical.provider_id,
    existing.id,
    row_number() over (
      partition by canonical.provider_id
      order by
        case when existing.provider_name = 'geoboundaries'
               and existing.provider_place_id = canonical.boundary_provider_id then 0 else 1 end,
        existing.created_at,
        existing.id
    ) as preference,
    count(*) over (partition by existing.id) as destination_uses
  from findit_canonical_admin1 canonical
  join public.locations country
    on country.type = 'country'::public.location_type
   and country.country_code = ${sqlText(country.code)}
  join public.locations existing
    on existing.parent_id = country.id
   and existing.type in ('province'::public.location_type, 'state'::public.location_type, 'region'::public.location_type)
   and existing.provider_name is distinct from 'geonames-admin1'
   and (
     (canonical.boundary_provider_id is not null
       and existing.provider_name = 'geoboundaries'
       and existing.provider_place_id = canonical.boundary_provider_id)
     or existing.search_name = canonical.search_name
   )
  where not exists (
    select 1 from public.locations already_canonical
    where already_canonical.provider_name = 'geonames-admin1'
      and already_canonical.provider_place_id = canonical.provider_id
  )
), chosen as (
  select provider_id, id
  from available
  where preference = 1 and destination_uses = 1
)
update public.locations existing
set provider_name = 'geonames-admin1',
    provider_place_id = canonical.provider_id,
    name = canonical.name,
    search_name = canonical.search_name,
    type = 'province'::public.location_type,
    is_active = true,
    administrative_labels = existing.administrative_labels || jsonb_build_object(
      'geonames_admin1_code', canonical.admin_code,
      'registry_admin1_release', ${sqlText(releaseId)}
    ),
    source = 'provider'::public.location_source,
    promoted_at = coalesce(existing.promoted_at, now())
from chosen
join findit_canonical_admin1 canonical on canonical.provider_id = chosen.provider_id
where existing.id = chosen.id;

insert into public.locations (
  name, search_name, type, parent_id, country_code, is_active,
  provider_name, provider_place_id, administrative_labels,
  source, accuracy, promoted_at
)
select
  canonical.name,
  canonical.search_name,
  'province'::public.location_type,
  country.id,
  ${sqlText(country.code)},
  true,
  'geonames-admin1',
  canonical.provider_id,
  jsonb_build_object(
    'geonames_admin1_code', canonical.admin_code,
    'registry_admin1_release', ${sqlText(releaseId)},
    'boundary_provider_id', canonical.boundary_provider_id
  ),
  'provider'::public.location_source,
  'canonical_adm1',
  now()
from findit_canonical_admin1 canonical
cross join (
  select id from public.locations
  where type = 'country'::public.location_type and country_code = ${sqlText(country.code)}
  order by created_at, id limit 1
) country
on conflict (provider_name, provider_place_id)
  where provider_name is not null and provider_place_id is not null
do update set
  name = excluded.name,
  search_name = excluded.search_name,
  type = excluded.type,
  parent_id = excluded.parent_id,
  country_code = excluded.country_code,
  is_active = true,
  administrative_labels = public.locations.administrative_labels || excluded.administrative_labels,
  source = excluded.source,
  accuracy = excluded.accuracy,
  promoted_at = coalesce(public.locations.promoted_at, excluded.promoted_at);

-- Provider admin codes are authoritative whenever present.
update public.locations place
set
  parent_id = administrative_area.id,
  administrative_labels = place.administrative_labels || jsonb_build_object('admin1_resolution', 'source_code')
from findit_canonical_admin1 canonical
join public.locations administrative_area
  on administrative_area.provider_name = 'geonames-admin1'
 and administrative_area.provider_place_id = canonical.provider_id
where place.provider_name = 'geonames'
  and place.country_code = ${sqlText(country.code)}
  and place.administrative_labels ->> 'geonames_admin1_code' = canonical.admin_code
  and (
    place.parent_id is distinct from administrative_area.id
    or place.administrative_labels ->> 'admin1_resolution' is distinct from 'source_code'
  );

-- Use the centre of source-coded child places as a durable fallback point for
-- canonical areas whose polygon source is unavailable or differently levelled.
with centroids as (
  select
    administrative_area.id,
    avg(place.latitude)::numeric(9, 6) as latitude,
    avg(place.longitude)::numeric(9, 6) as longitude
  from public.locations administrative_area
  join public.locations place on place.parent_id = administrative_area.id
  where administrative_area.provider_name = 'geonames-admin1'
    and administrative_area.country_code = ${sqlText(country.code)}
    and place.provider_name = 'geonames'
    and place.latitude is not null
    and place.longitude is not null
  group by administrative_area.id
)
update public.locations administrative_area
set
  latitude = centroids.latitude,
  longitude = centroids.longitude,
  coordinate_point = extensions.st_setsrid(
    extensions.st_makepoint(centroids.longitude::double precision, centroids.latitude::double precision),
    4326
  )::extensions.geography
from centroids
where administrative_area.id = centroids.id;

create temporary table findit_unresolved_places on commit drop as
select
  place.id,
  place.latitude,
  place.longitude,
  place.coordinate_point
from public.locations place
left join public.locations current_parent on current_parent.id = place.parent_id
where place.provider_name = 'geonames'
  and place.country_code = ${sqlText(country.code)}
  and place.is_active
  and place.coordinate_point is not null
  and (
    current_parent.provider_name is distinct from 'geonames-admin1'
    or place.administrative_labels ->> 'admin1_resolution' is distinct from 'source_code'
  );

analyze findit_unresolved_places;

create temporary table findit_inferred_admin1 on commit drop as
select
  place.id as place_id,
  candidate.id as admin1_id,
  case
    when candidate.boundary_geometry is not null
      and extensions.st_covers(
        candidate.boundary_geometry,
        extensions.st_setsrid(extensions.st_makepoint(place.longitude::double precision, place.latitude::double precision), 4326)
      ) then 'boundary'
    else 'nearest_canonical_area'
  end as resolution
from findit_unresolved_places place
cross join lateral (
  select administrative_area.id, administrative_area.boundary_geometry
  from public.locations administrative_area
  where administrative_area.provider_name = 'geonames-admin1'
    and administrative_area.country_code = ${sqlText(country.code)}
    and administrative_area.is_active
  order by
    case when administrative_area.boundary_geometry is not null
      and extensions.st_covers(
        administrative_area.boundary_geometry,
        extensions.st_setsrid(extensions.st_makepoint(place.longitude::double precision, place.latitude::double precision), 4326)
      ) then 0 else 1 end,
    case when administrative_area.coordinate_point is null then 1 else 0 end,
    case when administrative_area.coordinate_point is null then null else
      extensions.st_distance(administrative_area.coordinate_point, place.coordinate_point)
    end,
    administrative_area.id
  limit 1
) candidate;

update public.locations place
set
  parent_id = inferred.admin1_id,
  administrative_labels = place.administrative_labels || jsonb_build_object('admin1_resolution', inferred.resolution)
from findit_inferred_admin1 inferred
where place.id = inferred.place_id;

-- Rows whose old boundary parent was promoted in place already have the right
-- canonical parent. Normalize their provenance label so reconciliation totals
-- account for every populated place, including coordinates just outside a
-- simplified polygon edge.
update public.locations place
set administrative_labels = place.administrative_labels || jsonb_build_object(
  'admin1_resolution',
  case
    when administrative_area.boundary_geometry is not null
      and place.coordinate_point is not null
      and extensions.st_covers(
        administrative_area.boundary_geometry,
        extensions.st_setsrid(
          extensions.st_makepoint(place.longitude::double precision, place.latitude::double precision),
          4326
        )
      ) then 'boundary'
    else 'nearest_canonical_area'
  end
)
from public.locations administrative_area
where place.provider_name = 'geonames'
  and place.country_code = ${sqlText(country.code)}
  and place.parent_id = administrative_area.id
  and administrative_area.provider_name = 'geonames-admin1'
  and coalesce(place.administrative_labels ->> 'admin1_resolution', '') not in (
    'source_code', 'boundary', 'nearest_canonical_area'
  );

-- A direct ADM0 shape constrains consented nearest-place lookup without an
-- expensive or potentially stale dissolve of internal province boundaries.
update public.locations country
set
  boundary_geometry = extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(
    extensions.st_setsrid(extensions.st_geomfromgeojson(${sqlText(countryBoundary.geometryJson)}), 4326)
  ), 3))::extensions.geometry(MultiPolygon, 4326),
  administrative_labels = country.administrative_labels || jsonb_build_object(
    'country_boundary_provider', 'geoBoundaries',
    'country_boundary_provider_id', ${sqlText(countryBoundary.providerId)},
    'country_boundary_checksum', ${sqlText(countryBoundary.checksum)},
    'country_boundary_source', ${sqlText(countryBoundary.boundaryUrl)},
    'country_boundary_license', ${sqlText(countryBoundary.license)},
    'country_boundary_license_source', ${sqlText(countryBoundary.licenseSource || null)}
  )
where country.type = 'country'::public.location_type
  and country.country_code = ${sqlText(country.code)};

-- Boundary-only rows are retained for audit/rollback but hidden from selectors
-- after every place has a canonical ADM1 parent.
update public.locations boundary_only
set is_active = false
where boundary_only.provider_name = 'geoboundaries'
  and boundary_only.country_code = ${sqlText(country.code)};

insert into private.location_registry_admin1_syncs (
  provider, release_id, country_code, source_checksum,
  canonical_admin1_count, boundary_matched_admin1_count,
  source_code_place_count, inferred_place_count,
  unresolved_place_count, imported_at, attribution
)
select
  'geonames-admin1',
  ${sqlText(releaseId)},
  ${sqlText(country.code)},
  ${sqlText(checksum)},
  (select count(*) from findit_canonical_admin1),
  ${expectedMatches},
  (select count(*) from public.locations place
    where place.provider_name = 'geonames' and place.country_code = ${sqlText(country.code)}
      and place.administrative_labels ->> 'admin1_resolution' = 'source_code'),
  (select count(*) from public.locations place
    where place.provider_name = 'geonames' and place.country_code = ${sqlText(country.code)}
      and place.administrative_labels ->> 'admin1_resolution' in ('boundary', 'nearest_canonical_area')),
  (select count(*) from public.locations place
    left join public.locations parent on parent.id = place.parent_id
    where place.provider_name = 'geonames' and place.country_code = ${sqlText(country.code)}
      and (parent.id is null or parent.provider_name <> 'geonames-admin1')),
  now(),
  jsonb_build_object('provider', 'GeoNames', 'license', 'CC BY 4.0', 'url', ${sqlText(GEONAMES_LICENSE_URL)})
on conflict (provider, release_id, country_code) do update set
  source_checksum = excluded.source_checksum,
  canonical_admin1_count = excluded.canonical_admin1_count,
  boundary_matched_admin1_count = excluded.boundary_matched_admin1_count,
  source_code_place_count = excluded.source_code_place_count,
  inferred_place_count = excluded.inferred_place_count,
  unresolved_place_count = excluded.unresolved_place_count,
  imported_at = excluded.imported_at,
  attribution = excluded.attribution;

do $certify_admin1$
declare
  actual_admins integer;
  unresolved integer;
begin
  select canonical_admin1_count, unresolved_place_count
  into actual_admins, unresolved
  from private.location_registry_admin1_syncs
  where provider = 'geonames-admin1'
    and release_id = ${sqlText(releaseId)}
    and country_code = ${sqlText(country.code)};
  if actual_admins <> ${admins.length} or unresolved <> 0 then
    raise exception '${country.code} ADM1 certification failed: canonical %, unresolved places %', actual_admins, unresolved;
  end if;
end;
$certify_admin1$;

commit;
`;
}

function generateVerificationSql(releaseId, countryCodes, expectedAdminCount) {
  const countryCount = countryCodes.length;
  const countryCodeList = countryCodes.map(sqlText).join(', ');
  return `-- Aggregate canonical ADM1 certification for ${releaseId}.
select
  count(*) as certified_countries,
  sum(canonical_admin1_count) as canonical_admin1_rows,
  sum(source_code_place_count) as source_coded_places,
  sum(inferred_place_count) as inferred_places,
  sum(unresolved_place_count) as unresolved_places
from private.location_registry_admin1_syncs
where provider = 'geonames-admin1'
  and release_id = ${sqlText(releaseId)}
  and country_code in (${countryCodeList});

do $certify_all_admin1$
declare
  certified_countries integer;
  canonical_admins integer;
  unresolved bigint;
  noncanonical_parents bigint;
begin
  select count(*), coalesce(sum(canonical_admin1_count), 0), coalesce(sum(unresolved_place_count), 0)
  into certified_countries, canonical_admins, unresolved
  from private.location_registry_admin1_syncs
  where provider = 'geonames-admin1'
    and release_id = ${sqlText(releaseId)}
    and country_code in (${countryCodeList});

  select count(*) into noncanonical_parents
  from public.locations place
  left join public.locations parent on parent.id = place.parent_id
  where place.provider_name = 'geonames'
    and place.country_code in (${countryCodeList})
    and (parent.id is null or parent.provider_name <> 'geonames-admin1' or not parent.is_active);

  if certified_countries <> ${countryCount}
     or canonical_admins <> ${expectedAdminCount}
     or unresolved <> 0
     or noncanonical_parents <> 0 then
    raise exception 'Aggregate ADM1 certification failed: countries %, admins %, unresolved %, noncanonical parents %', certified_countries, canonical_admins, unresolved, noncanonical_parents;
  end if;
end;
$certify_all_admin1$;
`;
}

function runSupabase(argumentsList, workingDirectory, { showOutput = false } = {}) {
  const bundledNpx = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
  const executable = process.platform === 'win32' && existsSync(bundledNpx) ? process.execPath : 'npx';
  const commandArguments = executable === process.execPath
    ? [bundledNpx, '--yes', 'supabase@2.84.2', ...argumentsList]
    : ['--yes', 'supabase@2.84.2', ...argumentsList];
  let lastResult;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const result = spawnSync(executable, commandArguments, {
      cwd: workingDirectory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    lastResult = result;
    if (result.error) throw result.error;
    if (result.status === 0) {
      if (showOutput && result.stdout) process.stdout.write(result.stdout);
      if (showOutput && result.stderr) process.stderr.write(result.stderr);
      return;
    }
    const diagnostic = `${result.stdout || ''}\n${result.stderr || ''}`;
    const transient = /status 5\d\d|ECONN|ETIMEDOUT|connection (?:closed|reset|failed)|network request failed/i.test(diagnostic);
    if (!transient || attempt === 4) break;
    console.warn(`  transient Supabase connection failure; retrying (${attempt}/4)…`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 1_000);
  }
  if (lastResult?.stdout) process.stdout.write(lastResult.stdout);
  if (lastResult?.stderr) process.stderr.write(lastResult.stderr);
  throw new Error(`Supabase CLI failed (${argumentsList.join(' ')})`);
}

async function assertLinkedProject(root, expectedProjectRef) {
  const projectRef = cleanText(await readFile(join(root, 'supabase', '.temp', 'project-ref'), 'utf8'));
  if (projectRef !== expectedProjectRef) throw new Error(`Refusing linked reconciliation: expected ${expectedProjectRef}, found ${projectRef || 'none'}`);
  if (!existsSync(join(root, 'supabase', 'migrations', EXPECTED_MIGRATION))) throw new Error(`Required migration ${EXPECTED_MIGRATION} is missing`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  if (options.applyLinked) await assertLinkedProject(root, options.expectedProjectRef);
  await rm(options.outputDirectory, { recursive: true, force: true });
  await mkdir(options.outputDirectory, { recursive: true });
  const { buffer: adminSource } = await ensureAdmin1Source(options.sourceDirectory, options.refresh);
  const byCountry = parseAdmin1Rows(adminSource, options.countryCodes);
  const checksum = sha256(adminSource);
  const releaseId = `geonames-admin1-${checksum.slice(0, 20)}`;
  let expectedAdminCount = 0;
  const report = [];

  for (const countryCode of options.countryCodes) {
    const country = SUB_SAHARAN_COUNTRIES.find(({ code }) => code === countryCode);
    const admins = byCountry.get(countryCode);
    const boundaryPath = join(options.sourceDirectory, 'geoboundaries', `${countryCode}-ADM1-simplified.geojson`);
    const boundaries = existsSync(boundaryPath) ? parseBoundaryRows(country, await readFile(boundaryPath)) : [];
    const matches = matchBoundaries(countryCode, admins, boundaries);
    const countryBoundary = await ensureCountryBoundarySource(country, options.sourceDirectory, options.refresh);
    const sql = generateCountrySql(country, admins, matches, countryBoundary, releaseId, checksum);
    if (Buffer.byteLength(sql, 'utf8') > MAX_QUERY_BYTES) throw new Error(`${countryCode} ADM1 query exceeds the request budget`);
    const sqlPath = join(options.outputDirectory, `${countryCode}.sql`);
    await writeFile(sqlPath, sql, 'utf8');
    expectedAdminCount += admins.length;
    const adminByProviderId = new Map(admins.map((admin) => [admin.providerId, admin]));
    const boundaryByProviderId = new Map(boundaries.map((boundary) => [boundary.providerId, boundary]));
    report.push({
      code: countryCode,
      canonicalAdmin1: admins.length,
      matchedBoundaries: matches.size,
      countryBoundary: {
        providerId: countryBoundary.providerId,
        checksum: countryBoundary.checksum,
        source: countryBoundary.boundaryUrl,
      },
      boundaryMatches: [...matches].map(([adminProviderId, boundaryProviderId]) => ({
        admin: adminByProviderId.get(adminProviderId)?.name,
        boundary: boundaryByProviderId.get(boundaryProviderId)?.name,
      })),
    });
    console.log(`  ${countryCode}: ${admins.length} canonical ADM1, ${matches.size} boundary matches`);
    if (options.applyLinked) runSupabase(['db', 'query', '--linked', '--file', sqlPath], root);
  }

  const verificationPath = join(options.outputDirectory, 'verify.sql');
  await writeFile(verificationPath, generateVerificationSql(releaseId, options.countryCodes, expectedAdminCount), 'utf8');
  await writeFile(join(options.outputDirectory, 'manifest.json'), `${JSON.stringify({
    releaseId,
    countryCount: options.countryCodes.length,
    canonicalAdmin1Count: expectedAdminCount,
    sourceChecksum: checksum,
    generatedAt: new Date().toISOString(),
    countries: report,
    attribution: { provider: 'GeoNames', license: 'CC BY 4.0', url: GEONAMES_LICENSE_URL },
  }, null, 2)}\n`, 'utf8');
  if (options.applyLinked) runSupabase(['db', 'query', '--linked', '--file', verificationPath], root, { showOutput: true });
  console.log(`Canonical ADM1 ${releaseId}: ${options.countryCodes.length} countries, ${expectedAdminCount} current administrative areas.`);
}

main().catch((error) => {
  console.error(`ADM1 reconciliation failed: ${error?.message || error}`);
  process.exitCode = 1;
});
