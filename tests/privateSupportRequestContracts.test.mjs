import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, rollback, workflow, sqlBoundary, repository, service, contracts, contactSupportTest] = await Promise.all([
  read('supabase/migrations/0095_private_support_request_implementation.sql'),
  read('supabase/rollback/0095_private_support_request_implementation.rollback.sql'),
  read('.github/workflows/migration-gates.yml'),
  read('scripts/verify-sql-boundary.mjs'),
  read('src/repositories/contactSupportRepository.js'),
  read('src/services/contactSupportService.js'),
  read('src/services/contactSupportContracts.js'),
  read('supabase/tests/v1_contact_support.sql'),
]);

test('support submission moves behind a private volatile implementation with its default argument', () => {
  assert.match(migration, /alter function public\.submit_support_request/);
  assert.match(migration, /set schema private/);
  assert.match(migration, /create function public\.submit_support_request/);
  assert.match(migration, /p_related_reference text default null/i);
  assert.match(migration, /returns jsonb/);
  assert.match(migration, /volatile/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /private\.submit_support_request/);
  assert.match(migration, /50b7df2c3d206e62dec244acf5f682d1/);
  assert.match(migration, /stored support request callers exist/);
  assert.match(migration, /left a PUBLIC execute grant on a support request function/);
  assert.match(rollback, /set schema public/);
  assert.match(rollback, /pronargdefaults = 1/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
  assert.doesNotMatch(rollback, /drop table|truncate|delete from/i);
});

test('support request boundary preserves RPC shape and role parity', () => {
  assert.match(migration, /p_category text/);
  assert.match(migration, /p_contact_email text/);
  assert.match(migration, /p_message text/);
  assert.match(migration, /p_related_reference text/);
  assert.match(migration, /to anon, authenticated, service_role/);
  assert.match(rollback, /did not restore the canonical public support request implementation/);
});

test('active support client keeps bounded input and compact confirmation semantics', () => {
  assert.match(repository, /supabase\.rpc\('submit_support_request'/);
  assert.match(repository, /p_category: input\.category/);
  assert.match(repository, /p_contact_email: input\.contactEmail/);
  assert.match(repository, /p_message: input\.message/);
  assert.match(repository, /p_related_reference: input\.relatedReference/);
  assert.match(service, /result\?\.received/);
  assert.match(service, /typeof result\.referenceId !== 'string'/);
  assert.match(contracts, /SUPPORT_CATEGORIES/);
  assert.match(contracts, /message\.length < 20 \|\| message\.length > 4000/);
  assert.match(contracts, /relatedReference\.length > 120/);
});

test('support failures expose safe recovery text rather than raw provider errors', () => {
  assert.match(repository, /function supportFailureMessage\(error\)/);
  assert.match(repository, /Too many support requests were sent\. Please try again later\./);
  assert.match(repository, /We could not send your support request\. Please try again\./);
  assert.match(repository, /failure\.name = 'SupportRequestError'/);
  assert.doesNotMatch(repository, /new Error\(error\.message/);
  assert.doesNotMatch(repository, /failure\.cause\s*=\s*error/);
});

test('existing database certification still proves support privacy, limits and admin workflow', () => {
  assert.match(contactSupportTest, /guests cannot read the founder inbox table/);
  assert.match(contactSupportTest, /a guest can submit one bounded support request/);
  assert.match(contactSupportTest, /the fourth request for one email inside fifteen minutes is rejected/);
  // The F-069 keyset work distinguishes the live projection from the retired
  // offset RPC, so the assertion now says "live founder inbox projection". Bind
  // to the behaviour (ordinary users are denied the founder inbox projection)
  // rather than to the exact phrasing.
  assert.match(contactSupportTest, /ordinary users cannot read the .*founder inbox projection/);
  assert.match(contactSupportTest, /the privileged resolution is audited without copying sensitive request content/);
});

test('migration gates run both support matrices and SQL tip is advanced to 0095', () => {
  assert.match(workflow, /v1_private_support_request_implementation\.sql/);
  assert.match(workflow, /v1_contact_support\.sql/);
  assert.match(sqlBoundary, /0095_private_support_request_implementation\.sql/);
  assert.match(sqlBoundary, /0094_private_recommended_service_event_implementation\.sql/);
});
