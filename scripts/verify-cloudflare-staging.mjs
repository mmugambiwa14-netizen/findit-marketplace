import process from 'node:process';

const origin = process.env.FINDIT_STAGING_ORIGIN || process.argv[2];
if (!origin) {
  console.error('Usage: npm run verify:cloudflare-staging -- https://staging.example.pages.dev');
  process.exit(2);
}

let base;
try {
  base = new URL(origin);
} catch {
  console.error('Cloudflare staging verification failed: origin is not a valid URL');
  process.exit(2);
}

if (base.protocol !== 'https:') {
  console.error('Cloudflare staging verification failed: origin must use HTTPS');
  process.exit(2);
}

const failures = [];
const request = async (path, options = {}) => {
  const url = new URL(path, base);
  const response = await fetch(url, { redirect: 'follow', ...options });
  const body = await response.text();
  return { response, body, url };
};

const requirePage = async (path) => {
  try {
    const { response, body } = await request(path);
    if (response.status !== 200) failures.push(`${path}: expected HTTP 200, got ${response.status}`);
    if (!body.includes('<div id="root"></div>')) failures.push(`${path}: SPA shell missing`);
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

let root;
try {
  root = await request('/');
  if (root.response.status !== 200) failures.push(`/: expected HTTP 200, got ${root.response.status}`);
  if (!root.body.includes('<div id="root"></div>')) failures.push('/: SPA root missing');
} catch (error) {
  failures.push(`/: ${error instanceof Error ? error.message : String(error)}`);
}

for (const path of ['/search', '/login', '/admin', '/auth/callback?returnTo=%2F', '/staging-deep-link-check']) await requirePage(path);

const requiredHeaders = [
  ['content-security-policy', (value) => value?.includes("script-src 'self'") && !value.includes("script-src 'unsafe-inline'")],
  ['strict-transport-security', (value) => value?.includes('max-age=')],
  ['x-content-type-options', (value) => value?.toLowerCase() === 'nosniff'],
  ['x-frame-options', (value) => value?.toUpperCase() === 'DENY'],
  ['referrer-policy', (value) => Boolean(value)],
  ['permissions-policy', (value) => Boolean(value)],
];
for (const [header, predicate] of requiredHeaders) {
  const value = root?.response.headers.get(header);
  if (!predicate(value)) failures.push(`/: missing or unsafe ${header}`);
}

try {
  const { response, body } = await request('/manifest.webmanifest');
  if (response.status !== 200) failures.push(`/manifest.webmanifest: expected HTTP 200, got ${response.status}`);
  if (!response.headers.get('content-type')?.includes('manifest')) failures.push('/manifest.webmanifest: wrong content type');
  const manifest = JSON.parse(body);
  if (manifest.display !== 'standalone') failures.push('/manifest.webmanifest: display must be standalone');
  if (manifest.start_url !== '/') failures.push('/manifest.webmanifest: start_url must be /');
  if (manifest.scope !== '/') failures.push('/manifest.webmanifest: scope must be /');
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 1) failures.push('/manifest.webmanifest: icons missing');
} catch (error) {
  failures.push(`/manifest.webmanifest: ${error instanceof Error ? error.message : String(error)}`);
}

try {
  const { response, body } = await request('/sw.js');
  if (response.status !== 200) failures.push(`/sw.js: expected HTTP 200, got ${response.status}`);
  if (!response.headers.get('content-type')?.includes('javascript')) failures.push('/sw.js: wrong content type');
  if (response.headers.get('service-worker-allowed') !== '/') failures.push('/sw.js: Service-Worker-Allowed must be /');
  if (!body.includes("addEventListener('fetch'")) failures.push('/sw.js: fetch handler missing');
} catch (error) {
  failures.push(`/sw.js: ${error instanceof Error ? error.message : String(error)}`);
}

if (process.env.VITE_FEATURE_MAPS === 'true') {
  for (const path of ['/vendor/maplibre/maplibre-gl.js', '/vendor/maplibre/maplibre-gl.css']) {
    try {
      const { response } = await request(path);
      if (response.status !== 200) failures.push(`${path}: expected HTTP 200, got ${response.status}`);
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();
if (supabaseUrl || supabaseAnonKey) {
  if (!supabaseUrl || !supabaseAnonKey) {
    failures.push('Supabase connectivity check requires both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  } else {
    try {
      const supabaseOrigin = new URL(supabaseUrl);
      const expectedProjectRef = process.env.FINDIT_EXPECTED_PROJECT_REF?.trim();
      if (expectedProjectRef && supabaseOrigin.hostname !== `${expectedProjectRef}.supabase.co`) {
        failures.push('Supabase connectivity: configured project does not match the guarded staging project');
      }
      const headers = {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      };
      const settingsResponse = await fetch(new URL('/auth/v1/settings', supabaseUrl), { headers });
      if (settingsResponse.status !== 200) {
        failures.push(`Supabase Auth settings: expected HTTP 200, got ${settingsResponse.status}`);
      } else {
        const settings = await settingsResponse.json();
        if (settings.external?.google !== true) failures.push('Supabase Auth: Google provider is not enabled');
      }

      const listingsResponse = await fetch(new URL('/rest/v1/listings?select=id&limit=1', supabaseUrl), { headers });
      if (listingsResponse.status !== 200) {
        failures.push(`Supabase listings: expected HTTP 200, got ${listingsResponse.status}`);
      }

      const listingSearchResponse = await fetch(new URL('/rest/v1/rpc/public_listing_search_card_page_v1', supabaseUrl), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_kind: 'property',
          p_country_code: 'ZW',
          p_currency: '',
          p_query: '',
          p_category: '',
          p_location_id: '',
          p_min_price: null,
          p_max_price: null,
          p_min_bedrooms: null,
          p_brand: '',
          p_condition: '',
          p_fuel_type: '',
          p_transmission: '',
          p_sort: 'newest',
          p_cursor_value: null,
          p_cursor_id: null,
          p_limit: 24,
        }),
      });
      if (listingSearchResponse.status !== 200) {
        failures.push(`Supabase listing search: expected HTTP 200, got ${listingSearchResponse.status}`);
      } else if ((await listingSearchResponse.json()).length < 1) {
        failures.push('Supabase listing search: staging returned no public listings');
      }

      const categoryCountsResponse = await fetch(new URL('/rest/v1/rpc/discover_category_counts', supabaseUrl), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (categoryCountsResponse.status !== 200) {
        failures.push(`Supabase category counts: expected HTTP 200, got ${categoryCountsResponse.status}`);
      } else {
        const categoryCounts = await categoryCountsResponse.json();
        const expectedCategoryKeys = ['property', 'car', 'machinery', 'service'];
        const receivedCategoryKeys = Array.isArray(categoryCounts)
          ? categoryCounts.map((row) => row?.category_key)
          : [];
        if (
          receivedCategoryKeys.length !== expectedCategoryKeys.length
          || expectedCategoryKeys.some((key, index) => receivedCategoryKeys[index] !== key)
          || categoryCounts.some((row) => !Number.isInteger(row?.item_count) || row.item_count < 0)
        ) {
          failures.push('Supabase category counts: expected four ordered non-negative counts');
        }
      }

      const tourFeedResponse = await fetch(new URL('/functions/v1/tour-feed', supabaseUrl), {
        method: 'POST',
        headers: { ...headers, Origin: base.origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'all', location: '', query: '', cursor: null, limit: 24 }),
      });
      if (tourFeedResponse.status !== 200) {
        failures.push(`Supabase Peek feed: expected HTTP 200, got ${tourFeedResponse.status}`);
      } else if ((await tourFeedResponse.json()).items?.length < 1) {
        failures.push('Supabase Peek feed: staging returned no public Peeks');
      }

      const redirectTo = encodeURIComponent(new URL('/auth/callback?next=/', base).toString());
      const googleResponse = await fetch(
        new URL(`/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`, supabaseUrl),
        { headers: { apikey: supabaseAnonKey }, redirect: 'manual' },
      );
      if (googleResponse.status !== 302 || !googleResponse.headers.get('location')?.startsWith('https://accounts.google.com/')) {
        failures.push('Supabase Auth: Google OAuth did not produce a Google authorization redirect');
      }
    } catch (error) {
      failures.push(`Supabase staging checks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

if (failures.length) {
  console.error('Cloudflare staging verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Cloudflare staging verification passed for ${base.host}: SPA, PWA, security headers, Google OAuth, listings, category counts, Peeks, and Supabase connectivity verified.`);
