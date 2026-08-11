import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260807041000_initialize_post_audit_rls_auth_calls.sql', import.meta.url),
  'utf8',
);
const rollback = readFileSync(
  new URL('../supabase/rollback/20260807041000_initialize_post_audit_rls_auth_calls.rollback.sql', import.meta.url),
  'utf8',
);
const databaseTest = readFileSync(
  new URL('../supabase/tests/v1_rls_auth_initialization_plans.sql', import.meta.url),
  'utf8',
);

const policies = [
  'business_applications_owner_read',
  'category_approvals_owner_read',
  'managed_listing_requests_owner_read',
  'business_application_responses_owner_read',
  'peek_request_fulfilments_owner_read',
];

test('post-audit policies preserve authorization while initializing auth.uid once', () => {
  for (const policy of policies) {
    assert.match(migration, new RegExp(`alter policy ${policy}`, 'i'));
    assert.match(rollback, new RegExp(`alter policy ${policy}`, 'i'));
  }

  assert.equal((migration.match(/\(select auth\.uid\(\)\)/gi) || []).length, 5);
  assert.doesNotMatch(migration, /=\s*auth\.uid\(\)/i);
  assert.equal((rollback.match(/=\s*auth\.uid\(\)/gi) || []).length, 5);
});

test('locked RLS initialization suite now covers all 52 policies', () => {
  assert.match(databaseTest, /all 52 locked RLS policies use an auth\.uid initialization plan/i);
  assert.match(databaseTest, /exactly 52 public policies contain initialized auth\.uid calls/i);
  for (const policy of policies) assert.match(databaseTest, new RegExp(policy, 'i'));
});
