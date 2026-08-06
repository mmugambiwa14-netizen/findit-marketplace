import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Pins the auth-hardening posture that protects login / reset / signup:
//   * GoTrue's per-IP rate limits stay within safe bounds (brute-force / credential
//     stuffing / email-bomb protection),
//   * email confirmations stay on (an unconfirmed or fake address cannot sign in),
//   * the password floor stays at 10 with character requirements,
//   * the before_user_created hook that rejects disposable emails stays enabled.
//
// config.toml governs the local CLI stack; the hosted project mirrors these in
// its dashboard and scripts/verify-hosted-auth-hardening.mjs audits them there.

const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');

function tomlInt(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*(\\d+)`, 'm'));
  return match ? Number(match[1]) : null;
}

test('auth rate limits are configured within safe upper bounds', () => {
  // Supabase enforces these per IP. The bounds below are the maximum we accept;
  // a future edit that loosens them past a safe ceiling fails here.
  // The anti-abuse limits stay tight. email_sent is a spam/cost control, not a
  // brute-force vector, so it has a much higher ceiling -- it should track the
  // custom SMTP provider's throughput (see docs/SMTP_SETUP.md), not be pinned to
  // the shared-SMTP default that throttles signups. The ceiling only guards
  // against a value so high it stops metering email entirely.
  const bounds = {
    // sign-in AND sign-up requests per 5 min per IP.
    sign_in_sign_ups: 30,
    // OTP / magic-link / recovery verifications per 5 min per IP.
    token_verifications: 30,
    // confirmation / recovery emails per hour (custom-SMTP capacity).
    email_sent: 1000,
    // session refreshes per 5 min per IP.
    token_refresh: 200,
  };

  for (const [key, max] of Object.entries(bounds)) {
    const value = tomlInt(config, key);
    assert.notEqual(value, null, `[auth.rate_limit] ${key} must be set`);
    assert.ok(value >= 1, `${key} must be a positive limit, got ${value}`);
    assert.ok(value <= max, `${key} is ${value}; must be <= ${max}`);
  }

  // email_sent must be lifted above the shared-SMTP default so custom SMTP can
  // actually clear a signup burst.
  assert.ok(
    tomlInt(config, 'email_sent') >= 50,
    'email_sent must be raised for custom SMTP capacity (>= 50/hour)',
  );
});

test('custom SMTP is wired env-driven with no committed secret', () => {
  // The block is documented for the hosted project; whether commented (local
  // safety) or enabled, it must be env-driven and never carry a literal secret.
  assert.match(config, /docs\/SMTP_SETUP\.md/, 'config must point to the SMTP runbook');
  assert.match(config, /env\(FINDIT_SMTP_PASS\)/, 'the SMTP password must be env-driven');
  assert.doesNotMatch(
    config,
    /pass\s*=\s*"(?!env\()[^"]+"/,
    'the SMTP password must never be a committed literal',
  );
});

test('email throttling between sends is enforced', () => {
  // Minimum gap between two confirmation / reset emails to the same address.
  assert.match(config, /max_frequency\s*=\s*"(\d+)s"/);
  const seconds = Number(config.match(/max_frequency\s*=\s*"(\d+)s"/)[1]);
  assert.ok(seconds >= 30, `email max_frequency is ${seconds}s; must be >= 30s`);
});

test('email confirmations are required, so a fake or mistyped address cannot sign in', () => {
  assert.match(
    config,
    /\[auth\.email\][\s\S]*?enable_confirmations\s*=\s*true/,
    'auth.email.enable_confirmations must be true',
  );
});

test('the password floor stays at 10 with character requirements', () => {
  const minLength = tomlInt(config, 'minimum_password_length');
  assert.ok(minLength !== null && minLength >= 10, `minimum_password_length must be >= 10, got ${minLength}`);
  assert.match(config, /password_requirements\s*=\s*"lower_upper_letters_digits"/);
});

test('the disposable-email signup hook is enabled and points at the reviewed function', () => {
  assert.match(
    config,
    /\[auth\.hook\.before_user_created\][\s\S]*?enabled\s*=\s*true/,
    'the before_user_created hook must be enabled',
  );
  assert.match(
    config,
    /uri\s*=\s*"pg-functions:\/\/postgres\/public\/before_user_created_hook"/,
    'the hook must point at public.before_user_created_hook',
  );
});
