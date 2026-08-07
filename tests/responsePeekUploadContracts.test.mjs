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

test('seller queue reuses the existing uploader and promises no moderation step', async () => {
  const queue = await read('src/components/peekThreads/BuyerPeekRequestsQueue.jsx');
  const uploader = await read('src/components/tours/TourUploader.jsx');
  const service = await read('src/services/responsePeekUploadService.js');
  assert.match(queue, /peekKind="response"/);
  assert.match(uploader, /uploadResponsePeek/);
  assert.match(service, /peekKind: 'response'/);
  assert.doesNotMatch(service, /bindResponsePeek/);

  // The MVP removed human Peek moderation: a Response Peek publishes when
  // processing succeeds, and safety is report-driven after publication. This test
  // previously asserted the opposite, requiring the queue to tell sellers their
  // upload "remains pending ... and moderated" and "becomes answered automatically
  // after approval" (F-049).
  //
  // Asserting the absence rather than deleting the assertion, because the copy was
  // still in the component and promising sellers an approval step that does not
  // exist is a real defect, tracked as F-059. This is its proving test.
  //
  // ResponsePeekBindingQueue is covered too: the same promise appeared there as
  // "Ready after moderation" and "each approved Peek", which the original finding
  // did not name.
  const binding = await read('src/components/peekThreads/ResponsePeekBindingQueue.jsx');
  for (const [name, source] of [['seller queue', queue], ['binding queue', binding]]) {
    assert.doesNotMatch(source, /moderat/i, `${name} must not promise a moderation step`);
    assert.doesNotMatch(source, /\bapprov/i, `${name} must not promise an approval step`);
  }
});
