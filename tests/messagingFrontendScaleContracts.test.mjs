import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  inbox,
  thread,
  repository,
  service,
  listingImages,
] = await Promise.all([
  read('src/pages/Inquiries.jsx'),
  read('src/components/messaging/ConversationThread.jsx'),
  read('src/repositories/messagingRepository.js'),
  read('src/services/messagingService.js'),
  read('src/services/listingCreationService.js'),
]);

test('messaging inbox signs listing covers once per bounded page instead of once per conversation', () => {
  assert.match(service, /import \{ hydrateListingCardImages \} from '@\/services\/listingCreationService'/);
  assert.match(service, /async function hydrateConversationListings\(values, signal\)/);
  assert.match(service, /photos: value\?\.listing_photo \? \[value\.listing_photo\] : \[\]/);
  assert.match(service, /await hydrateListingCardImages\(rows\.map/);
  assert.match(service, /items: await hydrateConversationListings\(pageRows, signal\)/);
  assert.match(service, /items: await hydrateConversationListings\(rows \?\? \[\], signal\)/);
  assert.doesNotMatch(service, /resolveListingImages/);
  assert.doesNotMatch(service, /Promise\.all\([^)]*map\(hydrateConversationListing\)/s);

  const start = listingImages.indexOf('export async function hydrateListingCardImages');
  const end = listingImages.indexOf('export async function hydrateListingImages', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const cardHydrator = listingImages.slice(start, end);
  assert.match(cardHydrator, /const storagePaths = \[\.\.\.new Set\(coverValues\.filter\(isTrustedListingImagePath\)\)\]/);
  assert.equal((cardHydrator.match(/signListingImagePaths\(/g) ?? []).length, 1);
  assert.match(cardHydrator, /safeLegacyUrl\(cover\)/);
});

test('TanStack cancellation reaches every active messaging read RPC', () => {
  assert.match(repository, /function rpc\(name, params, message, signal\)/);
  assert.match(repository, /if \(signal\) query = query\.abortSignal\(signal\)/);
  for (const signature of [
    'findMessageInbox(request, signal)',
    'findMessageConversation(conversationId, signal)',
    'findMessageInboxPage(request, signal)',
    'findMessageThreadPage(request, signal)',
  ]) assert.match(repository, new RegExp(signature.replace(/[()]/g, '\\$&')));

  assert.match(service, /export async function getMessageInboxPage\(input = \{\}, signal\)/);
  assert.match(service, /findMessageInboxPage\(request, signal\)/);
  assert.match(service, /export async function getMessageConversationMetadata\(conversationId, signal\)/);
  assert.match(service, /findMessageConversation\(id, signal\)/);
  assert.match(service, /export async function getMessageThreadPage\(conversationId, input = \{\}, signal\)/);
  assert.match(service, /findMessageThreadPage\(request, signal\)/);
  assert.match(service, /throwIfAborted\(signal\)/);

  assert.match(inbox, /queryFn: \(\{ pageParam, signal \}\) => getMessageInboxPage\(\{ \.\.\.request, cursor: pageParam \|\| null \}, signal\)/);
  assert.match(thread, /queryFn: \(\{ signal \}\) => getMessageConversationMetadata\(conversationId, signal\)/);
  assert.match(thread, /queryFn: \(\{ pageParam, signal \}\) => getMessageThreadPage\(conversationId, \{ cursor: pageParam \|\| null, limit: THREAD_PAGE_SIZE \}, signal\)/);
});

test('cancellation is checked again before and after non-abortable media hydration', () => {
  const start = service.indexOf('async function hydrateConversationListings');
  const end = service.indexOf('async function hydrateConversationListing(value, signal)', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const hydration = service.slice(start, end);
  assert.match(hydration, /throwIfAborted\(signal\);[\s\S]*await hydrateListingCardImages/);
  assert.match(hydration, /await hydrateListingCardImages[\s\S]*throwIfAborted\(signal\);/);
});
