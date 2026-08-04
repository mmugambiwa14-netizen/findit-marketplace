import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../supabase/migrations/0123_response_peek_binding_and_notifications.sql', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/peekThreads/ResponsePeekBindingQueue.jsx', import.meta.url), 'utf8');
const repository = await readFile(new URL('../src/repositories/peekThreadsRepository.js', import.meta.url), 'utf8');

test('binding is owner-scoped and only accepts approved published Response Peeks', () => {
  assert.match(migration, /t\.owner_id = auth\.uid\(\)/);
  assert.match(migration, /peek_kind = 'response'/);
  assert.match(migration, /status = 'published'/);
  assert.match(migration, /moderation_status = 'approved'/);
});

test('buyer alerts are deduplicated per user and Response Peek', () => {
  assert.match(migration, /group by user_id/);
  assert.match(migration, /on conflict\(user_id,event_type,source_key\)/);
  assert.match(migration, /peek_response_available/);
});

test('seller selector uses repository and service boundaries', () => {
  assert.match(component, /getUnboundResponsePeeks/);
  assert.match(component, /getResponsePeekRequestCandidates/);
  assert.match(component, /bindResponsePeek/);
  assert.doesNotMatch(component, /supabase\./);
  assert.match(repository, /seller_unbound_response_peeks/);
  assert.match(repository, /response_peek_request_candidates/);
});

test('selector limits binding and explains notification deduplication', () => {
  assert.match(component, /up to 25 requests/);
  assert.match(component, /one notification/);
});
