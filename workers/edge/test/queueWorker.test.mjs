import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.ts';

const SUPABASE_URL = 'https://staging-project.supabase.co';

function createEnv(overrides = {}) {
  const kvStore = new Map();
  const deletions = [];
  const env = {
    APP_ENV: 'staging',
    MEDIA_DELIVERY_HOST: 'media-staging.test',
    SUPABASE_URL,
    FINDIT_NOTIFICATION_FANOUT_WORKER_SECRET: 'notification-fanout-secret',
    EMAIL_DISPATCH_TOKEN: 'email-dispatch-secret',
    PUSH_DISPATCH_TOKEN: 'push-dispatch-secret',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    PLATFORM_CONFIG: {
      async get(key) {
        return kvStore.has(key) ? kvStore.get(key) : null;
      },
      async put(key, value) {
        kvStore.set(key, value);
      },
    },
    PEEK_SOURCE_MEDIA: { async delete(key) { deletions.push(['source', key]); } },
    PEEK_DERIVATIVE_MEDIA: { async delete(key) { deletions.push(['derivative', key]); } },
    LISTING_MEDIA: { async delete(key) { deletions.push(['listing', key]); } },
    ...overrides,
  };
  return { env, kvStore, deletions };
}

function createMessage(body, attempts = 1) {
  const calls = { ack: 0, retry: 0 };
  const message = {
    body,
    attempts,
    ack() { calls.ack += 1; },
    retry() { calls.retry += 1; },
  };
  return { message, calls };
}

function validJob(overrides = {}) {
  return {
    id: `job-${'a'.repeat(20)}`,
    type: 'media.cleanup',
    traceId: `trace-${'b'.repeat(20)}`,
    createdAt: new Date().toISOString(),
    payload: { bucket: 'source', key: 'peek-source/example-key.jpg' },
    ...overrides,
  };
}

async function withMockFetch(handler, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init, calls.length);
  };
  try {
    return { calls, result: await run() };
  } finally {
    globalThis.fetch = original;
  }
}

function withCapturedLogs(run) {
  const originalLog = console.log;
  const originalError = console.error;
  const lines = [];
  console.log = (...args) => lines.push({ level: 'log', args });
  console.error = (...args) => lines.push({ level: 'error', args });
  return Promise.resolve(run()).finally(() => {
    console.log = originalLog;
    console.error = originalError;
  }).then((result) => ({ result, lines }));
}

test('rejects a malformed envelope and retries without ever acking it', async () => {
  const { env } = createEnv();
  const { message, calls } = createMessage({ id: 'short', type: 'media.cleanup', createdAt: new Date().toISOString(), traceId: `trace-${'b'.repeat(20)}`, payload: {} });
  await worker.queue({ messages: [message] }, env);
  assert.equal(calls.ack, 0);
  assert.equal(calls.retry, 1);
});

test('rejects a removed job type (search.sync) as unsupported and retries it', async () => {
  const { env } = createEnv();
  const job = validJob({ type: 'search.sync', payload: {} });
  const { message, calls } = createMessage(job);
  const { lines } = await withCapturedLogs(() => worker.queue({ messages: [message] }, env));
  assert.equal(calls.ack, 0);
  assert.equal(calls.retry, 1);
  const failureLog = lines.find((line) => line.level === 'error');
  assert.match(JSON.stringify(failureLog.args[0]), /Unsupported platform job type/);
});

test('acknowledges media.cleanup only after the R2 delete resolves', async () => {
  const { env, deletions } = createEnv();
  const job = validJob({ payload: { bucket: 'listing', key: 'listing-media/photo-1.jpg' } });
  const { message, calls } = createMessage(job);
  await worker.queue({ messages: [message] }, env);
  assert.equal(calls.ack, 1);
  assert.equal(calls.retry, 0);
  assert.deepEqual(deletions, [['listing', 'listing-media/photo-1.jpg']]);
});

test('notification.dispatch calls the fanout function with the worker secret and trace correlation, then acks on 200', async () => {
  const { env } = createEnv();
  const job = validJob({ type: 'notification.dispatch', payload: { limit: 10 } });
  const { message, calls } = createMessage(job);
  const { calls: fetchCalls } = await withMockFetch(
    () => new Response(JSON.stringify({ claimedJobs: 2, completedJobs: 2, failedJobs: 0 }), { status: 200 }),
    () => worker.queue({ messages: [message] }, env),
  );
  assert.equal(calls.ack, 1);
  assert.equal(calls.retry, 0);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, `${SUPABASE_URL}/functions/v1/essential-notification-fanout`);
  assert.equal(fetchCalls[0].init.headers.authorization, 'Bearer notification-fanout-secret');
  assert.equal(fetchCalls[0].init.headers['x-request-id'], job.traceId);
  assert.deepEqual(JSON.parse(fetchCalls[0].init.body), { limit: 10 });
});

test('email.dispatch retries on a 5xx response (transient) without acking', async () => {
  const { env } = createEnv();
  const job = validJob({ type: 'email.dispatch', payload: {} });
  const { message, calls } = createMessage(job);
  const { lines } = await withCapturedLogs(() =>
    withMockFetch(
      () => new Response(JSON.stringify({ code: 'email_provider_unavailable' }), { status: 502 }),
      () => worker.queue({ messages: [message] }, env),
    ),
  );
  assert.equal(calls.ack, 0);
  assert.equal(calls.retry, 1);
  const failure = lines.find((line) => line.args[0]?.includes?.('email_dispatch_failed'));
  assert.ok(failure, 'expected an email_dispatch_failed log line');
  assert.match(failure.args[0], /"classification":"transient"/);
});

test('web_push.dispatch on a 401 is classified permanent but still goes through retry() to preserve dead-letter evidence', async () => {
  const { env } = createEnv();
  const job = validJob({ type: 'web_push.dispatch', payload: {} });
  const { message, calls } = createMessage(job);
  const { lines } = await withCapturedLogs(() =>
    withMockFetch(
      () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
      () => worker.queue({ messages: [message] }, env),
    ),
  );
  assert.equal(calls.ack, 0, 'a permanent failure must never be silently acked, or the job is lost with no DLQ evidence');
  assert.equal(calls.retry, 1);
  const failure = lines.find((line) => line.args[0]?.includes?.('web_push_dispatch_failed'));
  assert.match(failure.args[0], /"classification":"permanent"/);
});

test('a request that aborts on the dispatch timeout is classified transient and retried', async () => {
  const { env } = createEnv();
  const job = validJob({ type: 'web_push.dispatch', payload: {} });
  const { message, calls } = createMessage(job);
  const { lines } = await withCapturedLogs(() =>
    withMockFetch(
      () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      },
      () => worker.queue({ messages: [message] }, env),
    ),
  );
  assert.equal(calls.ack, 0);
  assert.equal(calls.retry, 1);
  const failure = lines.find((line) => line.args[0]?.includes?.('web_push_dispatch_failed'));
  assert.match(failure.args[0], /"detail":"dispatch_timeout"/);
});

test('duplicate delivery of an already-completed job id is skipped without re-calling the dispatch function', async () => {
  const { env, kvStore } = createEnv();
  const job = validJob({ type: 'notification.dispatch', payload: {} });
  kvStore.set(`job-complete:${job.type}:${job.id}`, '1');
  const { message, calls } = createMessage(job);
  const { calls: fetchCalls } = await withMockFetch(
    () => new Response(JSON.stringify({}), { status: 200 }),
    () => worker.queue({ messages: [message] }, env),
  );
  assert.equal(fetchCalls.length, 0, 'a duplicate delivery must not re-trigger the downstream dispatch call');
  assert.equal(calls.ack, 1);
  assert.equal(calls.retry, 0);
});

test('redelivering the same media.cleanup job id does not call R2 delete twice', async () => {
  const { env, deletions } = createEnv();
  const job = validJob();
  const first = createMessage(job);
  await worker.queue({ messages: [first.message] }, env);
  assert.equal(deletions.length, 1);

  const second = createMessage(job);
  await worker.queue({ messages: [second.message] }, env);
  assert.equal(deletions.length, 1, 'the second delivery of the same job id must be a no-op skip');
  assert.equal(second.calls.ack, 1);
  assert.equal(second.calls.retry, 0);
});

test('partial multi-device web push delivery (some devices failed) is still acked with delivery counts logged', async () => {
  const { env } = createEnv();
  const job = validJob({ type: 'web_push.dispatch', payload: {} });
  const { message, calls } = createMessage(job);
  const { lines } = await withCapturedLogs(() =>
    withMockFetch(
      () => new Response(JSON.stringify({ processed: 3, delivered: 2, failed: 1 }), { status: 200 }),
      () => worker.queue({ messages: [message] }, env),
    ),
  );
  assert.equal(calls.ack, 1);
  assert.equal(calls.retry, 0);
  const completed = lines.find((line) => line.args[0]?.includes?.('web_push_dispatch_completed'));
  assert.ok(completed);
  const parsed = JSON.parse(completed.args[0]);
  assert.equal(parsed.processed, 3);
  assert.equal(parsed.delivered, 2);
  assert.equal(parsed.failed, 1);
});

test('every log line for a dispatch job carries its jobId and traceId for correlation', async () => {
  const { env } = createEnv();
  const job = validJob({ type: 'email.dispatch', payload: {} });
  const { message } = createMessage(job);
  const { lines } = await withCapturedLogs(() =>
    withMockFetch(
      () => new Response(JSON.stringify({ claimed: 1, sent: 1, failed: 0 }), { status: 200 }),
      () => worker.queue({ messages: [message] }, env),
    ),
  );
  assert.ok(lines.length > 0);
  for (const line of lines) {
    const parsed = JSON.parse(line.args[0]);
    assert.equal(parsed.jobId, job.id);
    assert.equal(parsed.traceId, job.traceId);
  }
});

test('logs never contain the raw dispatch secret values or job payload contents', async () => {
  const { env } = createEnv();
  const job = validJob({ type: 'email.dispatch', payload: { limit: 5 } });
  const { message } = createMessage(job);
  const { lines } = await withCapturedLogs(() =>
    withMockFetch(
      () => new Response(JSON.stringify({ claimed: 1, sent: 1, failed: 0 }), { status: 200 }),
      () => worker.queue({ messages: [message] }, env),
    ),
  );
  const serialized = JSON.stringify(lines);
  assert.doesNotMatch(serialized, /email-dispatch-secret/);
  assert.doesNotMatch(serialized, /notification-fanout-secret/);
  assert.doesNotMatch(serialized, /push-dispatch-secret/);
});
