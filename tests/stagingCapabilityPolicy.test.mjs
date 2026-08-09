import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRUSTED_NON_PRODUCTION_DEPLOYMENTS,
  isTrustedStagingDeployment,
  isTrustedStagingHost,
  readBooleanFlag,
  resolveStagingCertifiedFlag,
  resolveStagingProviderFlag,
} from '../src/lib/stagingCapabilityPolicy.js';

test('Cloudflare preview and staging deployments are recognized', () => {
  for (const deployment of TRUSTED_NON_PRODUCTION_DEPLOYMENTS) {
    assert.equal(
      isTrustedStagingDeployment({ VITE_DEPLOY_ENV: deployment }),
      true,
      deployment,
    );
  }
});

test('production, unknown and missing deployment values fail closed', () => {
  assert.equal(isTrustedStagingDeployment({}), false);
  assert.equal(isTrustedStagingDeployment({ VITE_DEPLOY_ENV: 'production' }), false);
  assert.equal(isTrustedStagingDeployment({ VITE_DEPLOY_ENV: 'untrusted-preview' }), false);
});

test('the dedicated Cloudflare staging custom domain is recognized', () => {
  assert.equal(isTrustedStagingHost('staging.peekalisting.com'), true);
  assert.equal(isTrustedStagingHost('STAGING.PEEKALISTING.COM'), true);
});

test('production and generated platform hosts are not trusted by hostname alone', () => {
  assert.equal(isTrustedStagingHost('peekalisting.com'), false);
  assert.equal(isTrustedStagingHost('www.peekalisting.com'), false);
  assert.equal(isTrustedStagingHost('findit-marketplace.pages.dev'), false);
  assert.equal(isTrustedStagingHost('abc123.findit-marketplace.pages.dev'), false);
  assert.equal(isTrustedStagingHost(''), false);
});

test('ordinary boolean flags preserve explicit values and fallback', () => {
  assert.equal(readBooleanFlag({}, 'VITE_FEATURE_TEST'), false);
  assert.equal(readBooleanFlag({}, 'VITE_FEATURE_TEST', true), true);
  assert.equal(readBooleanFlag({ VITE_FEATURE_TEST: 'true' }, 'VITE_FEATURE_TEST'), true);
  assert.equal(readBooleanFlag({ VITE_FEATURE_TEST: true }, 'VITE_FEATURE_TEST'), true);
  assert.equal(readBooleanFlag({ VITE_FEATURE_TEST: 'false' }, 'VITE_FEATURE_TEST'), false);
});

test('certified capabilities inherit availability on trusted Cloudflare preview', () => {
  const env = {
    VITE_DEPLOY_ENV: 'preview',
    VITE_FEATURE_MESSAGING: 'false',
  };
  assert.equal(resolveStagingCertifiedFlag(env, 'VITE_FEATURE_MESSAGING'), true);
});

test('certified capabilities remain explicit in production', () => {
  assert.equal(
    resolveStagingCertifiedFlag(
      {
        VITE_DEPLOY_ENV: 'production',
        VITE_FEATURE_MESSAGING: 'false',
      },
      'VITE_FEATURE_MESSAGING',
    ),
    false,
  );
  assert.equal(
    resolveStagingCertifiedFlag(
      {
        VITE_DEPLOY_ENV: 'production',
        VITE_FEATURE_MESSAGING: 'true',
      },
      'VITE_FEATURE_MESSAGING',
    ),
    true,
  );
});

test('provider capability is inherited on trusted Cloudflare staging when unset', () => {
  assert.equal(
    resolveStagingProviderFlag(
      { VITE_DEPLOY_ENV: 'staging' },
      'VITE_FEATURE_GOOGLE_OAUTH',
      'VITE_AUTH_GOOGLE_ENABLED',
    ),
    true,
  );
});

test('explicit provider false is an emergency off switch on trusted staging', () => {
  assert.equal(
    resolveStagingProviderFlag(
      {
        VITE_DEPLOY_ENV: 'staging',
        VITE_FEATURE_GOOGLE_OAUTH: 'false',
        VITE_AUTH_GOOGLE_ENABLED: 'true',
      },
      'VITE_FEATURE_GOOGLE_OAUTH',
      'VITE_AUTH_GOOGLE_ENABLED',
    ),
    false,
  );
});

test('provider policy supports the legacy variable and fails closed elsewhere', () => {
  assert.equal(
    resolveStagingProviderFlag(
      { VITE_AUTH_GOOGLE_ENABLED: 'true' },
      'VITE_FEATURE_GOOGLE_OAUTH',
      'VITE_AUTH_GOOGLE_ENABLED',
    ),
    true,
  );
  assert.equal(
    resolveStagingProviderFlag(
      {},
      'VITE_FEATURE_GOOGLE_OAUTH',
      'VITE_AUTH_GOOGLE_ENABLED',
    ),
    false,
  );
});
