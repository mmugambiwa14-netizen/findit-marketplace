import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('verified-business decisions remain the only pre-publication admin approval flow', async () => {
  const business = await read('supabase/tests/v1_verified_business_journey.sql');
  const reports = await read('src/pages/admin/AdminReports.jsx');
  assert.match(business, /business_category_approvals/);
  assert.match(business, /approve|approved/);
  assert.doesNotMatch(reports, /Tour moderation/);
  assert.doesNotMatch(reports, /AdminTourQueue/);
});

test('safety operations are report-driven and require written decisions', async () => {
  const page = await read('src/pages/admin/AdminReports.jsx');
  const contracts = await read('src/services/adminContracts.js');
  assert.match(page, /getAdminReports/);
  assert.match(page, /reviewAdminReport/);
  assert.match(page, /Decision notes/);
  assert.match(page, /notes\.trim\(\)\.length < 3/);
  assert.match(contracts, /normalizeAdminReportReview|report/i);
});

test('report actions support review dismissal and post-publication takedown', async () => {
  const page = await read('src/pages/admin/AdminReports.jsx');
  assert.match(page, /'reviewed'/);
  assert.match(page, /'dismissed'/);
  assert.match(page, /'actioned'/);
  assert.match(page, /Remove reported Peek|Remove reported marketplace item|Remove item/);
  assert.match(page, /Close reported conversation|Close conversation/);
});

test('report decisions invalidate notifications marketplace and audit projections', async () => {
  const page = await read('src/pages/admin/AdminReports.jsx');
  assert.match(page, /admin-reports/);
  assert.match(page, /admin-marketplace/);
  assert.match(page, /admin-overview/);
  assert.match(page, /admin-audit/);
  assert.match(page, /Report decision recorded/);
});

test('admin operations retain audit logging and mandatory reasons', async () => {
  const migration = await read('supabase/migrations/0016_v1_admin_operations.sql');
  const tests = await read('supabase/tests/v1_admin_operations.sql');
  assert.match(migration, /record_admin_action/);
  assert.match(migration, /require_admin_reason/);
  assert.match(tests, /audit/i);
  assert.match(tests, /reason/i);
});

test('successful listing and Peek publication do not require admin approval', async () => {
  const listing = await read('supabase/migrations/20260807030000_remove_listing_content_review_from_mvp.sql');
  const peek = await read('supabase/migrations/20260804193300_auto_publish_successful_peeks.sql');
  assert.match(listing, /no human listing review/i);
  assert.match(listing, /new\.status := 'available'/);
  assert.match(peek, /processing_validation_passed/);
  assert.match(peek, /auto_publish_ready_tour/);
});
