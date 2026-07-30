import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary, client, hook] = await Promise.all([
  read('supabase/migrations/0093_private_marketplace_view_implementation.sql'),
  read('supabase/rollback/0093_private_marketplace_view_implementation.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/services/marketplaceViewsService.js'),
  read('src/hooks/useMarketplaceView.js'),
]);

test('marketplace view counter moves behind a private volatile implementation and public invoker wrapper', () => {
  assert.match(migration, /alter function public\.record_marketplace_view\(text, uuid\) set schema private/);
  assert.match(migration, /create function public\.record_marketplace_view/);
  assert.match(migration, /volatile/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /private\.record_marketplace_view\(p_parent_type, p_parent_id\)/);
  assert.match(migration, /16ed1360668ed6295a3d8ed0e219f55c/);
  assert.match(migration, /stored marketplace view callers exist/);
  assert.match(migration, /left a PUBLIC execute grant on a marketplace view function/);
  assert.match(rollback, /alter function private\.record_marketplace_view\(text, uuid\) set schema public/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('marketplace view boundary preserves signature, roles and exact rollback identity', () => {
  assert.match(migration, /p_parent_type text/);
  assert.match(migration, /p_parent_id uuid/);
  assert.match(migration, /returns bigint/);
  assert.match(migration, /grant execute on function private\.record_marketplace_view\(text, uuid\)[\s\S]{0,120}to anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.record_marketplace_view\(text, uuid\)[\s\S]{0,120}to anon, authenticated, service_role/);
  assert.match(rollback, /did not restore the canonical public marketplace view implementation/);
});

test('active client preserves one-session deduplication and unchanged RPC arguments', () => {
  assert.match(client, /SUPPORTED_PARENT_TYPES = new Set\(\['listing', 'service'\]\)/);
  assert.match(client, /findit\.viewed\.\$\{parentType\}\.\$\{parentId\}/);
  assert.match(client, /readStoredString\('session'/);
  assert.match(client, /\.rpc\('record_marketplace_view', \{/);
  assert.match(client, /p_parent_type: parentType/);
  assert.match(client, /p_parent_id: parentId/);
  assert.match(client, /writeStoredString\('session'/);
});

test('view telemetry remains fail-open and cannot block marketplace detail pages', () => {
  assert.match(hook, /recordMarketplaceView\(parentType, parentId\)\.catch\(\(\) => \{/);
  assert.match(hook, /View counting must never prevent the marketplace item from loading/);
  assert.doesNotMatch(hook, /throw|setError|navigate/);
});

test('migration gates run the marketplace view matrix and SQL boundary is advanced to 0093', () => {
  assert.match(workflow, /v1_private_marketplace_view_implementation\.sql/);
  assert.match(sqlBoundary, /0093_private_marketplace_view_implementation\.sql/);
  assert.match(sqlBoundary, /0092_zimbabwe_province_hierarchy\.sql/);
});
