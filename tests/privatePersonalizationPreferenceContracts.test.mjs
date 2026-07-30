import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary, client, personalizationTest] = await Promise.all([
  read('supabase/migrations/0099_private_personalization_preference_implementations.sql'),
  read('supabase/rollback/0099_private_personalization_preference_implementations.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/services/recommendationPersonalizationService.js'),
  read('supabase/tests/v1_recommendation_personalization.sql'),
]);

test('personalization get, set and clear move behind private implementations', () => {
  for (const name of ['get_my_recommendation_personalization_v1', 'set_my_recommendation_personalization_v1', 'clear_my_recommendation_personalization_data_v1']) {
    assert.match(migration, new RegExp(`alter function public\\.${name}`));
    assert.match(migration, new RegExp(`create function public\\.${name}`));
    assert.match(migration, new RegExp(`private\\.${name}`));
  }
  assert.match(migration, /ad41334dc954e18446082542450f1399/);
  assert.match(migration, /fb21c63dea9003581663880ebf60d7a2/);
  assert.match(migration, /ccc8623113af7c51df2b206ca13e16e3/);
  assert.match(migration, /left a PUBLIC execute grant on a personalization function/);
  assert.match(migration, /exposed an authenticated personalization RPC to anon/);
  assert.match(rollback, /did not restore all canonical personalization implementations/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('personalization wrappers preserve results, volatility and role grants', () => {
  assert.match(migration, /create function public\.get_my_recommendation_personalization_v1\(\)[\s\S]*?returns jsonb[\s\S]*?stable[\s\S]*?security invoker/);
  assert.match(migration, /create function public\.set_my_recommendation_personalization_v1\(p_enabled boolean\)[\s\S]*?returns jsonb[\s\S]*?volatile[\s\S]*?security invoker/);
  assert.match(migration, /create function public\.clear_my_recommendation_personalization_data_v1\(\)[\s\S]*?returns jsonb[\s\S]*?volatile[\s\S]*?security invoker/);
  assert.match(migration, /to authenticated,service_role/);
});

test('active service preserves exact RPC identities and bounded privacy messages', () => {
  assert.match(client, /rpc\('get_my_recommendation_personalization_v1'\)/);
  assert.match(client, /rpc\('set_my_recommendation_personalization_v1', \{/);
  assert.match(client, /p_enabled: enabled/);
  assert.match(client, /rpc\('clear_my_recommendation_personalization_data_v1'\)/);
  assert.match(client, /Unable to load recommendation privacy settings/);
  assert.match(client, /Unable to update recommendation privacy settings/);
  assert.match(client, /Unable to clear recommendation activity/);
  assert.doesNotMatch(client, /new Error\(error\.message/);
});

test('existing personalization certification proves consent and account isolation', () => {
  assert.match(personalizationTest, /personalization is off when no owner preference exists/);
  assert.match(personalizationTest, /active owner explicitly enables personalization/);
  assert.match(personalizationTest, /owner cannot read another account preference/);
  assert.match(personalizationTest, /pre-consent activity is excluded from personalized ranking/);
  assert.match(personalizationTest, /owner can disable personalization immediately/);
  assert.match(personalizationTest, /owner can clear account-linked recommendation activity/);
  assert.match(personalizationTest, /clearing one account does not alter another account preference/);
});

test('migration gates run focused and full personalization matrices and SQL tip advances to 0099', () => {
  assert.match(workflow, /v1_private_personalization_preference_implementations\.sql/);
  assert.match(workflow, /v1_recommendation_personalization\.sql/);
  assert.match(sqlBoundary, /0099_private_personalization_preference_implementations\.sql/);
  assert.match(sqlBoundary, /0098_private_notification_read_implementations\.sql/);
});
