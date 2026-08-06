const allowedOrigins = new Set(
  (Deno.env.get('TURNSTILE_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const allowedHostnames = new Set(
  (Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES') || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };

  if (origin && allowedOrigins.has(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function json(body: unknown, status: number, traceId: string, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'content-type': 'application/json; charset=utf-8',
      'x-request-id': traceId,
      'cache-control': 'no-store',
    },
  });
}

Deno.serve(async (request) => {
  const traceId = request.headers.get('x-request-id')?.trim().slice(0, 128) || crypto.randomUUID();
  const origin = request.headers.get('origin');

  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: 'origin_not_allowed', traceId }, 403, traceId, origin);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed', traceId }, 405, traceId, origin);
  }

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret || allowedOrigins.size === 0 || allowedHostnames.size === 0) {
    return json({ error: 'turnstile_not_configured', traceId }, 503, traceId, origin);
  }

  let payload: { token?: string; action?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json', traceId }, 400, traceId, origin);
  }

  const token = payload.token?.trim();
  const action = payload.action?.trim();
  if (!token || token.length > 4096) {
    return json({ error: 'invalid_token', traceId }, 400, traceId, origin);
  }
  if (action && (action.length > 64 || !/^[a-z0-9_-]+$/i.test(action))) {
    return json({ error: 'invalid_action', traceId }, 400, traceId, origin);
  }

  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  const forwardedFor = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwardedFor) form.set('remoteip', forwardedFor);
  form.set('idempotency_key', traceId);

  let response: Response;
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return json({ error: 'verification_unavailable', traceId }, 502, traceId, origin);
  }
  if (!response.ok) {
    return json({ error: 'verification_unavailable', traceId }, 502, traceId, origin);
  }

  const result = await response.json() as {
    success?: boolean;
    action?: string;
    hostname?: string;
    'error-codes'?: string[];
  };

  const actualHostname = result.hostname?.trim().toLowerCase() || '';
  const actionMatches = !action || result.action === action;
  const hostnameMatches = actualHostname.length > 0 && allowedHostnames.has(actualHostname);
  const verified = result.success === true && actionMatches && hostnameMatches;

  console.log(JSON.stringify({
    event: 'turnstile_verification',
    traceId,
    verified,
    expectedAction: action || null,
    actualAction: result.action || null,
    hostname: actualHostname || null,
    hostnameAllowed: hostnameMatches,
    errorCodes: result['error-codes'] || [],
  }));

  return json(
    { verified, traceId, action: result.action || null },
    verified ? 200 : 403,
    traceId,
    origin,
  );
});
