import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateHostedAuthConfig } from '../scripts/lib/auth-config-policy.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [script, packageText, environmentDocumentation, deploymentRunbook] = await Promise.all([
  read('scripts/verify-hosted-auth-hardening.mjs'),
  read('package.json'),
  read('docs/ENVIRONMENT_VARIABLES.md'),
  read('docs/DEPLOYMENT_RUNBOOK.md'),
]);
const packageJson = JSON.parse(packageText);

const productionEnvironment = {
  FINDIT_AUTH_PREFLIGHT_MODE: 'production',
  FINDIT_EXPECT_AUTH_SITE_URL: 'https://findit.example',
  FINDIT_EXPECT_AUTH_REDIRECT_URLS: 'https://findit.example/auth/callback,https://findit.example/reset-password',
  FINDIT_EXPECT_EMAIL_CONFIRMATIONS: 'true',
  FINDIT_EXPECT_PASSWORD_MIN_LENGTH: '12',
  FINDIT_EXPECT_PASSWORD_REQUIRED_CHARACTERS: 'a-z,A-Z,0-9,!@#$%^&*',
  FINDIT_EXPECT_LEAKED_PASSWORD_PROTECTION: 'true',
  FINDIT_EXPECT_TOTP_MFA: 'true',
  FINDIT_EXPECT_AUTH_CAPTCHA: 'true',
  FINDIT_EXPECT_CUSTOM_SMTP: 'true',
  FINDIT_EXPECT_GOOGLE_OAUTH: 'true',
  FINDIT_EXPECT_APPLE_OAUTH: 'false',
  FINDIT_EXPECT_ANONYMOUS_AUTH: 'false',
  FINDIT_EXPECT_PHONE_SIGNUP: 'false',
  FINDIT_EXPECT_AUTH_RATE_LIMIT_MAX: '200',
};

const hardenedConfiguration = {
  site_url: 'https://findit.example/',
  uri_allow_list: 'https://findit.example/reset-password,https://findit.example/auth/callback',
  mailer_autoconfirm: false,
  password_min_length: 14,
  password_required_characters: '!@#$%^&*,0-9,A-Z,a-z',
  password_hibp_enabled: true,
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
  security_captcha_enabled: true,
  smtp_host: 'smtp.example.test',
  smtp_admin_email: 'security@example.test',
  external_google_enabled: true,
  external_apple_enabled: false,
  external_anonymous_users_enabled: false,
  external_phone_enabled: false,
  rate_limit_verify: 30,
  rate_limit_email_sent: 30,
  rate_limit_token_refresh: 150,
};

test('production Auth policy accepts a complete hardened configuration', () => {
  const result = evaluateHostedAuthConfig(hardenedConfiguration, productionEnvironment);
  assert.equal(result.status, 'passed');
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.passwordMinimumLength, 14);
  assert.equal(result.summary.redirectUrlCount, 2);
  assert.equal(result.summary.totpMfa, true);
  assert.equal(result.summary.customSmtp, true);
});

test('production Auth policy rejects weak and incomplete provider configuration', () => {
  const result = evaluateHostedAuthConfig({
    ...hardenedConfiguration,
    site_url: 'http://localhost:3000',
    uri_allow_list: 'http://localhost:3000',
    mailer_autoconfirm: true,
    password_min_length: 6,
    password_hibp_enabled: false,
    mfa_totp_verify_enabled: false,
    security_captcha_enabled: false,
    smtp_host: '',
    external_google_enabled: false,
    external_anonymous_users_enabled: true,
  }, productionEnvironment);

  assert.equal(result.status, 'failed');
  assert.ok(result.problems.some((problem) => problem.includes('site URL')));
  assert.ok(result.problems.some((problem) => problem.includes('redirect allow list')));
  assert.ok(result.problems.some((problem) => problem.includes('minimum length')));
  assert.ok(result.problems.some((problem) => problem.includes('leakedPasswordProtection')));
  assert.ok(result.problems.some((problem) => problem.includes('TOTP MFA')));
  assert.ok(result.problems.some((problem) => problem.includes('custom SMTP')));
});

test('production Auth policy fails closed when expected values or API fields are absent', () => {
  const result = evaluateHostedAuthConfig({}, { FINDIT_AUTH_PREFLIGHT_MODE: 'production' });
  assert.equal(result.status, 'failed');
  assert.ok(result.problems.length >= 10);
  assert.ok(result.problems.some((problem) => problem.includes('FINDIT_EXPECT_AUTH_SITE_URL')));
  assert.ok(result.problems.some((problem) => problem.includes('FINDIT_EXPECT_LEAKED_PASSWORD_PROTECTION')));
  assert.ok(result.problems.some((problem) => problem.includes('FINDIT_EXPECT_AUTH_RATE_LIMIT_MAX')));
});

test('production Auth policy flags a project that returns no rate-limit fields at all', () => {
  const { rate_limit_verify, rate_limit_email_sent, rate_limit_token_refresh, ...noRateLimits } =
    hardenedConfiguration;
  const result = evaluateHostedAuthConfig(noRateLimits, productionEnvironment);

  assert.equal(result.status, 'failed');
  assert.ok(
    result.problems.some((problem) => problem.includes('rate limiting is active')),
    'missing rate-limit fields must be flagged',
  );
});

test('production Auth policy flags rate limits set so high they no longer bite', () => {
  const result = evaluateHostedAuthConfig(
    { ...hardenedConfiguration, rate_limit_verify: 100000 },
    productionEnvironment,
  );

  assert.equal(result.status, 'failed');
  assert.ok(
    result.problems.some((problem) => problem.includes('rate_limit_verify') && problem.includes('effectively disabled')),
    'a neutered rate limit must be flagged',
  );
});

test('hosted Auth preflight is read-only, exact-target guarded and never prints the access token', () => {
  assert.match(script, /GET|fetch\(/);
  assert.doesNotMatch(script, /method:\s*['"]PATCH['"]/);
  assert.doesNotMatch(script, /method:\s*['"]POST['"]/);
  assert.match(script, /FINDIT_ALLOW_HOSTED_AUTH_PREFLIGHT/);
  assert.match(script, /FINDIT_EXPECTED_PROJECT_REF/);
  assert.match(script, /api\.supabase\.com\/v1\/projects\/\$\{expectedProjectRef\}\/config\/auth/);
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*accessToken/);
  assert.doesNotMatch(script, /response\.text\(\)/);
});

test('Auth hardening preflight is an explicit documented release gate', () => {
  assert.equal(
    packageJson.scripts['verify:hosted-auth-hardening'],
    'node ./scripts/verify-hosted-auth-hardening.mjs',
  );
  for (const name of [
    'FINDIT_ALLOW_HOSTED_AUTH_PREFLIGHT',
    'FINDIT_EXPECT_AUTH_SITE_URL',
    'FINDIT_EXPECT_AUTH_REDIRECT_URLS',
    'FINDIT_EXPECT_PASSWORD_MIN_LENGTH',
    'FINDIT_EXPECT_LEAKED_PASSWORD_PROTECTION',
    'FINDIT_EXPECT_TOTP_MFA',
    'FINDIT_EXPECT_AUTH_CAPTCHA',
    'FINDIT_EXPECT_CUSTOM_SMTP',
  ]) {
    assert.match(environmentDocumentation, new RegExp(name));
  }
  assert.match(deploymentRunbook, /npm\.cmd run verify:hosted-auth-hardening/);
  assert.match(deploymentRunbook, /Management API token must not enter ordinary PR CI/);
  assert.match(deploymentRunbook, /GET-only and exact-target guarded/);
});
