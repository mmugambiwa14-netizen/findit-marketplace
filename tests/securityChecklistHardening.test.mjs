import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  migration,
  rollback,
  passwordPolicy,
  supabaseConfig,
  authPolicy,
  register,
  resetPassword,
] = await Promise.all([
  read('supabase/migrations/20260810114500_extend_owner_mutation_abuse_limits.sql'),
  read('supabase/rollback/20260810114500_extend_owner_mutation_abuse_limits.rollback.sql'),
  read('src/lib/passwordPolicy.js'),
  read('supabase/config.toml'),
  read('scripts/lib/auth-config-policy.mjs'),
  read('src/pages/Register.jsx'),
  read('src/pages/ResetPassword.jsx'),
]);

test('owner-controlled high-abuse writes are protected by actor-aware token buckets', () => {
  for (const trigger of [
    'trg_listings_owner_abuse_budget',
    'trg_services_owner_abuse_budget',
    'trg_peek_request_supporters_abuse_budget',
    'trg_users_owner_abuse_budget',
  ]) {
    assert.match(migration, new RegExp(trigger));
    assert.match(rollback, new RegExp(trigger));
  }

  for (const scope of [
    'listing.create.10m',
    'listing.create.day',
    'listing.edit.10m',
    'listing.edit.day',
    'service.create.10m',
    'service.create.day',
    'service.edit.10m',
    'service.edit.day',
    'peek_support.10m',
    'peek_support.day',
    'profile.edit.hour',
    'profile.edit.day',
  ]) {
    assert.match(migration, new RegExp(scope.replaceAll('.', '\\.')));
  }

  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /new\.seller_id is distinct from v_actor/);
  assert.match(migration, /new\.provider_id is distinct from v_actor/);
  assert.match(migration, /new\.user_id is distinct from v_actor/);
  assert.match(migration, /new\.id is distinct from v_actor/);
  assert.match(migration, /to_jsonb\(new\) - 'views' - 'updated_at'/);
  assert.match(migration, /revoke all on function private\.enforce_listing_owner_abuse_budget\(\) from public, anon, authenticated, service_role/);
  assert.match(migration, /revoke all on function private\.enforce_service_owner_abuse_budget\(\) from public, anon, authenticated, service_role/);
});

test('password policy requires length, case, number and symbol consistently', () => {
  assert.match(passwordPolicy, /PASSWORD_MIN_LENGTH = 10/);
  assert.match(passwordPolicy, /\[a-z\]/);
  assert.match(passwordPolicy, /\[A-Z\]/);
  assert.match(passwordPolicy, /\\d/);
  assert.match(passwordPolicy, /PASSWORD_SYMBOLS/);
  assert.match(passwordPolicy, /Password must include a symbol/);
  assert.match(register, /lowercase, uppercase, a number and a symbol/);
  assert.match(resetPassword, /lowercase, uppercase, a number and a symbol/);
});

test('Supabase Auth source policy enables strongest configured password characters and secure password changes', () => {
  assert.match(supabaseConfig, /password_requirements = "lower_upper_letters_digits_symbols"/);
  assert.match(supabaseConfig, /secure_password_change = true/);
  assert.match(supabaseConfig, /enable_confirmations = true/);
  assert.match(supabaseConfig, /enable_anonymous_sign_ins = false/);
});

test('hosted Auth certification fails closed on password-change reauthentication', () => {
  assert.match(authPolicy, /security_update_password_require_reauthentication/);
  assert.match(authPolicy, /FINDIT_EXPECT_PASSWORD_REAUTHENTICATION/);
  assert.match(authPolicy, /passwordChangeReauthentication/);
});
