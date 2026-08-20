import { generatedPagesRuntimeConfig } from '../cloudflare/pages-runtime-config.js';

const UUID_SEGMENT = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const DETAIL_ROUTE = new RegExp(`^/(property|car|machinery|service)/(${UUID_SEGMENT})/?$`, 'i');
const SHARE_IMAGE_ROUTE = new RegExp(`^/share-image/(property|car|machinery|service)/(${UUID_SEGMENT})/?$`, 'i');
const LISTING_IMAGE_PATH = /^[0-9a-f-]{36}\/staging\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;
const SERVICE_IMAGE_PATH = /^[0-9a-f-]{36}\/service_photo\/staging\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i;
const DEFAULT_SUMMARY = 'Browse this Zimbabwe listing on PeekaListing.';
const PRODUCTION_ORIGIN = 'https://peekalisting.com';
const SITEMAP_PAGE_SIZE = 1000;
const SITEMAP_ROW_LIMIT = 5000;
const PUBLIC_PAGE_METADATA = new Map([
  ['/', ['Zimbabwe Marketplace', 'Browse Zimbabwe property, cars, machinery, services and public Peeks on PeekaListing.']],
  ['/search', ['Search Zimbabwe listings', 'Search verified Zimbabwe property, cars and machinery on PeekaListing.']],
  ['/services', ['Find services in Zimbabwe', 'Browse local service providers across Zimbabwe on PeekaListing.']],
  ['/peek', ['Watch listing Peeks', 'Watch short listing videos before arranging a visit on PeekaListing.']],
  ['/faqs', ['Frequently asked questions', 'Find answers about listings, Peeks, accounts and marketplace safety on PeekaListing.']],
  ['/help', ['Help and safety', 'Get help using PeekaListing and learn how to trade more safely.']],
  ['/help/safety', ['Marketplace safety', 'Practical guidance for safer local marketplace transactions in Zimbabwe.']],
  ['/legal/privacy', ['Privacy policy', 'Read how PeekaListing handles personal information and privacy choices.']],
  ['/legal/terms', ['Terms of use', 'Read the terms that apply when using the PeekaListing marketplace.']],
  ['/legal/data-protection', ['Data protection', 'Read PeekaListing data-protection rights, safeguards and contact information.']],
  ['/legal/cookies', ['Cookie policy', 'Read how PeekaListing uses cookies and local browser storage.']],
  ['/legal/community-guidelines', ['Community guidelines', 'Read the PeekaListing standards for safe and respectful marketplace participation.']],
]);

function normalizedPathname(pathname) {
  if (pathname === '/') return '/';
  return String(pathname || '/').replace(/\/+$/, '') || '/';
}

function isProductionHost(hostname) {
  return hostname === 'peekalisting.com' || hostname === 'www.peekalisting.com';
}

function canonicalOrigin(requestUrl) {
  return isProductionHost(requestUrl.hostname) ? PRODUCTION_ORIGIN : requestUrl.origin;
}

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

function trustedSupabaseImageUrl(value, env) {
  const candidate = safeHttpsUrl(value);
  const config = supabaseConfig(env);
  if (!candidate || !config) return null;
  try {
    const parsed = new URL(candidate);
    const origin = new URL(config.url).origin;
    return parsed.origin === origin && parsed.pathname.startsWith('/storage/v1/') ? candidate : null;
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
  const url = safeHttpsUrl(env?.SUPABASE_URL || generatedPagesRuntimeConfig.supabaseUrl);
  const publishableKey = String(
    env?.SUPABASE_PUBLISHABLE_KEY || generatedPagesRuntimeConfig.supabasePublishableKey,
  ).trim();
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
    ? 'id,title,description,photos,price,currency,location_name,status'
    : 'id,kind,title,description,photos,price,currency,public_location_label,status');
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
    if (trustedSupabaseImageUrl(payload?.signedUrl, context.env)) return payload.signedUrl;
    if (typeof payload?.signedURL !== 'string' || !payload.signedURL.startsWith('/object/sign/')) return null;
    return trustedSupabaseImageUrl(`${config.url}/storage/v1${payload.signedURL}`, context.env);
  } catch {
    return null;
  }
}

function fallbackImage(requestUrl) {
  return new URL('/brand/peekalisting-icon-512.png', requestUrl).toString();
}

function metadataImage(record, kind, id, requestUrl) {
  const photo = firstPhoto(record);
  // Keep legacy external thumbnails usable for social previews. The actual
  // /share-image redirect below remains storage-origin-only, so this cannot
  // become an open redirect.
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
    canonical: `${canonicalOrigin(requestUrl)}/${kind}/${id}`,
    price: record?.price != null && Number.isFinite(Number(record.price)) ? Number(record.price) : null,
    currency: cleanText(record?.currency || 'USD', 3).toUpperCase(),
    availability: record?.status === 'sold' ? 'SoldOut' : record?.status === 'rented' ? 'SoldOut' : 'InStock',
  };
}

function sitemapRecordUrl(config, resource, offset) {
  const service = resource === 'services';
  const endpoint = new URL(`/rest/v1/${resource}`, config.url);
  endpoint.searchParams.set('select', service ? 'id,updated_at' : 'id,kind,updated_at');
  endpoint.searchParams.set('country_code', 'eq.ZW');
  endpoint.searchParams.set('status', service ? 'eq.active' : 'in.(available,under_offer)');
  if (service) endpoint.searchParams.set('category', 'neq.legal');
  else endpoint.searchParams.set('kind', 'in.(property,car,machinery)');
  endpoint.searchParams.set('order', 'updated_at.desc,id.asc');
  endpoint.searchParams.set('limit', String(SITEMAP_PAGE_SIZE));
  endpoint.searchParams.set('offset', String(offset));
  return endpoint;
}

async function fetchSitemapRecords(context, resource) {
  const config = supabaseConfig(context.env);
  if (!config) return [];
  const records = [];
  try {
    for (let offset = 0; offset < SITEMAP_ROW_LIMIT; offset += SITEMAP_PAGE_SIZE) {
      const response = await fetch(sitemapRecordUrl(config, resource, offset), {
        headers: supabaseHeaders(config),
        signal: context.request.signal,
      });
      if (!response.ok) break;
      const page = await response.json();
      if (!Array.isArray(page)) break;
      records.push(...page.slice(0, SITEMAP_PAGE_SIZE));
      if (page.length < SITEMAP_PAGE_SIZE) break;
    }
  } catch {
    return records;
  }
  return records.slice(0, SITEMAP_ROW_LIMIT);
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sitemapEntry(path, updatedAt = null) {
  const lastModified = updatedAt && !Number.isNaN(Date.parse(updatedAt))
    ? `<lastmod>${escapeXml(new Date(updatedAt).toISOString())}</lastmod>`
    : '';
  return `<url><loc>${escapeXml(`${PRODUCTION_ORIGIN}${path}`)}</loc>${lastModified}</url>`;
}

async function serveSitemap(context) {
  const staticPaths = [...PUBLIC_PAGE_METADATA.keys()];
  const [listings, services] = await Promise.all([
    fetchSitemapRecords(context, 'listings'),
    fetchSitemapRecords(context, 'services'),
  ]);
  const entries = [
    ...staticPaths.map((path) => sitemapEntry(path)),
    ...listings
      .filter((record) => ['property', 'car', 'machinery'].includes(record?.kind) && typeof record?.id === 'string')
      .map((record) => sitemapEntry(`/${record.kind}/${record.id}`, record.updated_at)),
    ...services
      .filter((record) => typeof record?.id === 'string')
      .map((record) => sitemapEntry(`/service/${record.id}`, record.updated_at)),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function structuredData(metadata, kind) {
  const data = kind === 'service'
    ? {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: metadata.title,
      description: metadata.summary,
      image: metadata.image,
      url: metadata.canonical,
      areaServed: 'Zimbabwe',
    }
    : {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: metadata.title,
      description: metadata.summary,
      image: metadata.image,
      url: metadata.canonical,
      offers: metadata.price === null ? undefined : {
        '@type': 'Offer',
        price: metadata.price,
        priceCurrency: metadata.currency,
        availability: `https://schema.org/${metadata.availability}`,
        url: metadata.canonical,
      },
    };
  return JSON.stringify(data, (_key, value) => value === undefined ? undefined : value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function pageStructuredData(metadata, pathname) {
  const website = {
    '@type': 'WebSite',
    '@id': `${PRODUCTION_ORIGIN}/#website`,
    url: `${PRODUCTION_ORIGIN}/`,
    name: 'PeekaListing',
    description: PUBLIC_PAGE_METADATA.get('/')?.[1],
    potentialAction: {
      '@type': 'SearchAction',
      target: `${PRODUCTION_ORIGIN}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${PRODUCTION_ORIGIN}/#organization`,
      name: 'PeekaListing',
      url: `${PRODUCTION_ORIGIN}/`,
      logo: `${PRODUCTION_ORIGIN}/brand/peekalisting-icon-512.png`,
    },
    website,
  ];
  if (pathname !== '/') {
    graph.push({
      '@type': 'WebPage',
      name: metadata.title,
      description: metadata.summary,
      url: metadata.canonical,
      isPartOf: { '@id': `${PRODUCTION_ORIGIN}/#website` },
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
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
    `<script type="application/ld+json">${structuredData(metadata, metadata.canonical.split('/')[3] || 'property')}</script>`,
  ].join('');
  const cleaned = removeGenericShareMetadata(html);
  return cleaned.includes('</head>') ? cleaned.replace('</head>', `${tags}</head>`) : cleaned;
}

function publicPageMetadata(requestUrl) {
  const pathname = normalizedPathname(requestUrl.pathname);
  const definition = PUBLIC_PAGE_METADATA.get(pathname);
  if (!definition) return null;
  return {
    title: definition[0],
    summary: definition[1],
    canonical: `${canonicalOrigin(requestUrl)}${pathname === '/' ? '/' : pathname}`,
    image: `${canonicalOrigin(requestUrl)}/brand/peekalisting-icon-512.png`,
    pathname,
  };
}

function renderPageMetadata(html, metadata) {
  const tags = [
    `<title>${escapeHtml(metadata.title)} | PeekaListing</title>`,
    `<meta name="description" content="${escapeHtml(metadata.summary)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="PeekaListing">',
    `<meta property="og:title" content="${escapeHtml(metadata.title)}">`,
    `<meta property="og:description" content="${escapeHtml(metadata.summary)}">`,
    `<meta property="og:url" content="${escapeHtml(metadata.canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(metadata.image)}">`,
    `<meta property="og:image:alt" content="PeekaListing marketplace">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.summary)}">`,
    `<meta name="twitter:image" content="${escapeHtml(metadata.image)}">`,
    `<link rel="canonical" href="${escapeHtml(metadata.canonical)}">`,
    `<script type="application/ld+json">${pageStructuredData(metadata, metadata.pathname)}</script>`,
  ].join('');
  const cleaned = removeGenericShareMetadata(html);
  return cleaned.includes('</head>') ? cleaned.replace('</head>', `${tags}</head>`) : cleaned;
}

function renderNoIndex(html) {
  if (/<meta\b[^>]*name=["']robots["']/i.test(html)) return html;
  const tag = '<meta name="robots" content="noindex, nofollow">';
  return html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : html;
}

async function serveShareImage(context, kind, id, requestUrl) {
  const record = await fetchPublicRecord(context, kind, id);
  const photo = firstPhoto(record);
  // Never redirect a share URL to an arbitrary legacy HTTPS value. A row may
  // predate the storage-only write boundary, so use the first-party Supabase
  // storage origin or the local fallback image only.
  const destination = trustedSupabaseImageUrl(photo, context.env) || await signStoragePhoto(context, kind, photo);
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
  if (context.request.method === 'GET' && normalizedPathname(requestUrl.pathname) === '/sitemap.xml') {
    return serveSitemap(context);
  }

  const shareImageMatch = requestUrl.pathname.match(SHARE_IMAGE_ROUTE);
  if (context.request.method === 'GET' && shareImageMatch) {
    return serveShareImage(context, shareImageMatch[1].toLowerCase(), shareImageMatch[2].toLowerCase(), requestUrl);
  }

  const match = requestUrl.pathname.match(DETAIL_ROUTE);
  if (context.request.method !== 'GET') return context.next();

  const kind = match?.[1]?.toLowerCase() || null;
  const id = match?.[2]?.toLowerCase() || null;
  const [response, record] = await Promise.all([
    context.next(),
    match ? fetchPublicRecord(context, kind, id) : Promise.resolve(null),
  ]);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  const pageMetadata = match ? null : publicPageMetadata(requestUrl);
  const indexable = isProductionHost(requestUrl.hostname) && (match ? Boolean(record) : Boolean(pageMetadata));
  let enriched = match
    ? renderMetadata(html, listingMetadata(record, kind, id, requestUrl))
    : pageMetadata
      ? renderPageMetadata(html, pageMetadata)
      : html;
  if (!indexable) {
    enriched = renderNoIndex(enriched);
    headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  if (match) headers.set('cache-control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  return new Response(enriched, { status: response.status, statusText: response.statusText, headers });
}
