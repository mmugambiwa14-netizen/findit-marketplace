import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const discovery = readFileSync(
  new URL('../supabase/migrations/20260804104900_discover_live_category_counts.sql', import.meta.url),
  'utf8',
);
const boundary = readFileSync(
  new URL('../supabase/migrations/20260805073000_private_new_authenticated_rpc_implementations.sql', import.meta.url),
  'utf8',
);

test('public category-count discovery remains an invoker function outside the private definer snapshot', () => {
  assert.match(discovery, /create or replace function public\.discover_category_counts\(\)/i);
  assert.match(discovery, /security invoker/i);
  assert.doesNotMatch(boundary, /'public\.discover_category_counts\(\)'::regprocedure/i);
  assert.match(boundary, /locked 22-RPC boundary/i);
  assert.match(boundary, /private_count <> 22 or wrapper_count <> 22/i);
  assert.doesNotMatch(boundary, /locked 23-RPC boundary/i);
});
