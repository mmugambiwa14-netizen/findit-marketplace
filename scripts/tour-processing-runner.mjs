import { createClient } from '@supabase/supabase-js';
import { assertMediaToolchain, processClaimedTour } from './lib/tour-media-processor.mjs';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function batchSize() {
  const argumentIndex = process.argv.indexOf('--batch-size');
  const raw = argumentIndex >= 0 ? process.argv[argumentIndex + 1] : process.env.FINDIT_TOUR_PROCESSOR_BATCH_SIZE || '5';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error('Tour processor batch size must be from 1 to 20');
  return value;
}

function assertTarget(url, expectedProjectRef) {
  const parsed = new URL(url);
  const actualProjectRef = parsed.hostname.split('.')[0];
  if (!expectedProjectRef || actualProjectRef !== expectedProjectRef) {
    throw new Error(`Tour processor target mismatch: expected ${expectedProjectRef || 'an explicit project ref'}, received ${actualProjectRef}`);
  }
}

const url = required('FINDIT_SUPABASE_URL');
const secretKey = required('FINDIT_SUPABASE_SECRET_KEY');
const expectedProjectRef = required('FINDIT_EXPECTED_PROJECT_REF');
assertTarget(url, expectedProjectRef);
await assertMediaToolchain();

const client = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const claim = await client.rpc('claim_tour_processing_jobs', { p_batch_size: batchSize() });
if (claim.error) throw new Error(`Tour processing claim failed: ${claim.error.message}`);

const candidates = claim.data ?? [];
let completed = 0;
let failed = 0;
for (const candidate of candidates) {
  try {
    await processClaimedTour(client, candidate);
    completed += 1;
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    const code = message.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 80) || 'processor_failed';
    const failure = await client.rpc('fail_tour_processing', {
      p_tour_id: candidate.tour_id,
      p_lease_token: candidate.lease_token,
      p_failure_code: code,
      p_failure_message: 'The Peek video could not be processed.',
      p_retryable: true,
    });
    if (failure.error) console.error(`Tour ${candidate.tour_id} failure state could not be persisted: ${failure.error.message}`);
    console.error(`Tour ${candidate.tour_id} processing failed: ${message}`);
  }
}

console.log(`Tour processor completed: claimed=${candidates.length} completed=${completed} failed=${failed}`);
if (failed > 0) process.exitCode = 1;
