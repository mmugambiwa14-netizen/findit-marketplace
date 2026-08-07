import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260807040000_admin_mfa_assurance_boundary.sql', import.meta.url),
  'utf8',
);
const rollback = readFileSync(
  new URL('../supabase/rollback/20260807040000_admin_mfa_assurance_boundary.rollback.sql', import.meta.url),
  'utf8',
);
const databaseTest = readFileSync(
  new URL('../supabase/tests/v1_admin_mfa_assurance_boundary.sql', import.meta.url),
  'utf8',
);
const runner = readFileSync(
  new URL('../scripts/run-migration-database-certification.sh', import.meta.url),
  'utf8',
);

test('admin authorization centrally enforces aal2 after verified MFA enrolment', () => {
  assert.match(migration, /create or replace function private\.has_verified_mfa_factor\(p_user_id uuid\)/i);
  assert.match(migration, /from auth\.mfa_factors[\s\S]*factor\.status = 'verified'/i);
  assert.match(migration, /auth\.jwt\(\) ->> 'aal'[\s\S]*= 'aal2'/i);
  assert.match(migration, /create or replace function private\.is_admin\(\)[\s\S]*private\.has_required_admin_assurance\(user_record\.id\)/i);
  assert.match(migration, /create or replace function private\.is_super_admin\(\)[\s\S]*private\.is_admin\(\)/i);
  assert.match(migration, /set search_path = ''/i);
  assert.doesNotMatch(migration, /grant execute on function private\.has_(?:verified_mfa_factor|required_admin_assurance).*authenticated/i);
});

test('rollback restores the previous founder-admin helper and removes MFA helpers', () => {
  assert.match(rollback, /create or replace function private\.is_admin\(\)/i);
  assert.match(rollback, /drop function if exists private\.has_required_admin_assurance\(uuid\)/i);
  assert.match(rollback, /drop function if exists private\.has_verified_mfa_factor\(uuid\)/i);
});

test('pgTAP covers no-factor enrolment, aal1 denial, aal2 allow and ordinary-user denial', () => {
  assert.match(databaseTest, /without a verified factor can still reach enrolment paths/i);
  assert.match(databaseTest, /aal1 administrator with a verified factor is denied by an admin RPC/i);
  assert.match(databaseTest, /aal2 administrator with a verified factor may call an admin RPC/i);
  assert.match(databaseTest, /aal2 ordinary user remains denied by an admin RPC/i);
  assert.match(runner, /supabase\/tests\/v1_admin_mfa_assurance_boundary\.sql/);
});
