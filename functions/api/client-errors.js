const MAX_BODY_BYTES = 12_000;

function safeText(value, maximum) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, maximum);
}

export async function onRequestPost(context) {
  const contentLength = Number(context.request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  let report = {};
  try {
    const body = await context.request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) return new Response(null, { status: 413 });
    report = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  console.warn(JSON.stringify({
    kind: 'client_error',
    message: safeText(report.message, 500),
    name: safeText(report.name, 120),
    stack: safeText(report.stack, 1800),
    route: safeText(report.route, 300),
    context: safeText(report.context, 300),
    build: safeText(report.build, 80),
  }));
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
