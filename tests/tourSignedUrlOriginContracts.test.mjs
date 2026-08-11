import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [runtime, playback, feed, adminReview] = await Promise.all([
  read('supabase/functions/_shared/tour-runtime.ts'),
  read('supabase/functions/tour-playback-access/index.ts'),
  read('supabase/functions/tour-feed/index.ts'),
  read('supabase/functions/tour-admin-review-access/index.ts'),
]);

test('local signed Peek URLs use trusted gateway forwarding instead of Docker hostnames', () => {
  assert.match(runtime, /export function browserReachableUrl/);
  assert.match(runtime, /FINDIT_SUPABASE_PUBLIC_URL/);
  assert.match(runtime, /isLocalPreviewOrigin\(configuredOrigin\)/);
  for (const header of ['x-forwarded-proto', 'x-forwarded-host', 'x-forwarded-port']) {
    assert.match(runtime, new RegExp(`headers\\.get\\("${header}"\\)`));
  }
  assert.match(runtime, /isLocalPreviewOrigin\(candidate\)/);
  assert.match(runtime, /parsed\.pathname.*parsed\.search.*parsed\.hash/);
  for (const source of [playback, feed, adminReview]) {
    assert.match(source, /browserReachableUrl/);
    assert.doesNotMatch(source, /new URL\(req\.url\)\.origin.*value\.slice/);
  }
});
