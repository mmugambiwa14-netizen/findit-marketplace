const DETAIL_ROUTE = /^\/(property|car|machinery|service)\/([0-9a-f-]{36})$/i;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safePreviewUrl(value, requestUrl) {
  if (!value) return new URL('/brand/peekalisting-icon-512.png', requestUrl).toString();
  try {
    const parsed = new URL(value, requestUrl);
    return parsed.protocol === 'https:' && parsed.username === '' && parsed.password === ''
      ? parsed.toString()
      : new URL('/brand/peekalisting-icon-512.png', requestUrl).toString();
  } catch {
    return new URL('/brand/peekalisting-icon-512.png', requestUrl).toString();
  }
}

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const match = requestUrl.pathname.match(DETAIL_ROUTE);
  if (context.request.method !== 'GET' || !match) return context.next();

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const kind = match[1].toLowerCase();
  const fallbackTitle = `${kind[0].toUpperCase()}${kind.slice(1)} on PeekaListing`;
  const title = (requestUrl.searchParams.get('title') || fallbackTitle).trim().slice(0, 140);
  const summary = (requestUrl.searchParams.get('summary') || 'Browse this Zimbabwe listing on PeekaListing.').trim().slice(0, 220);
  const image = safePreviewUrl(requestUrl.searchParams.get('preview'), requestUrl);
  const canonical = `${requestUrl.origin}${requestUrl.pathname}`;
  const tags = [
    `<title>${escapeHtml(title)} | PeekaListing</title>`,
    `<meta name="description" content="${escapeHtml(summary)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="PeekaListing">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(summary)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(summary)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
  ].join('');
  const html = await response.text();
  const enriched = html.includes('</head>') ? html.replace('</head>', `${tags}</head>`) : html;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  headers.set('cache-control', 'no-store, max-age=0');
  return new Response(enriched, { status: response.status, statusText: response.statusText, headers });
}
