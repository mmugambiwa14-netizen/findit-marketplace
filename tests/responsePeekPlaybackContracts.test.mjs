import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync('supabase/migrations/0120_response_peek_playback.sql', 'utf8');
const edge = readFileSync('supabase/functions/tour-playback-access/index.ts', 'utf8');
const repository = readFileSync('src/repositories/peekThreadsRepository.js', 'utf8');
const service = readFileSync('src/services/peekThreadsService.js', 'utf8');
const player = readFileSync('src/components/peekThreads/ResponsePeekWatchButton.jsx', 'utf8');
const section = readFileSync('src/components/peekThreads/PeekThreadsSection.jsx', 'utf8');

test('Response Peek metadata is restricted to current public evidence', () => {
  assert.match(migration, /peek_kind = 'response'/);
  assert.match(migration, /status = 'published'/);
  assert.match(migration, /moderation_status = 'approved'/);
  assert.match(migration, /current_response_id = t\.id/);
  assert.match(migration, /is_peek_parent_public/);
});

test('playback accepts an explicit tour identity without replacing parent playback', () => {
  assert.match(edge, /tourId\?: unknown/);
  assert.match(edge, /public_response_peek_metadata/);
  assert.match(edge, /public_tour_metadata/);
  assert.match(repository, /body: \{ tourId \}/);
  assert.match(service, /getResponsePeekPlayback/);
});

test('thread cards use signed playback without exposing storage paths', () => {
  assert.match(section, /ResponsePeekWatchButton/);
  assert.match(player, /getResponsePeekPlayback/);
  assert.doesNotMatch(player, /storage_path|playback_storage_path|thumbnail_storage_path/);
});
