import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary, client, foundationTest] = await Promise.all([
  read('supabase/migrations/0096_private_recommendation_event_implementation.sql'),
  read('supabase/rollback/0096_private_recommendation_event_implementation.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/services/recommendationEventsService.js'),
  read('supabase/tests/v1_recommendation_foundation.sql'),
]);

test('general recommendation events move behind a private volatile implementation', () => {
  assert.match(migration, /alter function public\.record_recommendation_event/);
  assert.match(migration, /set schema private/);
  assert.match(migration, /create function public\.record_recommendation_event/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /pronargdefaults <> 7/);
  assert.match(migration, /53f09ebe32d390272c80a2c411cb4e70/);
  assert.match(migration, /stored recommendation event callers exist/);
  assert.match(migration, /left a PUBLIC execute grant on a recommendation event function/);
  assert.match(rollback, /set schema public/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('recommendation event wrapper preserves the exact defaults, result and role parity', () => {
  assert.match(migration, /p_event_type text/);
  assert.match(migration, /p_listing_id uuid default null/);
  assert.match(migration, /p_seller_id uuid default null/);
  assert.match(migration, /p_anonymous_session_id uuid default null/);
  assert.match(migration, /p_recommendation_request_id uuid default null/);
  assert.match(migration, /p_recommendation_service text default null/);
  assert.match(migration, /p_reason_code text default null/);
  assert.match(migration, /p_context jsonb default '\{\}'::jsonb/);
  assert.match(migration, /returns uuid/);
  assert.match(migration, /to anon, authenticated, service_role/);
  assert.match(rollback, /did not restore the canonical public recommendation event implementation/);
});

test('active client remains fail-open and uses the same bounded RPC arguments', () => {
  assert.match(client, /supabase\.rpc\('record_recommendation_event'/);
  assert.match(client, /p_event_type: eventType/);
  assert.match(client, /p_listing_id: normalizeOptionalString\(listingId\)/);
  assert.match(client, /p_seller_id: normalizeOptionalString\(sellerId\)/);
  assert.match(client, /p_anonymous_session_id: getAnonymousSessionId\(\)/);
  assert.match(client, /p_context: sanitizeContext\(context\)/);
  assert.match(client, /REQUEST_TIMEOUT_MS = 1500/);
  assert.match(client, /return \{ accepted: false, eventId: null \}/);
});

test('existing certification proves guest privacy, authenticated-only events and attribution integrity', () => {
  assert.match(foundationTest, /guest records a bounded public view/);
  assert.match(foundationTest, /guest cannot record an authenticated-only action/);
  assert.match(foundationTest, /guest cannot submit invasive context/);
  assert.match(foundationTest, /guest cannot read raw events/);
  assert.match(foundationTest, /owner cannot spoof seller attribution/);
  assert.match(foundationTest, /suspended account cannot add events/);
});

test('migration gates run the boundary and foundation matrices and SQL tip is advanced to 0096', () => {
  assert.match(workflow, /v1_private_recommendation_event_implementation\.sql/);
  assert.match(workflow, /v1_recommendation_foundation\.sql/);
  assert.match(sqlBoundary, /0096_private_recommendation_event_implementation\.sql/);
  assert.match(sqlBoundary, /0095_private_support_request_implementation\.sql/);
});
