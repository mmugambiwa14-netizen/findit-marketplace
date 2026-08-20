import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../supabase/migrations/20260820170000_runtime_lint_repairs.sql', import.meta.url),
  'utf8',
);

test('hosted runtime lint repairs keep admin and Peek SQL contracts unambiguous', () => {
  for (const functionName of [
    'private.admin_tour_queue',
    'private.report_tour',
    'private.admin_review_report',
    'private.bind_response_peek',
    'private.admin_unified_audit_activity_page',
  ]) {
    assert.match(migration, new RegExp(`create or replace function ${functionName.replace('.', '\\.')}`));
  }

  assert.match(migration, /q\.parent_title/);
  assert.match(migration, /activity\.admin_email/);
  assert.match(migration, /public\.ticket_listing_category/);
  assert.match(migration, /'status_change'::public\.alert_type/);
  assert.match(migration, /'peek_request_answered'/);
  assert.doesNotMatch(migration, /'info'\s*,\s*v_link/);
});
