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

test('business workflow form actions are real submit controls', async () => {
  const gate = await read('src/components/business/BusinessPublishingGate.jsx');
  assert.match(gate, /<Button type="submit" className="w-full" disabled=\{submitting\}>/);
  assert.match(gate, /<Button type="submit" className="w-full" disabled=\{submitting \|\| form\.requestedCategories\.length === 0\}>/);
  assert.match(gate, /<Button type="submit" className="w-full" disabled=\{busy\}>/);
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
