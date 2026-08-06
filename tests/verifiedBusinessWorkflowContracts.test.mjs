import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../supabase/migrations/20260807010000_verified_business_workflow.sql', import.meta.url);
const rollbackUrl = new URL('../supabase/rollback/20260807010000_verified_business_workflow.rollback.sql', import.meta.url);

async function migration() {
  return readFile(migrationUrl, 'utf8');
}

test('verified business applications have a bounded auditable state machine', async () => {
  const sql = await migration();
  assert.match(sql, /status in \('pending', 'approved', 'rejected', 'withdrawn'\)/);
  assert.match(sql, /business_verification_one_pending_per_profile/);
  assert.match(sql, /decision_reason/);
  assert.match(sql, /decided_by/);
  assert.match(sql, /decided_at/);
});

test('owners submit and withdraw only their own pending applications', async () => {
  const sql = await migration();
  assert.match(sql, /create or replace function public\.submit_business_verification/);
  assert.match(sql, /where id = p_business_profile_id and user_id = auth\.uid\(\)/);
  assert.match(sql, /create or replace function public\.withdraw_business_verification/);
  assert.match(sql, /applicant_id = auth\.uid\(\)/);
  assert.match(sql, /status = 'pending'/);
});

test('admin review is allowlisted, reasoned, and synchronizes the profile', async () => {
  const sql = await migration();
  assert.match(sql, /if not public\.is_admin\(\)/);
  assert.match(sql, /p_decision not in \('approved', 'rejected'\)/);
  assert.match(sql, /decision reason required/);
  assert.match(sql, /verified = v_approved/);
  assert.match(sql, /verification_status = p_decision/);
});

test('business owners cannot self-assign verification fields', async () => {
  const sql = await migration();
  assert.match(sql, /prevent_owner_business_verification_mutation/);
  assert.match(sql, /new\.verified is distinct from old\.verified/);
  assert.match(sql, /new\.verification_status is distinct from old\.verification_status/);
  assert.match(sql, /business verification fields are admin controlled/);
});

test('migration has a complete rollback capsule', async () => {
  const rollback = await readFile(rollbackUrl, 'utf8');
  assert.match(rollback, /drop trigger if exists prevent_owner_business_verification_mutation/);
  assert.match(rollback, /drop function if exists public\.review_business_verification/);
  assert.match(rollback, /drop table if exists public\.business_verification_applications/);
});
