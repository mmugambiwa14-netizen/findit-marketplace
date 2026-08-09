import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [viteConfig, realtimeThread] = await Promise.all([
  read('vite.config.js'),
  read('src/components/messaging/RealtimeConversationThread.jsx'),
]);

test('messaging uses the real Supabase Realtime client in hosted builds', () => {
  assert.doesNotMatch(viteConfig, /@supabase\/realtime-js/);
  assert.match(realtimeThread, /\.channel\(`conversation:/);
});

test('an unavailable Realtime transport falls back to bounded thread polling', () => {
  assert.match(realtimeThread, /let channel = null/);
  assert.match(realtimeThread, /try \{[\s\S]*?\.subscribe\(/);
  assert.match(realtimeThread, /setRealtimeConnected\(false\)/);
  assert.match(realtimeThread, /if \(channel\) void supabase\.removeChannel\(channel\)\.catch\(\(\) => \{\}\)/);
  assert.match(realtimeThread, /realtimeConnected=\{realtimeConnected\}/);
});
