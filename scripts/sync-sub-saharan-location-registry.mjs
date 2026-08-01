#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import {
  SUB_SAHARAN_COUNTRIES,
  SUB_SAHARAN_COUNTRY_CODES,
} from './location-registry/sub-saharan-countries.mjs';

const GEONAMES_DUMP_ORIGIN = 'https://download.geonames.org/export/dump';
const GEOBOUNDARIES_API_ORIGIN = 'https://www.geoboundaries.org/api/current/gbOpen';
const GEONAMES_LICENSE_URL = 'https://www.geonames.org/about.html';
const GEOBOUNDARIES_LICENSE_URL = 'https://www.geoboundaries.org/index.html#getdata';
const EXCLUDED_FEATURE_CODES = new Set(['PPLH', 'PPLQ', 'PPLW', 'PPLCH']);
const INSERT_CHUNK_SIZE = 750;
const PLACE_SHARD_SIZE = 4_000;
const MAX_QUERY_BYTES = 1_500_000;
const EXPECTED_MIGRATION = '0102_sub_saharan_location_registry.sql';

function parseArguments(argv) {
  const options = {
    applyLinked: false,
    refresh: false,
    sourceDirectory: resolve(tmpdir(), 'findit-location-registry-sources'),
    outputDirectory: resolve(tmpdir(), 'findit-location-registry-sql'),
    expectedProjectRef: '',
    resumeFrom: '',
    countryCodes: SUB_SAHARAN_COUNTRY_CODES,
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
    else if (argument === '--refresh') options.refresh = true;
    else if (argument === '--source-dir') options.sourceDirectory = resolve(next());
    else if (argument === '--output-dir') options.outputDirectory = resolve(next());
    else if (argument === '--expected-project-ref') options.expectedProjectRef = next().trim();
    else if (argument === '--resume-from') options.resumeFrom = next().trim().toUpperCase();
    else if (argument === '--countries') {
      options.countryCodes = next().split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const allowed = new Set(SUB_SAHARAN_COUNTRY_CODES);
  if (!options.countryCodes.length || options.countryCodes.some((code) => !allowed.has(code))) {
    throw new Error('--countries must contain only supported Sub-Saharan ISO alpha-2 codes');
  }
  options.countryCodes = [...new Set(options.countryCodes)];
  if (options.applyLinked && !options.expectedProjectRef) {
    throw new Error('--apply-linked requires --expected-project-ref');
  }
  if (options.resumeFrom && !options.countryCodes.includes(options.resumeFrom)) {
    throw new Error('--resume-from must be included in the selected country scope');
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/sync-sub-saharan-location-registry.mjs [options]

Options:
  --source-dir PATH          GeoNames ZIP and geoBoundaries cache directory
  --output-dir PATH          Generated, disposable SQL directory
  --countries AO,BW,...      Generate a subset (all 48 by default)
  --refresh                  Re-download source and boundary files
  --apply-linked             Execute each country SQL file against the linked project
  --expected-project-ref REF Required safety check for --apply-linked
  --resume-from ISO2         Skip applying earlier countries after an interrupted full run
  --help                     Show this message

The tool imports current populated places only. Historical, abandoned, destroyed,
and former-capital records are deliberately excluded.`);
}

function cleanText(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizedSearchName(value) {
  return cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function sqlText(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : 'null';
}

function sqlInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? String(number) : '0';
}

function insertValues(tableName, columnNames, rows) {
  if (!rows.length) return '';
  const statements = [];
  for (let offset = 0; offset < rows.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + INSERT_CHUNK_SIZE);
    statements.push(`insert into ${tableName} (${columnNames.join(', ')}) values\n${chunk.map((row) => `  (${row.join(', ')})`).join(',\n')};`);
  }
  return statements.join('\n\n');
}

async function fetchWithRetry(url, { attempts = 4 } = {}) {
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json, application/zip, */*', 'user-agent': 'FindIt-location-registry/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(90_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      failure = error;
      if (attempt < attempts) await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 500));
    }
  }
  throw failure;
}

async function ensureDownload(url, destination, refresh) {
  if (!refresh && existsSync(destination)) return readFile(destination);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.partial`;
  const data = await fetchWithRetry(url);
  await writeFile(temporary, data);
  await rm(destination, { force: true });
  await rename(temporary, destination);
  return data;
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('ZIP end-of-central-directory record was not found');
}

function extractZipEntry(zipBuffer, expectedName) {
  const end = findEndOfCentralDirectory(zipBuffer);
  const entryCount = zipBuffer.readUInt16LE(end + 10);
  let offset = zipBuffer.readUInt32LE(end + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP central-directory entry');
    const method = zipBuffer.readUInt16LE(offset + 10);
    const compressedSize = zipBuffer.readUInt32LE(offset + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 24);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 28);
    const extraLength = zipBuffer.readUInt16LE(offset + 30);
    const commentLength = zipBuffer.readUInt16LE(offset + 32);
    const localOffset = zipBuffer.readUInt32LE(offset + 42);
    const fileName = zipBuffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    if (fileName === expectedName || basename(fileName) === expectedName) {
      if (zipBuffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local ZIP header for ${fileName}`);
      const localNameLength = zipBuffer.readUInt16LE(localOffset + 26);
      const localExtraLength = zipBuffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = zipBuffer.subarray(dataStart, dataStart + compressedSize);
      const result = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null;
      if (!result) throw new Error(`Unsupported ZIP compression method ${method} for ${fileName}`);
      if (result.length !== uncompressedSize) throw new Error(`ZIP size mismatch for ${fileName}`);
      return result;
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error(`${expectedName} was not found in the GeoNames ZIP`);
}

function locationType(featureCode, population) {
  if (featureCode === 'PPLX') return 'suburb';
  if (['PPLL', 'PPLF', 'PPLR', 'STLMT'].includes(featureCode)) return 'village';
  if (featureCode.startsWith('PPLA') || ['PPLC', 'PPLG'].includes(featureCode)) return 'city';
  if (population >= 100_000) return 'city';
  if (population >= 5_000) return 'town';
  return 'village';
}

function parseGeoNamesCountry(country, dumpBuffer) {
  const rows = extractZipEntry(dumpBuffer, `${country.code}.txt`).toString('utf8').split(/\r?\n/);
  const places = [];
  let countryPoint = null;

  for (const row of rows) {
    if (!row) continue;
    const fields = row.split('\t');
    if (fields.length < 19) continue;
    const [
      geonameId,
      name,
      asciiName,
      ,
      latitudeValue,
      longitudeValue,
      featureClass,
      featureCode,
      countryCode,
      ,
      admin1Code,
      admin2Code,
      admin3Code,
      admin4Code,
      populationValue,
      ,
      ,
      timezone,
      modifiedOn,
    ] = fields;
    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);
    if (geonameId === country.geonameId && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      countryPoint = { latitude, longitude, timezone: cleanText(timezone), modifiedOn: cleanText(modifiedOn) };
    }
    if (featureClass !== 'P' || countryCode !== country.code || EXCLUDED_FEATURE_CODES.has(featureCode)) continue;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) continue;
    const displayName = cleanText(name);
    const searchName = normalizedSearchName(asciiName || displayName);
    if (!displayName || !searchName || !/^\d+$/.test(geonameId)) continue;
    const population = Number.parseInt(populationValue, 10);
    places.push({
      geonameId,
      name: displayName,
      searchName,
      type: locationType(featureCode, Number.isSafeInteger(population) ? population : 0),
      latitude,
      longitude,
      timezone: cleanText(timezone),
      population: Number.isSafeInteger(population) && population >= 0 ? population : 0,
      featureCode: cleanText(featureCode),
      modifiedOn: /^\d{4}-\d{2}-\d{2}$/.test(modifiedOn) ? modifiedOn : null,
      admin1Code: cleanText(admin1Code),
      admin2Code: cleanText(admin2Code),
      admin3Code: cleanText(admin3Code),
      admin4Code: cleanText(admin4Code),
    });
  }

  if (!places.length) throw new Error(`${country.code} contains no current populated places`);
  return { places, countryPoint };
}

function roundedCoordinateTree(value) {
  if (Array.isArray(value)) return value.map(roundedCoordinateTree);
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(5));
  return value;
}

function normalizeBoundaryGeometry(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) throw new Error('Boundary geometry is missing coordinates');
  const coordinates = roundedCoordinateTree(geometry.coordinates);
  if (geometry.type === 'Polygon') return { type: 'MultiPolygon', coordinates: [coordinates] };
  if (geometry.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates };
  throw new Error(`Unsupported ADM1 boundary geometry: ${geometry.type}`);
}

function parseBoundaries(country, boundaryBuffer) {
  const collection = JSON.parse(boundaryBuffer.toString('utf8'));
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error(`${country.code} ADM1 source is not a GeoJSON FeatureCollection`);
  }
  const boundaries = collection.features.flatMap((feature, index) => {
    const name = cleanText(feature?.properties?.shapeName);
    const providerId = cleanText(feature?.properties?.shapeID || feature?.properties?.shapeISO || `${country.iso3}-${index}`);
    const shapeIso = cleanText(feature?.properties?.shapeISO);
    const foreignIsoPrefix = /^([A-Z]{2})-/.exec(shapeIso)?.[1];
    if (!name || (foreignIsoPrefix && foreignIsoPrefix !== country.code)) return [];
    if (!providerId) throw new Error(`${country.code} ADM1 feature ${index} has no stable identity`);
    return [{
      providerId,
      name,
      searchName: normalizedSearchName(name),
      shapeIso,
      geometry: normalizeBoundaryGeometry(feature.geometry),
    }];
  });
  if (!boundaries.length) throw new Error(`${country.code} contains no ADM1 boundaries`);
  if (new Set(boundaries.map(({ providerId }) => providerId)).size !== boundaries.length) {
    throw new Error(`${country.code} ADM1 provider identities are not unique`);
  }
  return boundaries;
}

async function ensureCountrySources(country, options) {
  const zipPath = join(options.sourceDirectory, `${country.code}.zip`);
  const boundaryDirectory = join(options.sourceDirectory, 'geoboundaries');
  const metadataPath = join(boundaryDirectory, `${country.code}-ADM1-metadata.json`);
  const boundaryPath = join(boundaryDirectory, `${country.code}-ADM1-simplified.geojson`);
  const zipBuffer = await ensureDownload(`${GEONAMES_DUMP_ORIGIN}/${country.code}.zip`, zipPath, options.refresh);
  const metadataBuffer = await ensureDownload(`${GEOBOUNDARIES_API_ORIGIN}/${country.iso3}/ADM1/`, metadataPath, options.refresh);
  const metadata = JSON.parse(metadataBuffer.toString('utf8'));
  const boundaryUrl = cleanText(metadata?.simplifiedGeometryGeoJSON || metadata?.gjDownloadURL);
  if (!boundaryUrl) throw new Error(`geoBoundaries returned no ADM1 download for ${country.code}`);
  const boundaryBuffer = await ensureDownload(boundaryUrl, boundaryPath, options.refresh);
  return {
    country,
    zipPath,
    boundaryPath,
    boundaryUrl,
    boundaryLicenseSource: cleanText(metadata?.licenseSource),
    zipChecksum: sha256(zipBuffer),
    boundaryChecksum: sha256(boundaryBuffer),
  };
}

function boundaryGeometryExpression(alias = 'boundary') {
  return `extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(extensions.st_setsrid(extensions.st_geomfromgeojson(${alias}.geometry_json), 4326)), 3))`;
}

function generateCountrySql({ country, zipChecksum, boundaryChecksum, boundaryUrl, boundaryLicenseSource }, parsed, boundaries, releaseId) {
  const countryPoint = parsed.countryPoint;
  const provinceRows = boundaries.map((boundary) => [
    sqlText(boundary.providerId),
    sqlText(boundary.name),
    sqlText(boundary.searchName),
    sqlText(boundary.shapeIso),
    sqlText(JSON.stringify(boundary.geometry)),
  ]);
  const placeRows = parsed.places.map((place) => [
    sqlText(place.geonameId),
    sqlText(place.name),
    sqlText(place.searchName),
    `${sqlText(place.type)}::public.location_type`,
    sqlNumber(place.latitude),
    sqlNumber(place.longitude),
    sqlText(place.timezone || null),
    sqlInteger(place.population),
    sqlText(place.featureCode),
    place.modifiedOn ? `${sqlText(place.modifiedOn)}::date` : 'null',
    sqlText(place.admin1Code || null),
    sqlText(place.admin2Code || null),
    sqlText(place.admin3Code || null),
    sqlText(place.admin4Code || null),
  ]);
  const countryCoordinateSql = countryPoint
    ? `
    latitude = ${sqlNumber(countryPoint.latitude)},
    longitude = ${sqlNumber(countryPoint.longitude)},
    timezone = ${sqlText(countryPoint.timezone || null)},
    coordinate_point = extensions.st_setsrid(extensions.st_makepoint(${sqlNumber(countryPoint.longitude)}, ${sqlNumber(countryPoint.latitude)}), 4326)::extensions.geography,`
    : '';
  const attribution = {
    places: { provider: 'GeoNames', license: 'CC BY 4.0', url: GEONAMES_LICENSE_URL },
    boundaries: {
      provider: 'geoBoundaries',
      license: 'CC BY 4.0',
      url: GEOBOUNDARIES_LICENSE_URL,
      source: boundaryLicenseSource || boundaryUrl,
    },
  };

  return `-- Generated by scripts/sync-sub-saharan-location-registry.mjs.
-- Country: ${country.code} (${country.name}); release: ${releaseId}.
-- This file is disposable operational import data and must not be committed.

begin;
set local lock_timeout = '15s';
set local statement_timeout = '20min';
select pg_advisory_xact_lock(hashtextextended('findit-sub-saharan-location-registry', 0));

create temporary table findit_registry_boundaries (
  provider_id text primary key,
  name text not null,
  search_name text not null,
  shape_iso text,
  geometry_json text not null
) on commit drop;

${insertValues('findit_registry_boundaries', ['provider_id', 'name', 'search_name', 'shape_iso', 'geometry_json'], provinceRows)}

create temporary table findit_registry_boundary_rows on commit drop as
select
  boundary.provider_id,
  boundary.name,
  boundary.search_name,
  boundary.shape_iso,
  ${boundaryGeometryExpression('boundary')}::extensions.geometry(MultiPolygon, 4326) as boundary_geometry
from findit_registry_boundaries boundary;

do $assert_boundaries$
declare
  invalid_boundaries text;
begin
  select string_agg(name, ', ' order by name)
  into invalid_boundaries
  from findit_registry_boundary_rows
    where boundary_geometry is null or extensions.st_isempty(boundary_geometry)
  ;
  if invalid_boundaries is not null then
    raise exception '${country.code} contains empty or invalid ADM1 boundaries: %', invalid_boundaries;
  end if;
end;
$assert_boundaries$;

update public.locations country
set
  name = ${sqlText(country.name)},
  search_name = ${sqlText(normalizedSearchName(country.name))},${countryCoordinateSql}
  administrative_labels = country.administrative_labels || jsonb_build_object(
    'geonames_id', ${sqlText(country.geonameId)},
    'iso3', ${sqlText(country.iso3)},
    'registry_release', ${sqlText(releaseId)}
  ),
  promoted_at = coalesce(country.promoted_at, now()),
  is_active = true
where country.type = 'country'::public.location_type
  and country.country_code = ${sqlText(country.code)};

-- Preserve IDs from earlier canonical seeds by attaching provider identity to
-- a unique same-name ADM1 row before inserting any new boundary rows.
with source_names as (
  select search_name, min(provider_id) as provider_id
  from findit_registry_boundary_rows
  group by search_name
  having count(*) = 1
), existing_names as (
  select existing.search_name, (array_agg(existing.id order by existing.id))[1] as location_id
  from public.locations existing
  join public.locations country on country.id = existing.parent_id
  where country.type = 'country'::public.location_type
    and country.country_code = ${sqlText(country.code)}
    and existing.type in ('province'::public.location_type, 'state'::public.location_type, 'region'::public.location_type)
    and existing.provider_name is null
  group by existing.search_name
  having count(*) = 1
)
update public.locations existing
set provider_name = 'geoboundaries',
    provider_place_id = source_names.provider_id
from source_names
join existing_names on existing_names.search_name = source_names.search_name
where existing.id = existing_names.location_id;

insert into public.locations (
  name, search_name, type, parent_id, country_code, latitude, longitude,
  is_active, provider_name, provider_place_id, administrative_labels,
  source, accuracy, promoted_at, boundary_geometry
)
select
  boundary.name,
  boundary.search_name,
  'province'::public.location_type,
  country.id,
  ${sqlText(country.code)},
  extensions.st_y(extensions.st_pointonsurface(boundary.boundary_geometry))::numeric(9, 6),
  extensions.st_x(extensions.st_pointonsurface(boundary.boundary_geometry))::numeric(9, 6),
  true,
  'geoboundaries',
  boundary.provider_id,
  jsonb_build_object(
    'shape_iso', boundary.shape_iso,
    'registry_release', ${sqlText(releaseId)},
    'boundary_source', ${sqlText(boundaryUrl)}
  ),
  'provider'::public.location_source,
  'adm1_boundary',
  now(),
  boundary.boundary_geometry
from findit_registry_boundary_rows boundary
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
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  is_active = true,
  administrative_labels = public.locations.administrative_labels || excluded.administrative_labels,
  source = excluded.source,
  accuracy = excluded.accuracy,
  promoted_at = coalesce(public.locations.promoted_at, excluded.promoted_at),
  boundary_geometry = excluded.boundary_geometry;

create temporary table findit_registry_places (
  provider_id text primary key,
  name text not null,
  search_name text not null,
  type public.location_type not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  timezone text,
  population bigint not null,
  feature_code text not null,
  provider_modified_on date,
  admin1_code text,
  admin2_code text,
  admin3_code text,
  admin4_code text
) on commit drop;

${insertValues('findit_registry_places', ['provider_id', 'name', 'search_name', 'type', 'latitude', 'longitude', 'timezone', 'population', 'feature_code', 'provider_modified_on', 'admin1_code', 'admin2_code', 'admin3_code', 'admin4_code'], placeRows)}

create temporary table findit_registry_place_points on commit drop as
select
  place.*,
  extensions.st_setsrid(
    extensions.st_makepoint(place.longitude::double precision, place.latitude::double precision),
    4326
  ) as geometry_point
from findit_registry_places place;

create temporary table findit_registry_resolved_places on commit drop as
select
  place.*,
  province.id as province_id,
  not extensions.st_covers(province.boundary_geometry, place.geometry_point) as spatial_fallback
from findit_registry_place_points place
cross join lateral (
  select candidate.id, candidate.boundary_geometry
  from public.locations candidate
  where candidate.country_code = ${sqlText(country.code)}
    and candidate.is_active
    and candidate.boundary_geometry is not null
    and candidate.type in ('province'::public.location_type, 'state'::public.location_type, 'region'::public.location_type)
  order by
    case when extensions.st_covers(candidate.boundary_geometry, place.geometry_point) then 0 else 1 end,
    case
      when extensions.st_covers(candidate.boundary_geometry, place.geometry_point)
        then extensions.st_area(candidate.boundary_geometry)
      else extensions.st_distance(candidate.boundary_geometry, place.geometry_point)
    end,
    candidate.id
  limit 1
) province;

create unique index findit_registry_resolved_places_provider_id
  on findit_registry_resolved_places(provider_id);
create index findit_registry_resolved_places_name
  on findit_registry_resolved_places(province_id, search_name);

do $assert_resolution$
declare
  source_count integer;
  resolved_count integer;
begin
  select count(*) into source_count from findit_registry_places;
  select count(*) into resolved_count from findit_registry_resolved_places;
  if source_count <> resolved_count then
    raise exception '${country.code} location hierarchy is incomplete: source %, resolved %', source_count, resolved_count;
  end if;
end;
$assert_resolution$;

-- Preserve existing canonical city/town IDs when both source and destination
-- names are unique inside the same ADM1 parent.
with source_names as (
  select province_id, search_name, min(provider_id) as provider_id
  from findit_registry_resolved_places
  group by province_id, search_name
  having count(*) = 1
), existing_names as (
  select existing.parent_id, existing.search_name, (array_agg(existing.id order by existing.id))[1] as location_id
  from public.locations existing
  where existing.country_code = ${sqlText(country.code)}
    and existing.provider_name is null
    and existing.type in (
      'city'::public.location_type,
      'town'::public.location_type,
      'suburb'::public.location_type,
      'neighbourhood'::public.location_type,
      'village'::public.location_type
    )
  group by existing.parent_id, existing.search_name
  having count(*) = 1
)
update public.locations existing
set provider_name = 'geonames',
    provider_place_id = source_names.provider_id
from source_names
join existing_names
  on existing_names.parent_id = source_names.province_id
 and existing_names.search_name = source_names.search_name
where existing.id = existing_names.location_id;

insert into public.locations (
  name, search_name, type, parent_id, country_code, latitude, longitude,
  timezone, is_active, provider_name, provider_place_id,
  administrative_labels, source, accuracy, promoted_at, population,
  feature_code, provider_modified_on, coordinate_point
)
select
  place.name,
  place.search_name,
  place.type,
  place.province_id,
  ${sqlText(country.code)},
  place.latitude,
  place.longitude,
  place.timezone,
  true,
  'geonames',
  place.provider_id,
  jsonb_strip_nulls(jsonb_build_object(
    'geonames_admin1_code', place.admin1_code,
    'geonames_admin2_code', place.admin2_code,
    'geonames_admin3_code', place.admin3_code,
    'geonames_admin4_code', place.admin4_code,
    'registry_release', ${sqlText(releaseId)},
    'spatial_fallback', place.spatial_fallback
  )),
  'provider'::public.location_source,
  'provider_point',
  now(),
  place.population,
  place.feature_code,
  place.provider_modified_on,
  place.geometry_point::extensions.geography
from findit_registry_resolved_places place
on conflict (provider_name, provider_place_id)
  where provider_name is not null and provider_place_id is not null
do update set
  name = excluded.name,
  search_name = excluded.search_name,
  type = excluded.type,
  parent_id = excluded.parent_id,
  country_code = excluded.country_code,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  timezone = excluded.timezone,
  is_active = true,
  administrative_labels = public.locations.administrative_labels || excluded.administrative_labels,
  source = excluded.source,
  accuracy = excluded.accuracy,
  promoted_at = coalesce(public.locations.promoted_at, excluded.promoted_at),
  population = excluded.population,
  feature_code = excluded.feature_code,
  provider_modified_on = excluded.provider_modified_on,
  coordinate_point = excluded.coordinate_point;

insert into private.location_registry_country_syncs (
  provider,
  release_id,
  country_code,
  source_checksum,
  boundary_source_checksum,
  province_count,
  place_count,
  spatial_fallback_count,
  imported_at,
  attribution
)
select
  'geonames+geoboundaries',
  ${sqlText(releaseId)},
  ${sqlText(country.code)},
  ${sqlText(zipChecksum)},
  ${sqlText(boundaryChecksum)},
  (select count(*) from findit_registry_boundary_rows),
  (select count(*) from findit_registry_resolved_places),
  (select count(*) from findit_registry_resolved_places where spatial_fallback),
  now(),
  ${sqlText(JSON.stringify(attribution))}::jsonb
on conflict (provider, release_id, country_code) do update set
  source_checksum = excluded.source_checksum,
  boundary_source_checksum = excluded.boundary_source_checksum,
  province_count = excluded.province_count,
  place_count = excluded.place_count,
  spatial_fallback_count = excluded.spatial_fallback_count,
  imported_at = excluded.imported_at,
  attribution = excluded.attribution;

commit;
`;
}

const PLACE_SECTION_MARKER = 'create temporary table findit_registry_places (';
const METADATA_SECTION_MARKER = 'insert into private.location_registry_country_syncs (';

function generatedSection(fullSql, startMarker, endMarker = null) {
  const start = fullSql.indexOf(startMarker);
  const end = endMarker ? fullSql.indexOf(endMarker) : fullSql.length;
  if (start < 0 || end < start) throw new Error(`Generated SQL section is missing: ${startMarker}`);
  return fullSql.slice(start, end).trim();
}

function generateAdminSql(source, parsed, boundaries, releaseId) {
  const fullSql = generateCountrySql(source, { ...parsed, places: [] }, boundaries, releaseId);
  const placeStart = fullSql.indexOf(PLACE_SECTION_MARKER);
  if (placeStart < 0) throw new Error(`Generated admin SQL is malformed for ${source.country.code}`);
  return `${fullSql.slice(0, placeStart).trim()}\n\ncommit;\n`;
}

function generatePlaceShardSql(source, places, releaseId, shardNumber) {
  const fullSql = generateCountrySql(source, { countryPoint: null, places }, [], releaseId);
  const body = generatedSection(fullSql, PLACE_SECTION_MARKER, METADATA_SECTION_MARKER);
  return `-- Generated populated-place shard ${shardNumber} for ${source.country.code}; release ${releaseId}.
begin;
set local lock_timeout = '15s';
set local statement_timeout = '20min';
select pg_advisory_xact_lock(hashtextextended('findit-sub-saharan-location-registry', 0));

${body}

commit;
`;
}

function generatePlaceShards(source, places, releaseId) {
  const pending = [];
  for (let offset = 0; offset < places.length; offset += PLACE_SHARD_SIZE) {
    pending.push(places.slice(offset, offset + PLACE_SHARD_SIZE));
  }
  const accepted = [];
  while (pending.length) {
    const candidate = pending.shift();
    const sql = generatePlaceShardSql(source, candidate, releaseId, accepted.length + 1);
    if (Buffer.byteLength(sql, 'utf8') <= MAX_QUERY_BYTES) {
      accepted.push({ places: candidate, sql });
      continue;
    }
    if (candidate.length === 1) throw new Error(`${source.country.code} contains one place row larger than the import request budget`);
    const midpoint = Math.ceil(candidate.length / 2);
    pending.unshift(candidate.slice(midpoint), candidate.slice(0, midpoint));
  }
  return accepted.map((shard, index) => ({
    ...shard,
    sql: generatePlaceShardSql(source, shard.places, releaseId, index + 1),
  }));
}

function generateCountryFinalizeSql(source, releaseId, expectedProvinceCount, expectedPlaceCount) {
  const { country, zipChecksum, boundaryChecksum, boundaryUrl, boundaryLicenseSource } = source;
  const attribution = {
    places: { provider: 'GeoNames', license: 'CC BY 4.0', url: GEONAMES_LICENSE_URL },
    boundaries: {
      provider: 'geoBoundaries',
      license: 'CC BY 4.0',
      url: GEOBOUNDARIES_LICENSE_URL,
      source: boundaryLicenseSource || boundaryUrl,
    },
  };
  return `-- Generated country certification for ${country.code}; release ${releaseId}.
begin;
set local lock_timeout = '15s';
set local statement_timeout = '5min';
select pg_advisory_xact_lock(hashtextextended('findit-sub-saharan-location-registry', 0));

insert into private.location_registry_country_syncs (
  provider, release_id, country_code, source_checksum,
  boundary_source_checksum, province_count, place_count,
  spatial_fallback_count, imported_at, attribution
)
select
  'geonames+geoboundaries',
  ${sqlText(releaseId)},
  ${sqlText(country.code)},
  ${sqlText(zipChecksum)},
  ${sqlText(boundaryChecksum)},
  (select count(*) from public.locations boundary
    where boundary.provider_name = 'geoboundaries'
      and boundary.country_code = ${sqlText(country.code)}
      and boundary.administrative_labels ->> 'registry_release' = ${sqlText(releaseId)}),
  (select count(*) from public.locations place
    where place.provider_name = 'geonames'
      and place.country_code = ${sqlText(country.code)}
      and place.administrative_labels ->> 'registry_release' = ${sqlText(releaseId)}),
  (select count(*) from public.locations place
    where place.provider_name = 'geonames'
      and place.country_code = ${sqlText(country.code)}
      and place.administrative_labels ->> 'registry_release' = ${sqlText(releaseId)}
      and coalesce((place.administrative_labels ->> 'spatial_fallback')::boolean, false)),
  now(),
  ${sqlText(JSON.stringify(attribution))}::jsonb
on conflict (provider, release_id, country_code) do update set
  source_checksum = excluded.source_checksum,
  boundary_source_checksum = excluded.boundary_source_checksum,
  province_count = excluded.province_count,
  place_count = excluded.place_count,
  spatial_fallback_count = excluded.spatial_fallback_count,
  imported_at = excluded.imported_at,
  attribution = excluded.attribution;

do $certify_country$
declare
  actual_provinces integer;
  actual_places integer;
  orphan_places integer;
begin
  select province_count, place_count
  into actual_provinces, actual_places
  from private.location_registry_country_syncs
  where provider = 'geonames+geoboundaries'
    and release_id = ${sqlText(releaseId)}
    and country_code = ${sqlText(country.code)};

  select count(*) into orphan_places
  from public.locations place
  left join public.locations parent on parent.id = place.parent_id
  where place.provider_name = 'geonames'
    and place.country_code = ${sqlText(country.code)}
    and place.administrative_labels ->> 'registry_release' = ${sqlText(releaseId)}
    and parent.id is null;

  if actual_provinces <> ${expectedProvinceCount}
     or actual_places <> ${expectedPlaceCount}
     or orphan_places <> 0 then
    raise exception '${country.code} registry certification failed: ADM1 %, places %, orphans %', actual_provinces, actual_places, orphan_places;
  end if;
end;
$certify_country$;

commit;
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
  const projectRefPath = join(root, 'supabase', '.temp', 'project-ref');
  const linkedProjectRef = cleanText(await readFile(projectRefPath, 'utf8'));
  if (linkedProjectRef !== expectedProjectRef) {
    throw new Error(`Refusing linked import: expected ${expectedProjectRef}, found ${linkedProjectRef || 'no linked project'}`);
  }
  const migrationPath = join(root, 'supabase', 'migrations', EXPECTED_MIGRATION);
  if (!existsSync(migrationPath)) throw new Error(`Required migration ${EXPECTED_MIGRATION} is missing`);
}

function generateVerificationSql(releaseId, records, expectedPlaceCount) {
  const expectedCodes = records.map(({ country }) => sqlText(country.code)).join(', ');
  return `-- Generated location-registry certification for ${releaseId}.
select
  count(*) filter (where location.type = 'country'::public.location_type) as country_rows,
  count(*) filter (where market.operational_state in ('active'::public.country_operational_state, 'browse_only'::public.country_operational_state)) as browsable_markets
from public.locations location
join public.country_configs market on market.country_code = location.country_code
where location.type = 'country'::public.location_type
  and location.country_code in (${expectedCodes});

select
  count(*) as imported_places,
  count(*) filter (where parent.id is null) as orphan_places,
  count(distinct place.country_code) as countries_with_places
from public.locations place
left join public.locations parent on parent.id = place.parent_id
where place.provider_name = 'geonames'
  and place.administrative_labels ->> 'registry_release' = ${sqlText(releaseId)};

select
  count(*) as imported_admin1_boundaries,
  count(*) filter (where boundary_geometry is null) as missing_boundary_geometries,
  count(distinct country_code) as countries_with_boundaries
from public.locations
where provider_name = 'geoboundaries'
  and administrative_labels ->> 'registry_release' = ${sqlText(releaseId)};

select
  count(*) as completed_country_syncs,
  sum(place_count) as certified_places,
  sum(spatial_fallback_count) as spatial_fallback_places
from private.location_registry_country_syncs
where provider = 'geonames+geoboundaries'
  and release_id = ${sqlText(releaseId)};

do $certify$
declare
  synchronized_countries integer;
  synchronized_places bigint;
  orphan_places bigint;
begin
  select count(*), coalesce(sum(place_count), 0)
  into synchronized_countries, synchronized_places
  from private.location_registry_country_syncs
  where provider = 'geonames+geoboundaries'
    and release_id = ${sqlText(releaseId)};

  select count(*) into orphan_places
  from public.locations place
  left join public.locations parent on parent.id = place.parent_id
  where place.provider_name = 'geonames'
    and place.administrative_labels ->> 'registry_release' = ${sqlText(releaseId)}
    and parent.id is null;

  if synchronized_countries <> ${records.length}
     or synchronized_places <> ${expectedPlaceCount}
     or orphan_places <> 0 then
    raise exception 'Location registry certification failed: countries %, places %, orphans %', synchronized_countries, synchronized_places, orphan_places;
  end if;
end;
$certify$;
`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const selectedCountries = options.countryCodes.map((code) => SUB_SAHARAN_COUNTRIES.find((country) => country.code === code));
  const resumeIndex = options.resumeFrom
    ? selectedCountries.findIndex(({ code }) => code === options.resumeFrom)
    : 0;
  await mkdir(options.sourceDirectory, { recursive: true });
  await rm(options.outputDirectory, { recursive: true, force: true });
  await mkdir(options.outputDirectory, { recursive: true });
  if (options.applyLinked) await assertLinkedProject(root, options.expectedProjectRef);

  console.log(`Preparing ${selectedCountries.length} Sub-Saharan country registries…`);
  const sourceRecords = [];
  for (const country of selectedCountries) {
    process.stdout.write(`  sources ${country.code}… `);
    const source = await ensureCountrySources(country, options);
    sourceRecords.push(source);
    console.log('ready');
  }

  const releaseDigest = createHash('sha256');
  for (const source of sourceRecords) {
    releaseDigest.update(source.country.code).update(source.zipChecksum).update(source.boundaryChecksum);
  }
  const releaseId = `geonames-geoboundaries-${releaseDigest.digest('hex').slice(0, 20)}`;
  let expectedPlaceCount = 0;
  let expectedProvinceCount = 0;
  const report = [];

  for (const source of sourceRecords) {
    const dumpBuffer = await readFile(source.zipPath);
    const boundaryBuffer = await readFile(source.boundaryPath);
    const parsed = parseGeoNamesCountry(source.country, dumpBuffer);
    const boundaries = parseBoundaries(source.country, boundaryBuffer);
    expectedPlaceCount += parsed.places.length;
    expectedProvinceCount += boundaries.length;
    const adminSql = generateAdminSql(source, parsed, boundaries, releaseId);
    const placeShards = generatePlaceShards(source, parsed.places, releaseId);
    const finalizeSql = generateCountryFinalizeSql(source, releaseId, boundaries.length, parsed.places.length);
    const countryDirectory = join(options.outputDirectory, source.country.code);
    await mkdir(countryDirectory, { recursive: true });
    const adminPath = join(countryDirectory, '00-admin.sql');
    const finalizePath = join(countryDirectory, '99-finalize.sql');
    await writeFile(adminPath, adminSql, 'utf8');
    const shardPaths = [];
    for (let index = 0; index < placeShards.length; index += 1) {
      const shardPath = join(countryDirectory, `${String(index + 1).padStart(3, '0')}-places.sql`);
      await writeFile(shardPath, placeShards[index].sql, 'utf8');
      shardPaths.push(shardPath);
    }
    await writeFile(finalizePath, finalizeSql, 'utf8');
    for (const artifactPath of [adminPath, ...shardPaths, finalizePath]) {
      const byteLength = (await readFile(artifactPath)).byteLength;
      if (byteLength > MAX_QUERY_BYTES) throw new Error(`${artifactPath} exceeds the ${MAX_QUERY_BYTES}-byte query budget`);
    }
    report.push({
      code: source.country.code,
      provinces: boundaries.length,
      places: parsed.places.length,
      shards: placeShards.length,
    });
    console.log(`  generated ${source.country.code}: ${boundaries.length.toLocaleString()} ADM1, ${parsed.places.length.toLocaleString()} places`);

    const countryIndex = selectedCountries.findIndex(({ code }) => code === source.country.code);
    if (options.applyLinked && countryIndex >= resumeIndex) {
      console.log(`  importing ${source.country.code} into ${options.expectedProjectRef}…`);
      runSupabase(['db', 'query', '--linked', '--file', adminPath], root);
      for (let index = 0; index < shardPaths.length; index += 1) {
        runSupabase(['db', 'query', '--linked', '--file', shardPaths[index]], root);
        if ((index + 1) % 5 === 0 || index === shardPaths.length - 1) {
          console.log(`    ${source.country.code} place shards ${index + 1}/${shardPaths.length}`);
        }
      }
      runSupabase(['db', 'query', '--linked', '--file', finalizePath], root);
    } else if (options.applyLinked) {
      console.log(`  retaining previously certified ${source.country.code}`);
    }
  }

  const verificationPath = join(options.outputDirectory, 'verify.sql');
  await writeFile(verificationPath, generateVerificationSql(releaseId, sourceRecords, expectedPlaceCount), 'utf8');
  const manifestPath = join(options.outputDirectory, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify({
    releaseId,
    generatedAt: new Date().toISOString(),
    countryCount: sourceRecords.length,
    provinceCount: expectedProvinceCount,
    placeCount: expectedPlaceCount,
    excludedFeatureCodes: [...EXCLUDED_FEATURE_CODES],
    countries: report,
    attribution: {
      geonames: { license: 'CC BY 4.0', url: GEONAMES_LICENSE_URL },
      geoboundaries: { license: 'CC BY 4.0', url: GEOBOUNDARIES_LICENSE_URL },
    },
  }, null, 2)}\n`, 'utf8');

  if (options.applyLinked) {
    console.log('Running registry certification…');
    runSupabase(['db', 'query', '--linked', '--file', verificationPath], root, { showOutput: true });
  }

  console.log(`Registry ${releaseId}: ${sourceRecords.length} countries, ${expectedProvinceCount.toLocaleString()} ADM1 boundaries, ${expectedPlaceCount.toLocaleString()} current populated places.`);
  console.log(`Generated artifacts: ${options.outputDirectory}`);
}

main().catch((error) => {
  console.error(`Location registry sync failed: ${error?.message || error}`);
  process.exitCode = 1;
});
