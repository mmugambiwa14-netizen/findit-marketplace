import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authContext = await readFile(
  new URL('../src/lib/AuthContext.jsx', import.meta.url),
  'utf8',
);

test('auth state listeners defer Supabase profile work outside the callback', () => {
  const listener = authContext.match(
    /authService\.onAuthStateChange\(\(event\) => \{([\s\S]*?)\n    \}\);/,
  )?.[1] ?? '';

  assert.match(listener, /window\.setTimeout/);
  assert.doesNotMatch(listener, /\bawait\b/);
  assert.doesNotMatch(listener, /checkUserAuth\(\)(?![\s\S]*?\}, 0\))/);
  assert.match(authContext, /window\.clearTimeout\(authRefreshTimer\)/);
});
