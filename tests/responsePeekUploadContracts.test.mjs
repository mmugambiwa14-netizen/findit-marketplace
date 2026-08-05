import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Response Peek authorization bypasses the Main Peek slot safely', async () => {
  const migration = await read('supabase/migrations/0122_response_peek_upload_authorization.sql');
  assert.match(migration, /authorize_response_peek_upload/);
  assert.match(migration, /peek_kind, source_storage_path/);
  assert.match(migration, /'response'/);
  assert.doesNotMatch(migration.split('create or replace function public.authorize_response_peek_upload')[1].split('create or replace function public.promote_approved_tour')[0], /listing_tour_slots/);
  assert.match(migration, /candidate\.peek_kind = 'response'/);
  assert.match(migration, /response_peek_published/);
});

test('upload intent defaults to Main Peek and requires explicit Response Peek mode', async () => {
  const edge = await read('supabase/functions/tour-upload-intent/index.ts');
  const repository = await read('src/repositories/listingToursRepository.js');
  assert.match(edge, /payload\.peekKind === "response" \? "response" : "main"/);
  assert.match(edge, /authorize_response_peek_upload/);
  assert.match(repository, /peekKind: request\.peekKind \|\| 'main'/);
});

test('seller queue reuses the existing uploader and waits for moderation before answering', async () => {
  const queue = await read('src/components/peekThreads/BuyerPeekRequestsQueue.jsx');
  const uploader = await read('src/components/tours/TourUploader.jsx');
  const service = await read('src/services/responsePeekUploadService.js');
  assert.match(queue, /peekKind="response"/);
  assert.match(queue, /The request remains pending while the video is processed and moderated/);
  assert.match(queue, /It becomes answered automatically after approval/);
  assert.match(uploader, /uploadResponsePeek/);
  assert.match(service, /peekKind: 'response'/);
  assert.doesNotMatch(service, /bindResponsePeek/);
});
