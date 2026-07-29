import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL;
const publishableKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const managementAccessToken = process.env.FINDIT_SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.FINDIT_EXPECTED_PROJECT_REF;

if (!url || !publishableKey || !secretKey || !managementAccessToken || !projectRef) {
  throw new Error(
    'FINDIT_SUPABASE_URL, FINDIT_SUPABASE_ANON_KEY, FINDIT_SUPABASE_SECRET_KEY, '
    + 'FINDIT_SUPABASE_ACCESS_TOKEN, and FINDIT_EXPECTED_PROJECT_REF are required.',
  );
}

const smokeTarget = assertSmokeTarget(url, 'The recommendation Phase 3 certification');
if (smokeTarget.label !== 'hosted staging') {
  throw new Error('Recommendation Phase 3 certification is reserved for the guarded hosted staging target.');
}
if (process.env.FINDIT_ALLOW_STAGING_TIMEOUT_LOCK !== 'staging') {
  throw new Error('FINDIT_ALLOW_STAGING_TIMEOUT_LOCK=staging is required for the bounded timeout test.');
}

const origin = process.env.FINDIT_RECOMMENDATION_SMOKE_ORIGIN ?? smokeTarget.origin;
const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};
const root = createClient(url, secretKey, clientOptions);
const owner = createClient(url, publishableKey, clientOptions);
const admin = createClient(url, publishableKey, clientOptions);
const anonymous = createClient(url, publishableKey, clientOptions);
const stamp = Date.now();
const password = `FindIt-${crypto.randomBytes(24).toString('base64url')}!9aA`;
const ownerEmail = `findit-recommendation-owner-${stamp}@example.test`;
const listingIds = [];
let ownerId;
let enabledThisRun = false;
let certificationPassed = false;
let adminSessionReady = false;
let initialRecentPolicy;

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

async function functionRequest(path, body, authorization) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${url}/functions/v1/${path}`, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        apikey: publishableKey,
        'Cache-Control': 'no-cache',
        Origin: origin,
        'Content-Type': 'application/json',
        'x-client-info': 'findit-phase3-staging-certification',
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
      },
      body: JSON.stringify(body),
    });
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      // Status assertions below retain the useful failure boundary.
    }
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function preflight(path) {
  let response;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await fetch(`${url}/functions/v1/${path}`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, apikey, content-type, x-client-info',
      },
    });
    if (response.status < 500 || attempt === 3) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 150));
  }
  assert.ok(response, `${path} browser preflight did not execute`);
  assert.equal(response.status, 204, `${path} browser preflight failed`);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  const allowedHeaders = response.headers.get('access-control-allow-headers') ?? '';
  for (const header of ['authorization', 'apikey', 'content-type', 'x-client-info']) {
    assert.match(allowedHeaders, new RegExp(header, 'i'), `${path} must allow ${header}`);
  }
}

async function purgeRecentlyListedCache() {
  success(await admin.rpc('admin_purge_recommendation_service_cache_v1', {
    p_service_name: 'recently_listed_service',
    p_subject_listing_id: null,
    p_limit: 5000,
  }), 'purge recently-listed cache');
}

async function managementQuery(query, readOnly) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${managementAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, read_only: readOnly }),
    },
  );
  assert.equal(response.ok, true, `staging management query failed with HTTP ${response.status}`);
  return response.json();
}

async function waitForProjectionLock(applicationName) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await managementQuery(`
      select exists (
        select 1
        from pg_stat_activity
        where application_name = '${applicationName}'
          and state = 'active'
          and wait_event = 'PgSleep'
      ) as lock_active;
    `, true);
    if (result[0]?.lock_active === true) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The bounded staging timeout lock did not become active.');
}

async function waitForCircuit(expectedOpen, minimumFailures = 0) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = success(await root.rpc('recommendation_service_runtime_state_v1', {
      p_service_name: 'recently_listed_service',
    }), 'read recommendation circuit state');
    if (
      state.circuitOpen === expectedOpen
      && state.consecutiveFailures >= minimumFailures
    ) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Recommendation circuit did not reach expected open state: ${expectedOpen}.`);
}

try {
  const initialPolicies = success(
    await root
      .from('recommendation_service_policies')
      .select('id,service_name,enabled,timeout_ms,cache_fresh_seconds,cache_stale_seconds,maximum_page_size,configuration')
      .order('service_name'),
    'read initial recommendation policies',
  );
  assert.equal(initialPolicies.length, 7, 'staging must contain exactly seven recommendation policies');
  const unexpectedlyEnabled = initialPolicies.filter(
    (policy) => policy.enabled && policy.service_name !== 'recently_listed_service',
  );
  assert.deepEqual(
    unexpectedlyEnabled,
    [],
    'certification refuses to run while another recommendation policy is enabled',
  );

  const recentPolicy = initialPolicies.find(
    (policy) => policy.service_name === 'recently_listed_service',
  );
  assert.ok(recentPolicy, 'recently-listed policy is missing');
  initialRecentPolicy = recentPolicy;

  ownerId = success(await root.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Recommendation Certification Owner' },
  }), 'create certification owner').user.id;
  assert.ok(ownerId, 'certification owner was not created');
  const ownerSession = success(
    await owner.auth.signInWithPassword({ email: ownerEmail, password }),
    'sign in certification owner',
  ).session;

  assert.equal(
    process.env.FINDIT_ALLOW_STAGING_FOUNDER_SESSION,
    'staging',
    'FINDIT_ALLOW_STAGING_FOUNDER_SESSION=staging is required for the audited policy change',
  );
  const stagingFounders = success(
    await root
      .from('users')
      .select('email')
      .eq('role', 'admin')
      .eq('super_admin', true),
    'locate staging founder',
  );
  assert.equal(stagingFounders.length, 1, 'staging must have exactly one founder identity');
  const generatedLink = success(await root.auth.admin.generateLink({
    type: 'magiclink',
    email: stagingFounders[0].email,
  }), 'generate one-time staging founder session');
  const hashedToken = generatedLink.properties?.hashed_token;
  assert.ok(hashedToken, 'Supabase did not return a one-time founder token');
  success(await admin.auth.verifyOtp({
    token_hash: hashedToken,
    type: 'magiclink',
  }), 'start one-time staging founder session');
  adminSessionReady = true;

  const longDescription = [
    'Disposable hosted staging fixture for recommendation transport certification.',
    'It contains enough complete listing information to exercise the real projection, ranking,',
    'contextual planning, cache, authentication, and failure-isolation boundaries.',
  ].join(' ');
  const listings = success(await root.from('listings').insert([
    {
      kind: 'property',
      seller_id: ownerId,
      seller_name: 'Recommendation Certification',
      contact_email: ownerEmail,
      title: 'Recommendation certification property one',
      description: longDescription,
      price: 125000,
      currency: 'USD',
      category: 'certification_property',
      listing_type: 'sale',
      status: 'available',
      photos: [],
    },
    {
      kind: 'property',
      seller_id: ownerId,
      seller_name: 'Recommendation Certification',
      contact_email: ownerEmail,
      title: 'Recommendation certification property two',
      description: longDescription,
      price: 135000,
      currency: 'USD',
      category: 'certification_property',
      listing_type: 'sale',
      status: 'available',
      photos: [],
    },
    {
      kind: 'property',
      seller_id: ownerId,
      seller_name: 'Recommendation Certification',
      contact_email: ownerEmail,
      title: 'Recommendation certification property three',
      description: longDescription,
      price: 145000,
      currency: 'USD',
      category: 'certification_property',
      listing_type: 'sale',
      status: 'available',
      photos: [],
    },
  ]).select('id'), 'create recommendation listings');
  listingIds.push(...listings.map((listing) => listing.id));
  assert.equal(listingIds.length, 3);

  success(await root.from('property_details').insert(listingIds.map((listingId, index) => ({
    listing_id: listingId,
    property_type: 'house',
    bedrooms: 2 + index,
    bathrooms: 2,
    size_sqm: 100 + (index * 20),
  }))), 'create recommendation listing details');

  for (const listingId of listingIds) {
    assert.equal(
      success(
        await root.rpc('refresh_listing_recommendation_feature', { p_listing_id: listingId }),
        `refresh recommendation projection ${listingId}`,
      ),
      true,
    );
  }
  const projected = success(
    await root
      .from('eligible_listing_recommendation_features')
      .select('listing_id')
      .in('listing_id', listingIds),
    'read eligible recommendation projections',
  );
  assert.equal(projected.length, 3, 'all certification listings must be recommendation eligible');

  const updatedPolicy = recentPolicy.enabled ? recentPolicy : success(
    await admin.rpc('admin_update_recommendation_service_policy_v1', {
      p_service_name: recentPolicy.service_name,
      p_enabled: true,
      p_timeout_ms: recentPolicy.timeout_ms,
      p_cache_fresh_seconds: recentPolicy.cache_fresh_seconds,
      p_cache_stale_seconds: recentPolicy.cache_stale_seconds,
      p_maximum_page_size: recentPolicy.maximum_page_size,
      p_configuration: recentPolicy.configuration,
    }),
    'enable recently-listed service',
  );
  assert.equal(updatedPolicy.enabled, true);
  if (!recentPolicy.enabled) {
    enabledThisRun = true;
  }

  const enabledPolicies = success(
    await root
      .from('recommendation_service_policies')
      .select('service_name')
      .eq('enabled', true),
    'read enabled recommendation policies',
  );
  assert.deepEqual(
    enabledPolicies.map((policy) => policy.service_name),
    ['recently_listed_service'],
    'exactly recently-listed must be enabled',
  );

  await preflight('recently-listed');
  await preflight('contextual-ecosystem');

  const invalidOrigin = await fetch(`${url}/functions/v1/recently-listed`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://untrusted.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization, apikey, content-type, x-client-info',
    },
  });
  assert.equal(invalidOrigin.status, 403, 'untrusted browser origins must be rejected');

  await purgeRecentlyListedCache();
  const recent = await functionRequest('recently-listed', { cursor: null, limit: 6 });
  assert.equal(recent.response.status, 200);
  assert.equal(recent.payload.contractVersion, 1);
  assert.equal(recent.payload.service, 'recently_listed_service');
  assert.equal(recent.payload.degraded, false);
  assert.ok(Array.isArray(recent.payload.items));
  assert.ok(recent.payload.items.length >= 3, 'recently-listed must return real staging results');
  assert.ok(
    listingIds.every((listingId) => recent.payload.items.some((item) => item.listingId === listingId)),
    'recently-listed response must include every certification fixture',
  );

  const disabledServices = [
    'similar-listings',
    'seller-recommendations',
    'related-services',
    'related-products',
    'nearby-listings',
  ];
  for (const path of disabledServices) {
    const result = await functionRequest(path, {
      subjectListingId: listingIds[0],
      cursor: null,
      limit: 6,
      ...(path === 'nearby-listings' ? { maxDistanceMeters: 50000 } : {}),
    });
    assert.equal(result.response.status, 200, `${path} transport failed`);
    assert.equal(result.payload.degraded, true, `${path} must remain disabled`);
    assert.equal(result.payload.reason, 'service_disabled', `${path} returned an unexpected reason`);
  }

  const directContextual = success(await root.rpc('contextual_ecosystem_plan_v1', {
    p_subject_listing_id: listingIds[0],
    p_journey_stage: null,
    p_max_sections: 6,
  }), 'read contextual plan through PostgREST');
  assert.deepEqual(
    directContextual.sections.map((section) => section.service),
    ['recently_listed_service'],
    'the database planner must select only the enabled service',
  );

  let contextual;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    contextual = await functionRequest(`contextual-ecosystem?certification=${stamp}-${attempt}`, {
      subjectListingId: listingIds[0],
      maxSections: 6,
    });
    assert.equal(contextual.response.status, 200);
    if (contextual.payload.contractVersion === 2 && contextual.payload.degraded !== true) break;
    assert.equal(contextual.payload.degraded, true, 'a cold contextual failure must fail soft');
    assert.ok(
      ['timeout', 'service_unavailable'].includes(contextual.payload.reason),
      'a cold contextual failure must expose a stable reason code',
    );
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.ok(contextual, 'contextual certification did not execute');
  assert.equal(contextual.response.status, 200);
  assert.equal(contextual.payload.contractVersion, 2);
  assert.equal(contextual.payload.subjectListingId, listingIds[0]);
  assert.equal(
    contextual.payload.degraded,
    false,
    `contextual Edge response degraded with reason ${contextual.payload.reason ?? 'unknown'}`,
  );
  assert.deepEqual(
    contextual.payload.sections.map((section) => section.service),
    ['recently_listed_service'],
    'contextual planning must select only the enabled service',
  );

  const unauthenticatedPersonalization = await functionRequest(
    'personalized-recommendations',
    { cursor: null, limit: 6 },
  );
  assert.ok(
    [401, 403].includes(unauthenticatedPersonalization.response.status),
    'personalization must reject an anonymous caller at the gateway',
  );
  const authenticatedPersonalization = await functionRequest(
    'personalized-recommendations',
    { cursor: null, limit: 6 },
    ownerSession.access_token,
  );
  assert.equal(authenticatedPersonalization.response.status, 200);
  assert.equal(authenticatedPersonalization.payload.reason, 'service_disabled');

  const missingRecommendationHealthSecret = await functionRequest(
    'recommendation-service-health',
    {},
  );
  assert.equal(missingRecommendationHealthSecret.response.status, 401);
  const missingContextualHealthSecret = await functionRequest(
    'contextual-ecosystem-health',
    {},
  );
  assert.equal(missingContextualHealthSecret.response.status, 401);

  const recommendationHealth = success(
    await root.rpc('recommendation_services_health_v1'),
    'read recommendation health',
  );
  assert.equal(recommendationHealth.services.length, 7);
  assert.equal(
    recommendationHealth.services.filter((service) => service.enabled).length,
    1,
  );
  const contextualHealth = success(
    await root.rpc('contextual_ecosystem_health_v1'),
    'read contextual health',
  );
  assert.equal(contextualHealth.activeRules, 6);
  assert.equal(contextualHealth.rulesReferencingDisabledServices, 5);

  await purgeRecentlyListedCache();
  const lockApplicationName = `findit_phase3_timeout_${stamp}`;
  const lockStartedAt = Date.now();
  const lockPromise = managementQuery(`
    begin;
    set local application_name = '${lockApplicationName}';
    lock table public.listing_recommendation_features in access exclusive mode;
    select pg_sleep(15);
    commit;
  `, false);
  let lastTimeoutAt = lockStartedAt;
  try {
    await waitForProjectionLock(lockApplicationName);
    for (const limit of [6, 12, 24]) {
      const timedOut = await functionRequest('recently-listed', { cursor: null, limit });
      assert.equal(timedOut.response.status, 200);
      assert.equal(timedOut.payload.degraded, true);
      assert.equal(timedOut.payload.reason, 'timeout');
      lastTimeoutAt = Date.now();
    }

    const openState = await waitForCircuit(true, 3);
    assert.equal(openState.consecutiveFailures, 3);

    const isolated = await functionRequest('recently-listed', { cursor: null, limit: 48 });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.degraded, true);
    assert.equal(isolated.payload.reason, 'circuit_open');

    const listingDuringCircuit = success(
      await anonymous.from('listings').select('id,status').eq('id', listingIds[0]).single(),
      'read listing while recommendation circuit is open',
    );
    assert.equal(listingDuringCircuit.status, 'available');
  } finally {
    let lockError;
    try {
      await lockPromise;
    } catch (error) {
      lockError = error;
    }
    success(await root.rpc('record_recommendation_service_outcome_v1', {
      p_service_name: 'recently_listed_service',
      p_succeeded: true,
      p_failure_threshold: 3,
      p_open_seconds: 30,
    }), 'close recommendation circuit');
    if (lockError) throw lockError;
  }

  const localCircuitRemainingMs = Math.max(0, 31_000 - (Date.now() - lastTimeoutAt));
  await new Promise((resolve) => setTimeout(resolve, localCircuitRemainingMs));
  const recovered = await functionRequest('recently-listed', { cursor: null, limit: 100 });
  assert.equal(recovered.response.status, 200);
  assert.equal(recovered.payload.degraded, false);
  assert.ok(recovered.payload.items.length >= 3);
  const closedState = await waitForCircuit(false);
  assert.equal(closedState.consecutiveFailures, 0);

  console.log('Recommendation Phase 3 hosted staging certification: PASS');
  console.log('Enabled policy: recently_listed_service (all six other policies remain disabled).');
  console.log('Verified real results, browser CORS, authenticated and anonymous boundaries, contextual planning, real timeouts, durable circuit isolation, recovery, and listing independence.');
  certificationPassed = true;
} finally {
  let cleanupError;
  if (listingIds.length) {
    const listingCleanup = await root.from('listings').delete().in('id', listingIds);
    if (listingCleanup.error) cleanupError = listingCleanup.error;
  }
  if (enabledThisRun && !certificationPassed && adminSessionReady && initialRecentPolicy) {
    const policyCleanup = await admin.rpc('admin_update_recommendation_service_policy_v1', {
      p_service_name: initialRecentPolicy.service_name,
      p_enabled: false,
      p_timeout_ms: initialRecentPolicy.timeout_ms,
      p_cache_fresh_seconds: initialRecentPolicy.cache_fresh_seconds,
      p_cache_stale_seconds: initialRecentPolicy.cache_stale_seconds,
      p_maximum_page_size: initialRecentPolicy.maximum_page_size,
      p_configuration: initialRecentPolicy.configuration,
    });
    if (policyCleanup.error) cleanupError ??= policyCleanup.error;
  }
  if (adminSessionReady) {
    const cacheCleanup = await admin.rpc('admin_purge_recommendation_service_cache_v1', {
      p_service_name: 'recently_listed_service',
      p_subject_listing_id: null,
      p_limit: 5000,
    });
    if (cacheCleanup.error) cleanupError ??= cacheCleanup.error;
  }
  const remainingCache = await root
    .from('recommendation_cache')
    .select('cache_key', { count: 'exact', head: true })
    .eq('service_name', 'recently_listed_service');
  if (remainingCache.error) {
    cleanupError ??= remainingCache.error;
  } else if (remainingCache.count !== 0) {
    cleanupError ??= new Error('Recently-listed certification cache rows remain after cleanup.');
  }
  await owner.auth.signOut();
  await admin.auth.signOut();
  if (ownerId) {
    const ownerCleanup = await root.auth.admin.deleteUser(ownerId);
    if (ownerCleanup.error) cleanupError ??= ownerCleanup.error;
  }
  if (cleanupError) throw new Error(`Phase 3 certification cleanup failed: ${cleanupError.message}`);
}
