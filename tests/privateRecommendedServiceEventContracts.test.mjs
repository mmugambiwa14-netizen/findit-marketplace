import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary, client, relatedServicesTest] = await Promise.all([
  read('supabase/migrations/0094_private_recommended_service_event_implementation.sql'),
  read('supabase/rollback/0094_private_recommended_service_event_implementation.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/services/recommendationEventsService.js'),
  read('supabase/tests/v1_recommendation_related_services.sql'),
]);

test('recommended-service attribution moves behind a private volatile implementation', () => {
  assert.match(migration, /alter function public\.record_recommended_service_event_v1/);
  assert.match(migration, /set schema private/);
  assert.match(migration, /create function public\.record_recommended_service_event_v1/);
  assert.match(migration, /volatile/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /private\.record_recommended_service_event_v1/);
  assert.match(migration, /1e2fa95e2bcb13cf6cf563669855e840/);
  assert.match(migration, /stored recommended-service event callers exist/);
  assert.match(migration, /left a PUBLIC execute grant on a recommended-service event function/);
  assert.match(rollback, /set schema public/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('recommended-service event boundary preserves signature and role parity', () => {
  assert.match(migration, /p_event_type text/);
  assert.match(migration, /p_service_id uuid/);
  assert.match(migration, /p_anonymous_session_id uuid/);
  assert.match(migration, /p_recommendation_request_id uuid/);
  assert.match(migration, /p_recommendation_service text/);
  assert.match(migration, /p_reason_code text/);
  assert.match(migration, /p_context jsonb/);
  assert.match(migration, /returns uuid/);
  assert.match(migration, /to anon, authenticated, service_role/);
  assert.match(rollback, /did not restore the canonical public recommended-service event implementation/);
});

test('active client keeps the same bounded, fail-open service attribution RPC', () => {
  assert.match(client, /supabase\.rpc\('record_recommended_service_event_v1'/);
  assert.match(client, /p_event_type: eventType/);
  assert.match(client, /p_service_id: normalizedServiceItemId/);
  assert.match(client, /p_anonymous_session_id: getAnonymousSessionId\(\)/);
  assert.match(client, /p_recommendation_request_id: normalizeOptionalString\(recommendationRequestId\)/);
  assert.match(client, /p_context: sanitizeContext\(context\)/);
  assert.match(client, /REQUEST_TIMEOUT_MS = 1500/);
  assert.match(client, /return \{ accepted: false, eventId: null \}/);
});

test('existing database certification still proves real service attribution and privacy', () => {
  assert.match(relatedServicesTest, /anonymous browser records aggregate-safe service impression attribution/);
  assert.match(relatedServicesTest, /service event attribution rejects a paused target/);
  assert.match(relatedServicesTest, /browser cannot read raw service recommendation events/);
  assert.match(relatedServicesTest, /service impression stores only aggregate attribution and provider ownership/);
});

test('migration gates run the boundary matrix and SQL tip is advanced to 0094', () => {
  assert.match(workflow, /v1_private_recommended_service_event_implementation\.sql/);
  assert.match(sqlBoundary, /0094_private_recommended_service_event_implementation\.sql/);
  assert.match(sqlBoundary, /0093_private_marketplace_view_implementation\.sql/);
});
