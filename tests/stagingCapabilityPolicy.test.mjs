import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRUSTED_STAGING_BRANCHES,
  isTrustedStagingBranch,
  isTrustedStagingHost,
  readBooleanFlag,
  resolveStagingCertifiedFlag,
  resolveStagingProviderFlag,
} from '../src/lib/stagingCapabilityPolicy.js';

test('all certified staging branches are recognized', () => {
  for (const branch of TRUSTED_STAGING_BRANCHES) {
    assert.equal(
      isTrustedStagingBranch({ VITE_VERCEL_GIT_COMMIT_REF: branch }),
      true,
      branch,
    );
  }
});

test('server-side Vercel branch metadata is recognized', () => {
  assert.equal(
    isTrustedStagingBranch({ VERCEL_GIT_COMMIT_REF: 'feature/listing-intelligence-foundation' }),
    true,
  );
});

test('unknown and missing branches fail closed', () => {
  assert.equal(isTrustedStagingBranch({}), false);
  assert.equal(
    isTrustedStagingBranch({ VITE_VERCEL_GIT_COMMIT_REF: 'feature/untrusted-preview' }),
    false,
  );
});

test('stable and generated FindIt staging hosts are recognized', () => {
  assert.equal(isTrustedStagingHost('findit-marketplace-staging.vercel.app'), true);
  assert.equal(isTrustedStagingHost('findit-marketplace-staging-iwgkds7gn.vercel.app'), true);
  assert.equal(isTrustedStagingHost('findit-marketplace-stagi-git-18ac2e-team.vercel.app'), true);
});

test('production-looking and unrelated hosts fail closed', () => {
  assert.equal(isTrustedStagingHost('findit-marketplace.vercel.app'), false);
  assert.equal(isTrustedStagingHost('findit-marketplace-staging.example.com'), false);
  assert.equal(isTrustedStagingHost('example.vercel.app'), false);
  assert.equal(isTrustedStagingHost(''), false);
});

test('ordinary boolean flags preserve explicit values and fallback', () => {
  assert.equal(readBooleanFlag({}, 'VITE_FEATURE_TEST'), false);
  assert.equal(readBooleanFlag({}, 'VITE_FEATURE_TEST', true), true);
  assert.equal(readBooleanFlag({ VITE_FEATURE_TEST: 'true' }, 'VITE_FEATURE_TEST'), true);
  assert.equal(readBooleanFlag({ VITE_FEATURE_TEST: true }, 'VITE_FEATURE_TEST'), true);
  assert.equal(readBooleanFlag({ VITE_FEATURE_TEST: 'false' }, 'VITE_FEATURE_TEST'), false);
});

test('certified capabilities inherit availability on trusted staging', () => {
  const env = {
    VITE_VERCEL_GIT_COMMIT_REF: 'feature/peek-threads-phase-3',
    VITE_FEATURE_MESSAGING: 'false',
  };
  assert.equal(resolveStagingCertifiedFlag(env, 'VITE_FEATURE_MESSAGING'), true);
});

test('certified capabilities remain explicit outside trusted staging', () => {
  assert.equal(
    resolveStagingCertifiedFlag(
      {
        VITE_VERCEL_GIT_COMMIT_REF: 'feature/untrusted-preview',
        VITE_FEATURE_MESSAGING: 'false',
      },
      'VITE_FEATURE_MESSAGING',
    ),
    false,
  );
  assert.equal(
    resolveStagingCertifiedFlag(
      {
        VITE_VERCEL_GIT_COMMIT_REF: 'feature/untrusted-preview',
        VITE_FEATURE_MESSAGING: 'true',
      },
      'VITE_FEATURE_MESSAGING',
    ),
    true,
  );
});

test('provider capability is inherited on trusted staging when unset', () => {
  assert.equal(
    resolveStagingProviderFlag(
      { VITE_VERCEL_GIT_COMMIT_REF: 'feature/peek-threads-phase-3' },
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
        VITE_VERCEL_GIT_COMMIT_REF: 'feature/peek-threads-phase-3',
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
