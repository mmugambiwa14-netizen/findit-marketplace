import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Request a Peek composer parent shape is translated into the RPC contract', async () => {
  const contract = await read('src/domain/peekThreads/writeContracts.js');
  assert.match(contract, /input\.parentType === 'listing'/);
  assert.match(contract, /input\.parentType === 'service'/);
  assert.match(contract, /listingId:/);
  assert.match(contract, /serviceId:/);
});

test('Request a Peek controls cannot silently no-op before the mutation', async () => {
  const section = await read('src/components/peekThreads/PeekThreadsSection.jsx');
  assert.match(section, /typeof guard === 'function'/);
  assert.match(section, /Sign in to request a Peek\./);
  assert.match(section, /Describe what you want to see in at least 8 characters\./);
  assert.match(section, /onClick=\{submitRequest\}/);
  assert.doesNotMatch(section, /disabled=\{body\.trim\(\)\.length < 8/);
  assert.doesNotMatch(section, /guard\?\.\('request a Peek'/);
});

test('business workflow form actions always reach explicit React handling or visible validation', async () => {
  const gate = await read('src/components/business/BusinessPublishingGate.jsx');
  assert.match(gate, /function reportInvalidForm/);
  assert.match(gate, /formElement\?\.reportValidity\?\.\(\)/);
  assert.ok((gate.match(/<form noValidate/g) || []).length >= 3);
  assert.match(gate, /Choose at least one business category\./);
  assert.match(gate, /const sendResponse = async \(formElement\)/);
  assert.match(gate, /const submitApplication = async \(formElement\)/);
  assert.match(gate, /const submitManaged = async \(formElement\)/);
  assert.match(gate, /onClick=\{\(event\) => void sendResponse\(event\.currentTarget\.form\)\}/);
  assert.match(gate, /onClick=\{\(event\) => void submitApplication\(event\.currentTarget\.form\)\}/);
  assert.match(gate, /onClick=\{\(event\) => void submitManaged\(event\.currentTarget\.form\)\}/);
  assert.doesNotMatch(gate, /disabled=\{submitting \|\| form\.requestedCategories\.length === 0\}/);
});

test('staging PWA forces a fresh worker check and activates waiting builds', async () => {
  const worker = await read('src/lib/serviceWorker.js');
  assert.match(worker, /updateViaCache: 'none'/);
  assert.match(worker, /await registration\.update\(\)/);
  assert.match(worker, /activateWaitingStagingWorker/);
  assert.match(worker, /waiting\.postMessage\(\{ type: 'SKIP_WAITING' \}\)/);
});

test('a Tour report remains intake-only until an admin actions it', async () => {
  const migration = await read('supabase/migrations/20260809213000_report_review_before_takedown.sql');
  const reportFunction = migration.match(/create or replace function private\.report_tour[\s\S]*?\$function\$;/i)?.[0] || '';
  assert.ok(reportFunction, 'report_tour replacement exists');
  assert.doesNotMatch(reportFunction, /set\s+moderation_status\s*=\s*'reported'/i);
  assert.doesNotMatch(reportFunction, /published_at\s*=\s*null/i);
  assert.match(migration, /if p_status = 'actioned' then[\s\S]*admin_reject_tour/i);
  assert.match(migration, /elsif p_status = 'dismissed' then[\s\S]*update public\.reports/i);
});

test('seller Peek queue orders qualified score columns', async () => {
  const migration = await read('supabase/migrations/20260809213500_peek_request_queue_qualification.sql');
  assert.match(migration, /order by e\.queue_score desc/);
  assert.match(migration, /order by p\.queue_score desc/);
  assert.match(migration, /order by v\.queue_score desc/);
});
