import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../supabase/migrations/0121_seller_peek_request_queue.sql', import.meta.url), 'utf8');
const repository = await readFile(new URL('../src/repositories/peekThreadsRepository.js', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/services/peekThreadsService.js', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/peekThreads/BuyerPeekRequestsQueue.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

test('seller queue is authenticated, owner-scoped and bounded', () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /l\.seller_id = v_owner/);
  assert.match(migration, /s\.provider_id = v_owner/);
  assert.match(migration, /least\(greatest\(coalesce\(p_limit, 20\), 1\), 50\)/);
  assert.match(migration, /grant execute .* to authenticated/);
  assert.doesNotMatch(migration, /grant execute .* to anon/);
});

test('seller queue uses mixed-direction keyset pagination safely', () => {
  assert.match(migration, /o\.queue_score < p_cursor_score/);
  assert.match(migration, /o\.created_at > p_cursor_created_at/);
  assert.match(migration, /o\.id > p_cursor_id/);
  assert.doesNotMatch(migration, /\(o\.queue_score, o\.created_at, o\.id\) </);
});

test('seller queue remains behind repository and service boundaries', () => {
  assert.match(repository, /seller_peek_request_queue/);
  assert.match(service, /getSellerPeekRequestQueue/);
  assert.doesNotMatch(component, /supabase/);
});

test('seller queue is an authenticated product route with focus-managed decline UI', () => {
  assert.match(app, /path="\/peek-requests"/);
  assert.match(component, /AlertDialog/);
  assert.match(component, /Buyer Peek Requests/);
  assert.match(component, /Record response/);
});
