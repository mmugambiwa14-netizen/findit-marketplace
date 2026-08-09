const UUID_SEGMENT = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const DETAIL_ROUTE = new RegExp(`^/(property|car|machinery|service)/(${UUID_SEGMENT})/?$`, 'i');
const SHARE_IMAGE_ROUTE = new RegExp(`^/share-image/(property|car|machinery|service)/(${UUID_SEGMENT})/?$`, 'i');
const LISTING_IMAGE_PATH = /^[0-9a-f-]{36}\/staging\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;
const SERVICE_IMAGE_PATH = /^[0-9a-f-]{36}\/service_photo\/staging\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;
const DEFAULT_SUMMARY = 'Browse this Zimbabwe listing on PeekaListing.';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanText(value, maximumLength) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maximumLength);
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.username === '' && parsed.password === ''
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function firstPhoto(record) {
  const candidate = Array.isArray(record?.photos) ? record.photos[0] : null;
  if (typeof candidate === 'string') return candidate;
  if (!candidate || typeof candidate !== 'object') return null;
  return candidate.url || candidate.public_url || candidate.signed_url || null;
}

function supabaseConfig(env) {
  const url = safeHttpsUrl(env?.SUPABASE_URL);
  const publishableKey = String(env?.SUPABASE_PUBLISHABLE_KEY || '').trim();
  return url && publishableKey ? { url: url.replace(/\/$/, ''), publishableKey } : null;
}

function supabaseHeaders(config) {
  return {
    apikey: config.publishableKey,
    Authorization: `Bearer ${config.publishableKey}`,
  };
}

function publicRecordUrl(config, kind, id) {
  const service = kind === 'service';
  const endpoint = new URL(`/rest/v1/${service ? 'services' : 'listings'}`, config.url);
  endpoint.searchParams.set('select', service
    ? 'id,title,description,photos,price,currency,location_name'
    : 'id,kind,title,description,photos,price,currency,public_location_label');
  endpoint.searchParams.set('id', `eq.${id}`);
  endpoint.searchParams.set('country_code', 'eq.ZW');
  endpoint.searchParams.set('status', service ? 'eq.active' : 'in.(available,under_offer)');
  if (service) endpoint.searchParams.set('category', 'neq.legal');
  else endpoint.searchParams.set('kind', `eq.${kind}`);
  endpoint.searchParams.set('limit', '1');
  return endpoint;
}

async function fetchPublicRecord(context, kind, id) {
  const config = supabaseConfig(context.env);
  if (!config) return null;
  try {
    const response = await fetch(publicRecordUrl(config, kind, id), {
      headers: supabaseHeaders(config),
      signal: context.request.signal,
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const record = Array.isArray(rows) ? rows[0] : null;
    return record?.id === id ? record : null;
  } catch {
    return null;
  }
}

function trustedStoragePhoto(kind, value) {
  if (typeof value !== 'string') return null;
  const valid = kind === 'service' ? SERVICE_IMAGE_PATH.test(value) : LISTING_IMAGE_PATH.test(value);
  return valid ? { bucket: kind === 'service' ? 'marketplace-images' : 'listing-images', path: value } : null;
}

function encodeStoragePath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

async function signStoragePhoto(context, kind, photo) {
  const storage = trustedStoragePhoto(kind, photo);
  const config = supabaseConfig(context.env);
  if (!storage || !config) return null;
  try {
    const endpoint = `${config.url}/storage/v1/object/sign/${encodeStoragePath(`${storage.bucket}/${storage.path}`)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...supabaseHeaders(config), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 }),
      signal: context.request.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (safeHttpsUrl(payload?.signedUrl)) return payload.signedUrl;
    if (typeof payload?.signedURL !== 'string' || !payload.signedURL.startsWith('/object/sign/')) return null;
    return safeHttpsUrl(`${config.url}/storage/v1${payload.signedURL}`);
  } catch {
    return null;
  }
}

function fallbackImage(requestUrl) {
  return new URL('/brand/peekalisting-icon-512.png', requestUrl).toString();
}

function metadataImage(record, kind, id, requestUrl) {
  const photo = firstPhoto(record);
  const publicImage = safeHttpsUrl(photo);
  if (publicImage) return publicImage;
  if (trustedStoragePhoto(kind, photo)) {
    return new URL(`/share-image/${kind}/${id}`, requestUrl).toString();
  }
  return fallbackImage(requestUrl);
}

function formatPrice(record) {
  const price = Number(record?.price);
  if (!Number.isFinite(price)) return '';
  const currency = cleanText(record?.currency || 'USD', 3).toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString('en-US')}`;
  }
}

function listingMetadata(record, kind, id, requestUrl) {
  const fallbackTitle = `${kind[0].toUpperCase()}${kind.slice(1)} on PeekaListing`;
  const title = cleanText(record?.title, 140) || fallbackTitle;
  const location = cleanText(record?.public_location_label || record?.location_name, 80);
  const description = cleanText(record?.description, 180);
  const summary = cleanText([formatPrice(record), location, description || DEFAULT_SUMMARY].filter(Boolean).join(' · '), 220);
  return {
    title,
    summary: summary || DEFAULT_SUMMARY,
    image: metadataImage(record, kind, id, requestUrl),
    canonical: `${requestUrl.origin}/${kind}/${id}`,
  };
}

function removeGenericShareMetadata(html) {
  return html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\b(?=[^>]*(?:name|property)\s*=\s*["'](?:description|og:[^"']+|twitter:[^"']+)["'])[^>]*>\s*/gi, '')
    .replace(/<link\b(?=[^>]*rel\s*=\s*["']canonical["'])[^>]*>\s*/gi, '');
}

function renderMetadata(html, metadata) {
  const tags = [
    `<title>${escapeHtml(metadata.title)} | PeekaListing</title>`,
    `<meta name="description" content="${escapeHtml(metadata.summary)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="PeekaListing">',
    `<meta property="og:title" content="${escapeHtml(metadata.title)}">`,
    `<meta property="og:description" content="${escapeHtml(metadata.summary)}">`,
    `<meta property="og:url" content="${escapeHtml(metadata.canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(metadata.image)}">`,
    `<meta property="og:image:secure_url" content="${escapeHtml(metadata.image)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(`${metadata.title} on PeekaListing`)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.summary)}">`,
    `<meta name="twitter:image" content="${escapeHtml(metadata.image)}">`,
    `<link rel="canonical" href="${escapeHtml(metadata.canonical)}">`,
  ].join('');
  const cleaned = removeGenericShareMetadata(html);
  return cleaned.includes('</head>') ? cleaned.replace('</head>', `${tags}</head>`) : cleaned;
}

async function serveShareImage(context, kind, id, requestUrl) {
  const record = await fetchPublicRecord(context, kind, id);
  const photo = firstPhoto(record);
  const destination = safeHttpsUrl(photo) || await signStoragePhoto(context, kind, photo);
  const target = destination || fallbackImage(requestUrl);
  return new Response(null, {
    status: 302,
    headers: {
      Location: target,
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const shareImageMatch = requestUrl.pathname.match(SHARE_IMAGE_ROUTE);
  if (context.request.method === 'GET' && shareImageMatch) {
    return serveShareImage(context, shareImageMatch[1].toLowerCase(), shareImageMatch[2].toLowerCase(), requestUrl);
  }

  const match = requestUrl.pathname.match(DETAIL_ROUTE);
  if (context.request.method !== 'GET' || !match) return context.next();

  const kind = match[1].toLowerCase();
  const id = match[2].toLowerCase();
  const [response, record] = await Promise.all([
    context.next(),
    fetchPublicRecord(context, kind, id),
  ]);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const enriched = renderMetadata(html, listingMetadata(record, kind, id, requestUrl));
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  return new Response(enriched, { status: response.status, statusText: response.statusText, headers });
}
