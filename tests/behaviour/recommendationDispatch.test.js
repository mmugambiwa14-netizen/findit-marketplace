import { describe, expect, test, vi, beforeEach } from 'vitest';

// Collapsing six Edge Functions into one moved the service name from a
// deploy-time constant into a client-supplied body field. That is a real change
// in what the browser controls, so these tests pin the two things that matter:
// every public service reaches the multiplexed endpoint with a correct dispatch
// field, and the authenticated service still goes to its own function -- the one
// whose gateway verify_jwt check is the reason it was kept separate.

const invoke = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { functions: { invoke: (...args) => invoke(...args) } },
}));

const services = await import('@/services/recommendationServices');

const SUBJECT = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const okPayload = (service, items = []) => ({
  data: {
    contractVersion: 1,
    service,
    requestId: '9c858901-8a57-4791-81fe-4c455b099bc9',
    items,
    nextCursor: null,
    degraded: false,
  },
  error: null,
});

beforeEach(() => {
  invoke.mockReset();
});

describe('public services share one endpoint and dispatch by body', () => {
  test.each([
    ['getSimilarListings', 'similar_listings_service'],
    ['getSellerRecommendations', 'seller_recommendations_service'],
    ['getRelatedServices', 'related_services_service'],
    ['getRelatedProducts', 'related_products_service'],
    ['getNearbyListings', 'nearby_service'],
  ])('%s posts to recommendations with service=%s', async (fn, service) => {
    invoke.mockResolvedValue(okPayload(service));

    await services[fn]({ subjectListingId: SUBJECT });

    expect(invoke).toHaveBeenCalledTimes(1);
    const [endpoint, options] = invoke.mock.calls[0];
    expect(endpoint).toBe('recommendations');
    expect(options.body.service).toBe(service);
  });

  test('getRecentlyListed needs no subject and still dispatches correctly', async () => {
    invoke.mockResolvedValue(okPayload('recently_listed_service'));

    await services.getRecentlyListed({});

    const [endpoint, options] = invoke.mock.calls[0];
    expect(endpoint).toBe('recommendations');
    expect(options.body.service).toBe('recently_listed_service');
    expect(options.body.subjectListingId).toBeUndefined();
  });
});

describe('the authenticated service keeps its own function', () => {
  test('getPersonalizedRecommendations does not use the multiplexed endpoint', async () => {
    invoke.mockResolvedValue(okPayload('personalized_recommendation_service'));

    await services.getPersonalizedRecommendations({});

    const [endpoint] = invoke.mock.calls[0];
    // If this ever becomes 'recommendations', the gateway verify_jwt check that
    // rejects unauthenticated callers before any function code runs is gone.
    expect(endpoint).toBe('personalized-recommendations');
    expect(endpoint).not.toBe('recommendations');
  });
});

describe('dispatch cannot be subverted from the caller', () => {
  test('an unknown service never reaches the network', async () => {
    const result = await services.fetchRecommendationService('admin_service', {
      subjectListingId: SUBJECT,
    });

    expect(invoke).not.toHaveBeenCalled();
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('unknown_service');
    expect(result.items).toEqual([]);
  });

  test('the response is rejected when its service does not match what was asked for', async () => {
    // A multiplexed endpoint makes a mismatched response worth checking: the
    // normaliser must not render another service's rows under this request.
    invoke.mockResolvedValue(okPayload('related_products_service', [
      { entityType: 'listing', listingId: SUBJECT, score: 1 },
    ]));

    const result = await services.getSimilarListings({ subjectListingId: SUBJECT });

    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('invalid_response');
    expect(result.items).toEqual([]);
  });

  test('a subject-requiring service refuses to call out without a valid subject', async () => {
    const result = await services.getSimilarListings({ subjectListingId: 'not-a-uuid' });

    expect(invoke).not.toHaveBeenCalled();
    expect(result.reason).toBe('invalid_subject');
  });
});

describe('request bounds survive the collapse', () => {
  test('the limit is bucketed before it leaves the browser', async () => {
    invoke.mockResolvedValue(okPayload('recently_listed_service'));

    await services.getRecentlyListed({ limit: 7 });

    expect(invoke.mock.calls[0][1].body.limit).toBe(12);
  });

  test('an out-of-range limit is refused rather than sent', async () => {
    const result = await services.getRecentlyListed({ limit: 5000 });

    expect(invoke).not.toHaveBeenCalled();
    expect(result.reason).toBe('invalid_request');
  });

  test('nearby carries a bounded distance', async () => {
    invoke.mockResolvedValue(okPayload('nearby_service'));

    await services.getNearbyListings({ subjectListingId: SUBJECT, maxDistanceMeters: 25_000 });

    expect(invoke.mock.calls[0][1].body.maxDistanceMeters).toBe(25_000);
  });

  test('nearby refuses an out-of-range distance', async () => {
    const result = await services.getNearbyListings({
      subjectListingId: SUBJECT,
      maxDistanceMeters: 5_000_000,
    });

    expect(invoke).not.toHaveBeenCalled();
    expect(result.reason).toBe('invalid_distance');
  });

  test('an over-long cursor is refused', async () => {
    const result = await services.getRecentlyListed({ cursor: 'x'.repeat(1025) });

    expect(invoke).not.toHaveBeenCalled();
    expect(result.reason).toBe('invalid_request');
  });
});

describe('degraded transport still yields a renderable shape', () => {
  test('a transport error returns an empty, degraded result rather than throwing', async () => {
    invoke.mockResolvedValue({ data: null, error: { code: 'boom' } });

    const result = await services.getRecentlyListed({});

    expect(result.degraded).toBe(true);
    expect(result.items).toEqual([]);
    expect(result.reason).toBe('service_unavailable');
  });

  test('duplicate rows in a response are collapsed', async () => {
    const row = { entityType: 'listing', listingId: SUBJECT, score: 1 };
    invoke.mockResolvedValue(okPayload('recently_listed_service', [row, row, row]));

    const result = await services.getRecentlyListed({ limit: 6 });

    expect(result.items).toHaveLength(1);
  });
});

describe('deploy-order tolerance', () => {
  // The multiplexed function and the frontend ship separately. A build can reach
  // a project that does not have `recommendations` yet, so a 404 must fall back
  // to the endpoint that used to serve the service rather than render empty.
  const notFound = { data: null, error: { context: { status: 404 } } };

  test('a 404 from the multiplexed endpoint retries the legacy endpoint', async () => {
    invoke
      .mockResolvedValueOnce(notFound)
      .mockResolvedValueOnce(okPayload('similar_listings_service'));

    const result = await services.getSimilarListings({ subjectListingId: SUBJECT });

    expect(invoke.mock.calls[0][0]).toBe('recommendations');
    expect(invoke.mock.calls[1][0]).toBe('similar-listings');
    expect(result.degraded).toBe(false);
  });

  test('a non-404 failure is NOT retried against a second endpoint', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { status: 500 } } });

    const result = await services.getRecentlyListed({});

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.reason).toBe('service_unavailable');
  });

  test('a client timeout is not retried either', async () => {
    invoke.mockResolvedValue({ data: null, error: { code: 'client_timeout' } });

    const result = await services.getRecentlyListed({});

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result.reason).toBe('client_timeout');
  });
});
