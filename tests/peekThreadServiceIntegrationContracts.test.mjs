import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('service details expose Peek Threads through the shared service boundary', async () => {
  const source = await read('src/pages/ServiceDetail.jsx');
  assert.match(source, /PeekThreadsSection/);
  assert.match(source, /parentType="service"/);
  assert.match(source, /ownerId=\{service\.provider_id\}/);
  assert.match(source, /useGuestGuard/);
  assert.match(source, /GuestPromptSheet/);
  assert.doesNotMatch(source, /supabase\./);
});

test('Peek composer never silently no-ops at the optional guard boundary', async () => {
  const source = await read('src/components/peekThreads/PeekThreadsSection.jsx');
  assert.match(source, /const runGuarded = \(action, callback\) =>/);
  assert.match(source, /if \(typeof guard === 'function'\)/);
  assert.match(source, /if \(!user\)[\s\S]*Sign in to request a Peek/);
  assert.match(source, /callback\(\);/);
  assert.match(source, /Describe what you want to see in at least 8 characters/);
  assert.doesNotMatch(source, /disabled=\{body\.trim\(\)\.length < 8 \|\|/);
});

test('seller profile exposes Buyer Peek Requests only with Peeks enabled', async () => {
  const source = await read('src/pages/Profile.jsx');
  assert.match(source, /featureFlags\.tours && \{ icon: MessageSquareMore, label: 'Buyer Peek Requests'/);
  assert.match(source, /to: '\/peek-requests'/);
});
