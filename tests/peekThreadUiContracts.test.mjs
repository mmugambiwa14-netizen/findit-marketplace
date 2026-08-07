import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const section = await readFile(new URL('../src/components/peekThreads/PeekThreadsSection.jsx', import.meta.url), 'utf8');
const property = await readFile(new URL('../src/pages/PropertyDetail.jsx', import.meta.url), 'utf8');
const car = await readFile(new URL('../src/pages/CarDetail.jsx', import.meta.url), 'utf8');
const machinery = await readFile(new URL('../src/pages/MachineryDetail.jsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../src/pages/ServiceDetail.jsx', import.meta.url), 'utf8');

test('Peek Requests are integrated into every marketplace detail page', () => {
  for (const [name, source] of Object.entries({ property, car, machinery, service })) {
    assert.match(source, /PeekThreadsSection/);
    assert.match(source, /ownerId=/, `${name} must provide the seller or provider boundary`);
  }
  for (const source of [property, car, machinery]) assert.match(source, /parentType="listing"/);
  assert.match(service, /parentType="service"/);
});

test('buyer-facing evidence surface uses Peek Request product language', () => {
  assert.match(section, />Peek Requests<\/h2>/);
  assert.match(section, /aria-label="Peek Request filters"/);
  assert.match(section, /Request a Peek/);
  assert.doesNotMatch(section, />Peek Threads<\/h2>/);
});

test('composer uses structured categories and duplicate detection', () => {
  assert.match(section, /PEEK_REQUEST_CATEGORIES/);
  assert.match(section, /findDuplicateRequest/);
  assert.match(section, /I want this too/);
  assert.match(section, /supportPeekRequest/);
});

test('request UI exposes required filters without comment terminology', () => {
  for (const label of ['Top requests', 'Answered', 'Awaiting response', 'Newest']) {
    assert.ok(section.includes(label));
  }
  assert.doesNotMatch(section, /\bcomments?\b/i);
  assert.doesNotMatch(section, /\bupvotes?\b/i);
});

test('response cards do not receive raw storage paths or playback URLs', () => {
  assert.doesNotMatch(section, /thumbnail_path|storage_path|playback_url/);
});

test('seller and buyer actions remain role separated', () => {
  assert.match(section, /const isOwner/);
  assert.match(section, /!isOwner &&/);
  assert.match(section, /isOwner &&/);
  assert.match(section, /declinePeekRequest/);
});

test('listing-detail decline uses a focus-managed validated dialog', () => {
  assert.doesNotMatch(section, /window\.prompt/);
  assert.match(section, /AlertDialogContent/);
  assert.match(section, /autoFocus/);
  assert.match(section, /declineReason\.trim\(\)\.length < 4/);
  assert.match(section, /Decline this Peek Request\?/);
});
