import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/0044_v1_admin_keyset_pagination.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../supabase/rollback/0044_v1_admin_keyset_pagination.rollback.sql', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../src/repositories/adminRepository.js', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/services/adminService.js', import.meta.url), 'utf8');
const tourRepository = readFileSync(new URL('../src/repositories/listingToursRepository.js', import.meta.url), 'utf8');
const tourService = readFileSync(new URL('../src/services/listingToursService.js', import.meta.url), 'utf8');
const pages = [
  '../src/pages/admin/AdminListings.jsx',
  '../src/pages/admin/AdminUsers.jsx',
  '../src/pages/admin/AdminReports.jsx',
  '../src/pages/admin/AdminAuditLog.jsx',
  '../src/components/admin/SupportRequestInbox.jsx',
  '../src/components/admin/AdminTourQueue.jsx',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

const pageFunctions = [
  'admin_marketplace_rows_page',
  'admin_user_rows_page',
  'admin_report_rows_page',
  'admin_support_request_rows_page',
  'admin_audit_rows_page',
  'admin_tour_queue_page',
];

test('all high-volume founder queues expose bounded keyset RPCs', () => {
  for (const name of pageFunctions) {
    assert.match(migration, new RegExp(`create or replace function public\\.${name}`));
  }
  assert.doesNotMatch(migration, /offset\s+p_|count\(\*\)\s+over\s*\(\)/i);
  assert.match(migration, /limit p_limit \+ 1/g);
  assert.match(migration, /admin access required/g);
});

test('admin search treats SQL wildcard characters literally', () => {
  assert.match(migration, /replace\(replace\(replace\(normalized_query/);
  assert.match(migration, /escape E'\\\\'/);
});

test('active admin repositories and pages use cursors without totals or offsets', () => {
  for (const name of pageFunctions.slice(0, 4)) assert.match(repository, new RegExp(name));
  assert.match(repository, /admin_unified_audit_activity_page|admin_audit_rows_page/);
  assert.match(tourRepository, /admin_tour_queue_page/);
  assert.doesNotMatch(`${repository}\n${tourRepository}\n${pages}`, /p_offset|offset:\s*\(|totalPages|data\.total/);
  assert.match(pages, /useCursorStack/g);
  assert.match(pages, /CursorPager/g);
  assert.match(service, /nextCursor/);
  assert.match(tourService, /reportedPriority/);
});

test('admin keyset rollback is non-destructive', () => {
  for (const name of pageFunctions) assert.match(rollback, new RegExp(`drop function if exists public\\.${name}`));
  assert.doesNotMatch(rollback, /drop table|delete from|truncate/i);
});
