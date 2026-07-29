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
if (process.env.FINDIT_ALLOW_STAGING_FOUNDER_SESSION !== 'staging') {
  throw new Error('FINDIT_ALLOW_STAGING_FOUNDER_SESSION=staging is required.');
}

const target = assertSmokeTarget(url, 'The recommendation Phase 7 certification');
if (target.label !== 'hosted staging') {
  throw new Error('Recommendation Phase 7 certification is reserved for guarded hosted staging.');
}

const origin = process.env.FINDIT_RECOMMENDATION_SMOKE_ORIGIN ?? target.origin;
const clientOptions = {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
};
const root = createClient(url, secretKey, clientOptions);
const admin = createClient(url, publishableKey, clientOptions);
const owner = createClient(url, publishableKey, clientOptions);
const anonymous = createClient(url, publishableKey, clientOptions);
const stamp = Date.now();
const password = `FindIt-${crypto.randomBytes(24).toString('base64url')}!9aA`;
const ownerEmail = `findit-phase7-owner-${stamp}@example.test`;
const listingIds = [];
const serviceIds = [];
const eventRequestIds = [];
const budgetRows = [];
let locationId;
let ownerId;
let ownerSession;
let initialPolicies = [];
let adminSessionReady = false;
let certificationPassed = false;

const publicServices = [
  {
    policy: 'similar_listings_service',
    path: 'similar-listings',
    expectedEntity: 'listing',
    expectedId: () => listingIds[1],
  },
  {
    policy: 'seller_recommendations_service',
    path: 'seller-recommendations',
    expectedEntity: 'listing',
    expectedId: () => listingIds[1],
  },
  {
    policy: 'related_services_service',
    path: 'related-services',
    expectedEntity: 'service',
    expectedId: () => serviceIds[0],
  },
  {
    policy: 'related_products_service',
    path: 'related-products',
    expectedEntity: 'listing',
    expectedId: () => listingIds[2],
  },
  {
    policy: 'nearby_service',
    path: 'nearby-listings',
    expectedEntity: 'listing',
    expectedId: () => listingIds[1],
  },
];

function success(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message ?? 'unknown error'}`);
  return result.data;
}

async function managementQuery(query, readOnly = false) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${managementAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, read_only: readOnly }),
  });
  assert.equal(response.ok, true, `staging management query failed with HTTP ${response.status}`);
  return response.json();
}

async function functionRequest(path, body, authorization) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url}/functions/v1/${path}?certification=${stamp}-${crypto.randomUUID()}`, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${authorization ?? publishableKey}`,
        'Cache-Control': 'no-cache',
        Origin: origin,
        'Content-Type': 'application/json',
        'x-client-info': 'findit-phase7-staging-certification',
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function preflight(path) {
  const response = await fetch(`${url}/functions/v1/${path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization, apikey, content-type, x-client-info',
    },
  });
  assert.equal(response.status, 204, `${path} browser preflight failed`);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  const allowed = response.headers.get('access-control-allow-headers') ?? '';
  for (const header of ['authorization', 'apikey', 'content-type', 'x-client-info']) {
    assert.match(allowed, new RegExp(header, 'i'), `${path} must allow ${header}`);
  }
}

async function updatePolicy(policy, enabled, configuration = policy.configuration) {
  return success(await admin.rpc('admin_update_recommendation_service_policy_v1', {
    p_service_name: policy.service_name,
    p_enabled: enabled,
    p_timeout_ms: policy.timeout_ms,
    p_cache_fresh_seconds: policy.cache_fresh_seconds,
    p_cache_stale_seconds: policy.cache_stale_seconds,
    p_maximum_page_size: policy.maximum_page_size,
    p_configuration: configuration,
  }), `update ${policy.service_name}`);
}

async function disableEveryPolicy() {
  const current = success(
    await root
      .from('recommendation_service_policies')
      .select('service_name,enabled'),
    'read current policy state',
  );
  for (const state of current.filter((policy) => policy.enabled)) {
    const policy = initialPolicies.find((candidate) => candidate.service_name === state.service_name);
    await updatePolicy(policy, false);
  }
}

async function purgeCache(serviceName) {
  success(await admin.rpc('admin_purge_recommendation_service_cache_v1', {
    p_service_name: serviceName,
    p_subject_listing_id: null,
    p_limit: 5000,
  }), `purge ${serviceName} cache`);
}

function requestBody(path) {
  return {
    subjectListingId: listingIds[0],
    cursor: null,
    limit: 6,
    ...(path === 'nearby-listings' ? { maxDistanceMeters: 50_000 } : {}),
  };
}

async function recordDelivery(result, definition) {
  const item = result.payload.items.find((candidate) => (
    definition.expectedEntity === 'service'
      ? candidate.serviceId === definition.expectedId()
      : candidate.listingId === definition.expectedId()
  ));
  assert.ok(item, `${definition.path} omitted its certification entity`);
  const requestId = result.payload.requestId;
  assert.match(requestId, /^[0-9a-f-]{36}$/i);
  eventRequestIds.push(requestId);
  const context = {
    surface: 'listing_detail',
    source: `certification:${definition.path}`,
    position: 0,
    page_size: 1,
    result_count: 1,
  };

  if (definition.expectedEntity === 'service') {
    for (const eventType of ['recommendation_impression', 'recommendation_click']) {
      success(await anonymous.rpc('record_recommended_service_event_v1', {
        p_event_type: eventType,
        p_service_id: item.serviceId,
        p_anonymous_session_id: crypto.randomUUID(),
        p_recommendation_request_id: requestId,
        p_recommendation_service: result.payload.service,
        p_reason_code: item.reasonCode,
        p_context: context,
      }), `record ${definition.path} ${eventType}`);
    }
  } else {
    for (const eventType of ['recommendation_impression', 'recommendation_click']) {
      success(await anonymous.rpc('record_recommendation_event', {
        p_event_type: eventType,
        p_listing_id: item.listingId,
        p_seller_id: item.sellerId,
        p_anonymous_session_id: crypto.randomUUID(),
        p_recommendation_request_id: requestId,
        p_recommendation_service: result.payload.service,
        p_reason_code: item.reasonCode,
        p_context: context,
      }), `record ${definition.path} ${eventType}`);
    }
  }
}

async function assertHydration(result, definition) {
  if (definition.expectedEntity === 'service') {
    const hydrated = success(
      await anonymous
        .from('services')
        .select('id,status,category')
        .eq('id', definition.expectedId())
        .eq('status', 'active')
        .single(),
      'hydrate recommended service through browser PostgREST',
    );
    assert.notEqual(hydrated.category, 'legal');
    return;
  }
  const hydrated = success(
    await anonymous
      .from('listings')
      .select('id,status')
      .eq('id', definition.expectedId())
      .single(),
    'hydrate recommended listing through browser PostgREST',
  );
  assert.equal(hydrated.status, 'available');
}

try {
  initialPolicies = success(
    await root
      .from('recommendation_service_policies')
      .select('service_name,enabled,timeout_ms,cache_fresh_seconds,cache_stale_seconds,maximum_page_size,configuration')
      .order('service_name'),
    'read initial policies',
  );
  assert.equal(initialPolicies.length, 7);
  const initiallyEnabled = initialPolicies.filter((policy) => policy.enabled).map((policy) => policy.service_name);
  assert.ok(
    (initiallyEnabled.length === 1 && initiallyEnabled[0] === 'recently_listed_service')
      || initiallyEnabled.length === 7,
    'Phase 7 requires either the certified one-policy baseline or the fully active staging release state',
  );

  const stagingFounders = success(
    await root.from('users').select('email').eq('role', 'admin').eq('super_admin', true),
    'locate staging founder',
  );
  assert.equal(stagingFounders.length, 1);
  const generatedLink = success(await root.auth.admin.generateLink({
    type: 'magiclink',
    email: stagingFounders[0].email,
  }), 'generate one-time founder session');
  success(await admin.auth.verifyOtp({
    token_hash: generatedLink.properties.hashed_token,
    type: 'magiclink',
  }), 'start one-time founder session');
  adminSessionReady = true;

  ownerId = success(await root.auth.admin.createUser({
    email: ownerEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Phase 7 Certification Owner' },
  }), 'create certification owner').user.id;
  ownerSession = success(
    await owner.auth.signInWithPassword({ email: ownerEmail, password }),
    'sign in certification owner',
  ).session;

  locationId = success(await root.from('locations').insert({
    name: `Phase 7 Test City ${stamp}`,
    type: 'city',
    country_code: 'ZW',
    latitude: -17.8252,
    longitude: 31.0335,
    is_active: true,
  }).select('id').single(), 'create certification location').id;

  const longDescription = [
    'Disposable hosted staging fixture for recommendation Phase 7 certification.',
    'It exercises listing similarity, seller inventory, related products, nearby discovery,',
    'marketplace services, personalization, aggregate analytics, and independent listing delivery.',
  ].join(' ');
  const createdListings = success(await root.from('listings').insert([
    {
      kind: 'car', seller_id: ownerId, seller_name: 'Phase 7 Certification',
      contact_email: ownerEmail, title: 'Phase 7 subject vehicle',
      description: longDescription, price: 22000, currency: 'USD',
      category: 'sedans', listing_type: 'sale', status: 'available',
      photos: [], location_id: locationId, country_code: 'ZW',
    },
    {
      kind: 'car', seller_id: ownerId, seller_name: 'Phase 7 Certification',
      contact_email: ownerEmail, title: 'Phase 7 similar nearby vehicle',
      description: longDescription, price: 23000, currency: 'USD',
      category: 'sedans', listing_type: 'sale', status: 'available',
      photos: [], location_id: locationId, country_code: 'ZW',
    },
    {
      kind: 'car', seller_id: ownerId, seller_name: 'Phase 7 Certification',
      contact_email: ownerEmail, title: 'Phase 7 related tyre product',
      description: longDescription, price: 800, currency: 'USD',
      category: 'vehicle-tyres', listing_type: 'sale', status: 'available',
      photos: [], location_id: locationId, country_code: 'ZW',
    },
  ]).select('id'), 'create certification listings');
  listingIds.push(...createdListings.map((listing) => listing.id));

  success(await root.from('car_details').insert(listingIds.map((listingId, index) => ({
    listing_id: listingId,
    brand: 'Toyota',
    model: index === 2 ? 'Tyre package' : 'Corolla',
    year: 2022,
    mileage: 20_000 + (index * 1000),
    fuel_type: 'petrol',
    transmission: 'automatic',
    condition: 'used',
  }))), 'create certification vehicle details');

  const createdService = success(await root.from('services').insert({
    provider_id: ownerId,
    provider_name: 'Phase 7 Certification',
    contact_email: ownerEmail,
    title: 'Phase 7 vehicle inspection',
    description: longDescription,
    category: 'mechanic',
    subcategory: 'vehicle-inspection',
    subcategories: ['vehicle-inspection'],
    price: 75,
    currency: 'USD',
    pricing_type: 'fixed',
    location_id: locationId,
    location_name: `Phase 7 Test City ${stamp}`,
    status: 'active',
    verified: true,
    photos: [],
  }).select('id').single(), 'create certification service');
  serviceIds.push(createdService.id);

  for (const listingId of listingIds) {
    assert.equal(success(
      await root.rpc('refresh_listing_recommendation_feature', { p_listing_id: listingId }),
      `refresh ${listingId}`,
    ), true);
  }

  for (const definition of publicServices) await preflight(definition.path);
  await disableEveryPolicy();

  for (const definition of publicServices) {
    const policy = initialPolicies.find((candidate) => candidate.service_name === definition.policy);
    const configuration = definition.policy === 'similar_listings_service'
      ? { ...policy.configuration, request_budget_per_window: 2, request_budget_window_seconds: 3600 }
      : policy.configuration;
    await updatePolicy(policy, true, configuration);
    await purgeCache(policy.service_name);

    const result = await functionRequest(definition.path, requestBody(definition.path));
    assert.equal(result.response.status, 200, `${definition.path} transport failed`);
    assert.equal(result.payload.degraded, false, `${definition.path}: ${result.payload.reason ?? 'degraded'}`);
    assert.ok(Array.isArray(result.payload.items) && result.payload.items.length > 0);
    await assertHydration(result, definition);
    await recordDelivery(result, definition);

    if (definition.policy === 'similar_listings_service') {
      await purgeCache(policy.service_name);
      const second = await functionRequest(definition.path, requestBody(definition.path));
      assert.equal(second.payload.degraded, false, 'second budgeted request must execute');
      await purgeCache(policy.service_name);
      const exhausted = await functionRequest(definition.path, requestBody(definition.path));
      assert.equal(exhausted.response.status, 200);
      assert.equal(exhausted.payload.degraded, true);
      assert.equal(exhausted.payload.reason, 'request_budget_exhausted');
      const observedBudgetRows = await managementQuery(`
        select client_hash, window_started_at, request_count
        from public.recommendation_request_budget
        where service_name = 'similar_listings_service'
          and updated_at >= to_timestamp(${Math.floor(stamp / 1000)})
          and request_count = 3
        order by updated_at desc;
      `, true);
      assert.equal(observedBudgetRows.length, 1, 'certification request budget row must be uniquely attributable');
      assert.match(observedBudgetRows[0].client_hash, /^[0-9a-f]{64}$/);
      assert.ok(Number.isFinite(Date.parse(observedBudgetRows[0].window_started_at)));
      budgetRows.push(observedBudgetRows[0]);
    }

    const canonical = success(
      await anonymous.from('listings').select('id,status').eq('id', listingIds[0]).single(),
      `read canonical listing while ${definition.path} is enabled`,
    );
    assert.equal(canonical.status, 'available');
    await updatePolicy(policy, false);
    await purgeCache(policy.service_name);
  }

  const personalizedPolicy = initialPolicies.find(
    (policy) => policy.service_name === 'personalized_recommendation_service',
  );
  await updatePolicy(personalizedPolicy, true);
  const defaultPreference = success(
    await owner.rpc('get_my_recommendation_personalization_v1'),
    'read default personalization preference',
  );
  assert.equal(defaultPreference.enabled, false);
  const consentRequired = await functionRequest(
    'personalized-recommendations',
    { cursor: null, limit: 6 },
    ownerSession.access_token,
  );
  assert.equal(consentRequired.response.status, 200);
  assert.equal(consentRequired.payload.reason, 'personalization_not_enabled');

  success(await owner.rpc('set_my_recommendation_personalization_v1', { p_enabled: true }), 'enable personalization');
  success(await owner.rpc('record_recommendation_event', {
    p_event_type: 'view',
    p_listing_id: listingIds[0],
    p_seller_id: ownerId,
    p_anonymous_session_id: null,
    p_recommendation_request_id: null,
    p_recommendation_service: null,
    p_reason_code: null,
    p_context: { surface: 'listing_detail' },
  }), 'record post-consent owner activity');
  const personalized = await functionRequest(
    'personalized-recommendations',
    { cursor: null, limit: 6 },
    ownerSession.access_token,
  );
  assert.equal(personalized.response.status, 200);
  assert.equal(personalized.payload.degraded, false);
  assert.ok(personalized.payload.items.length > 0);
  success(await owner.rpc('clear_my_recommendation_personalization_data_v1'), 'clear personalization data');
  const cleared = await functionRequest(
    'personalized-recommendations',
    { cursor: null, limit: 6 },
    ownerSession.access_token,
  );
  assert.equal(cleared.payload.reason, 'personalization_not_enabled');
  await updatePolicy(personalizedPolicy, false);

  success(
    await root.rpc('refresh_recommendation_service_metrics_daily_v1', { p_metric_date: new Date().toISOString().slice(0, 10) }),
    'refresh aggregate analytics',
  );
  const analytics = success(
    await admin.rpc('admin_recommendation_analytics_v1', {
      p_start_date: new Date().toISOString().slice(0, 10),
      p_end_date: new Date().toISOString().slice(0, 10),
    }),
    'read aggregate analytics',
  );
  assert.ok(Number(analytics.summary.impressions) >= publicServices.length);
  assert.ok(Number(analytics.summary.clicks) >= publicServices.length);
  assert.equal(
    /actor_id|anonymous_session_id|listing_id|seller_id|recommendation_request_id/i.test(JSON.stringify(analytics)),
    false,
    'admin analytics must contain no behavioural identity fields',
  );

  console.log('Recommendation Phase 7 hosted staging certification: PASS');
  console.log('Verified five public transports, typed service hydration, request budgets, consent-gated personalization, aggregate analytics, and listing independence.');
  certificationPassed = true;
} finally {
  let cleanupError;

  for (const budget of budgetRows) {
    try {
      await managementQuery(`
        delete from public.recommendation_request_budget
        where client_hash = '${budget.client_hash}'
          and service_name = 'similar_listings_service'
          and window_started_at = '${budget.window_started_at}'::timestamptz;
      `);
    } catch (error) {
      cleanupError ??= error;
    }
  }

  if (eventRequestIds.length) {
    try {
      const ids = eventRequestIds.map((id) => `'${id}'::uuid`).join(',');
      await managementQuery(`
        delete from public.recommendation_events
        where recommendation_request_id in (${ids});
      `);
      await root.rpc('refresh_recommendation_service_metrics_daily_v1', {
        p_metric_date: new Date().toISOString().slice(0, 10),
      });
    } catch (error) {
      cleanupError ??= error;
    }
  }

  if (adminSessionReady && initialPolicies.length === 7) {
    for (const policy of initialPolicies) {
      try {
        await updatePolicy(policy, policy.enabled, policy.configuration);
        await purgeCache(policy.service_name);
      } catch (error) {
        cleanupError ??= error;
      }
    }
  }

  if (serviceIds.length) {
    const result = await root.from('services').delete().in('id', serviceIds);
    if (result.error) cleanupError ??= result.error;
  }
  if (listingIds.length) {
    const result = await root.from('listings').delete().in('id', listingIds);
    if (result.error) cleanupError ??= result.error;
  }
  if (locationId) {
    const result = await root.from('locations').delete().eq('id', locationId);
    if (result.error) cleanupError ??= result.error;
  }
  await owner.auth.signOut();
  await admin.auth.signOut();
  if (ownerId) {
    const result = await root.auth.admin.deleteUser(ownerId);
    if (result.error) cleanupError ??= result.error;
  }

  if (cleanupError) throw new Error(`Phase 7 certification cleanup failed: ${cleanupError.message}`);
  if (!certificationPassed) process.exitCode = 1;
}
