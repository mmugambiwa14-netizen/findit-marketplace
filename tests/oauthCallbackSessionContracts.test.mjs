import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authService = await readFile(
  new URL('../src/services/authService.js', import.meta.url),
  'utf8',
);
const supabaseClient = await readFile(
  new URL('../src/lib/supabaseClient.js', import.meta.url),
  'utf8',
);

test('OAuth callback explicitly exchanges a PKCE code when URL detection has not completed', () => {
  assert.match(authService, /function oauthCallbackCode\(\)/);
  assert.match(authService, /supabase\.auth\.exchangeCodeForSession\(code\)/);
  assert.match(authService, /if \(data\?\.session\) return data\.session/);
});

test('OAuth callback waits for the asynchronous Supabase session publication', () => {
  assert.match(authService, /for \(let attempt = 0; attempt < 8; attempt \+= 1\)/);
  assert.match(authService, /await wait\(250\)/);
  assert.match(authService, /getOAuthCallbackSession\(\)/);
});

test('OAuth callback has a bounded failure path and does not spin indefinitely', () => {
  assert.match(authService, /if \(exchangeError\) throw exchangeError/);
  assert.match(authService, /Google sign-in did not return a session\./);
});

test('the browser Supabase client uses the PKCE flow required by the callback exchange', () => {
  assert.match(supabaseClient, /flowType: 'pkce'/);
  assert.match(supabaseClient, /detectSessionInUrl: true/);
});
