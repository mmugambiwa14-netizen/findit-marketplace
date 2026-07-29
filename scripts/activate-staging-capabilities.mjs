import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL;
const publishableKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const expectedProjectRef = process.env.FINDIT_EXPECTED_PROJECT_REF;

if (!url || !publishableKey || !secretKey || !expectedProjectRef) {
  throw new Error('Staging activation requires the Supabase URL, publishable key, secret key, and expected project ref.');
}
if (process.env.FINDIT_ALLOW_STAGING_ACTIVATION !== 'staging') {
  throw new Error('FINDIT_ALLOW_STAGING_ACTIVATION=staging is required.');
}

const target = assertSmokeTarget(url, 'Capability activation');
if (target.label !== 'hosted staging' || new URL(url).hostname.split('.')[0] !== expectedProjectRef) {
  throw new Error('Capability activation is restricted to the exact guarded staging project.');
}

const clientOptions = {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
};
const root = createClient(url, secretKey, clientOptions);
const founder = createClient(url, publishableKey, clientOptions);

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

const tourConfiguration = {
  maxDurationSeconds: 120,
  maxSourceBytes: 262144000,
  publicHeight: 720,
  sourceRetentionDays: 7,
  maxProcessingAttempts: 3,
};
const initialTourControl = success(
  await root.from('marketplace_feature_controls')
    .select('enabled,configuration')
    .eq('feature_key', 'tours')
    .maybeSingle(),
  'read initial Peek backend state',
);
const initialPolicies = success(
  await root.from('recommendation_service_policies')
    .select('service_name,enabled,timeout_ms,cache_fresh_seconds,cache_stale_seconds,maximum_page_size,configuration')
    .order('service_name'),
  'read initial recommendation policies',
);
assert.equal(initialPolicies.length, 7, 'all seven recommendation policies must exist');

let founderReady = false;
try {
  const founders = success(
    await root.from('users').select('email').eq('role', 'admin').eq('super_admin', true),
    'locate staging founder',
  );
  assert.equal(founders.length, 1, 'staging must have exactly one founder admin');
  const generatedLink = success(
    await root.auth.admin.generateLink({ type: 'magiclink', email: founders[0].email }),
    'create one-time staging founder session',
  );
  success(
    await founder.auth.verifyOtp({ token_hash: generatedLink.properties.hashed_token, type: 'magiclink' }),
    'start one-time staging founder session',
  );
  founderReady = true;

  for (const policy of initialPolicies) {
    success(await founder.rpc('admin_update_recommendation_service_policy_v1', {
      p_service_name: policy.service_name,
      p_enabled: true,
      p_timeout_ms: policy.timeout_ms,
      p_cache_fresh_seconds: policy.cache_fresh_seconds,
      p_cache_stale_seconds: policy.cache_stale_seconds,
      p_maximum_page_size: policy.maximum_page_size,
      p_configuration: policy.configuration,
    }), `enable ${policy.service_name}`);
  }
  success(await root.rpc('set_backend_feature_enabled', {
    p_feature_key: 'tours',
    p_enabled: true,
    p_configuration: tourConfiguration,
  }), 'enable Peek backend');

  const activePolicies = success(
    await root.from('recommendation_service_policies')
      .select('service_name,enabled')
      .order('service_name'),
    'verify active recommendation policies',
  );
  assert.equal(activePolicies.length, 7);
  assert.ok(activePolicies.every((policy) => policy.enabled), 'every recommendation policy must remain enabled');
  assert.equal(
    success(await root.rpc('is_backend_feature_enabled', { p_feature_key: 'tours' }), 'verify Peek backend'),
    true,
  );
  console.log(`Staging capabilities active: Peek backend and ${activePolicies.length} recommendation policies.`);
} catch (error) {
  if (founderReady) {
    for (const policy of initialPolicies) {
      await founder.rpc('admin_update_recommendation_service_policy_v1', {
        p_service_name: policy.service_name,
        p_enabled: policy.enabled,
        p_timeout_ms: policy.timeout_ms,
        p_cache_fresh_seconds: policy.cache_fresh_seconds,
        p_cache_stale_seconds: policy.cache_stale_seconds,
        p_maximum_page_size: policy.maximum_page_size,
        p_configuration: policy.configuration,
      });
    }
  }
  await root.rpc('set_backend_feature_enabled', {
    p_feature_key: 'tours',
    p_enabled: initialTourControl?.enabled ?? false,
    p_configuration: initialTourControl?.configuration ?? tourConfiguration,
  });
  throw error;
} finally {
  await founder.auth.signOut();
}

