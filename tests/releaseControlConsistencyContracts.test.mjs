import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [migration, rollback, databaseTest, validator, provider] = await Promise.all([
  readFile(new URL('../supabase/migrations/0100_release_control_consistency.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/rollback/0100_release_control_consistency.rollback.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/tests/v1_release_control_consistency.sql', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/validate-env.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../src/lib/mapProvider.js', import.meta.url), 'utf8'),
]);

test('0100 aligns recommendation and maps operational metadata', () => {
  assert.match(migration, /services_enabled', true/);
  assert.match(migration, /orchestration_executes_services', true/);
  assert.match(migration, /personalization_available', true/);
  assert.match(migration, /renderer', 'maplibre-gl'/);
  assert.match(migration, /tile_provider', 'maptiler-cloud'/);
  assert.match(migration, /public_location_precision', 'city'/);
  assert.match(migration, /exact_coordinates_exposed', false/);
});

test('0100 removes redundant browser table grants without removing service access', () => {
  assert.match(migration, /revoke all privileges on table public\.recommendation_events_default from anon, authenticated/i);
  assert.match(migration, /has_table_privilege\('service_role'/);
  assert.match(rollback, /grant all privileges on table public\.recommendation_events_default to anon, authenticated/i);
  const destructiveStatement = /\b(?:drop\s+table|truncate\s+table|delete\s+from)\b/i;
  assert.doesNotMatch(migration, destructiveStatement);
  assert.doesNotMatch(rollback, destructiveStatement);
});

test('release validation and runtime agree on the MapTiler provider', () => {
  assert.match(validator, /VITE_MAPTILER_PUBLIC_KEY/);
  assert.match(validator, /VITE_MAPTILER_STYLE_ID/);
  assert.match(provider, /api\.maptiler\.com/);
  assert.match(provider, /MAPLIBRE_VERSION = '5\.12\.0'/);
});

test('database pgTAP covers the 0100 postconditions', () => {
  assert.match(databaseTest, /MapLibre/);
  assert.match(databaseTest, /MapTiler Cloud/);
  assert.match(databaseTest, /seven recommendation services/);
  assert.match(databaseTest, /no browser grants/);
});
