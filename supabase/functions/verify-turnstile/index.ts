import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200, traceId?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
      ...(traceId ? { 'x-request-id': traceId } : {}),
    },
  });
}

Deno.serve(async (request) => {
  const traceId = request.headers.get('x-request-id')?.slice(0, 128) || crypto.randomUUID();
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed', traceId }, 405, traceId);

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return json({ error: 'turnstile_not_configured', traceId }, 503, traceId);

  let payload: { token?: string; action?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json', traceId }, 400, traceId);
  }

  const token = payload.token?.trim();
  const action = payload.action?.trim();
  if (!token || token.length > 4096) return json({ error: 'invalid_token', traceId }, 400, traceId);

  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  const forwardedFor = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwardedFor) form.set('remoteip', forwardedFor);
  form.set('idempotency_key', traceId);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return json({ error: 'verification_unavailable', traceId }, 502, traceId);

  const result = await response.json() as {
    success?: boolean;
    action?: string;
    hostname?: string;
    'error-codes'?: string[];
  };

  const actionMatches = !action || !result.action || result.action === action;
  const verified = result.success === true && actionMatches;

  console.log(JSON.stringify({
    event: 'turnstile_verification',
    traceId,
    verified,
    expectedAction: action || null,
    actualAction: result.action || null,
    hostname: result.hostname || null,
    errorCodes: result['error-codes'] || [],
  }));

  // Creating a client here verifies that the function remains deployable with
  // the normal Supabase environment. No service-role database write is needed;
  // the protected domain action must verify Turnstile immediately before its
  // own mutation and retain its existing authorization checks.
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: request.headers.get('Authorization') || '' } },
  });

  return json({ verified, traceId, action: result.action || null }, verified ? 200 : 403, traceId);
});
