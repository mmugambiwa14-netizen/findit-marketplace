// Hosted smoke runner.
//
// The smoke scripts are target-agnostic: they read FINDIT_SUPABASE_URL and fall
// back to the local stack at 127.0.0.1:55321. That is correct for the `-local`
// npm scripts, but it meant every `test:*-hosted` script silently exercised
// localhost when the hosted environment was absent -- a release check that
// reported success without ever reaching staging.
//
// This runner refuses to delegate until the environment genuinely points at a
// hosted project, so a misconfigured hosted run fails loudly instead of
// producing a false pass.

import { pathToFileURL } from 'node:url';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';

const [target] = process.argv.slice(2);

if (!target) {
  console.error('Usage: node ./scripts/run-hosted-smoke.mjs <script-path>');
  process.exit(2);
}

const problems = [];
const url = process.env.FINDIT_SUPABASE_URL;

if (!url) {
  problems.push('FINDIT_SUPABASE_URL is not set (the smoke script would default to the local stack).');
} else {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    problems.push(`FINDIT_SUPABASE_URL is not a valid URL: ${url}`);
  }
  if (parsed) {
    if (['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
      problems.push(`FINDIT_SUPABASE_URL points at the local stack (${parsed.hostname}); this is the hosted runner.`);
    }
    if (parsed.protocol !== 'https:') {
      problems.push(`FINDIT_SUPABASE_URL must use https for a hosted run (got ${parsed.protocol}).`);
    }
  }
}

if (process.env.FINDIT_ALLOW_HOSTED_SMOKE !== 'staging') {
  problems.push('FINDIT_ALLOW_HOSTED_SMOKE must be set to "staging" to authorise a hosted run.');
}

if (!process.env.FINDIT_EXPECTED_PROJECT_REF) {
  problems.push('FINDIT_EXPECTED_PROJECT_REF must name the expected Supabase project ref.');
}

if (!process.env.FINDIT_SUPABASE_ANON_KEY || !process.env.FINDIT_SUPABASE_SECRET_KEY) {
  problems.push('FINDIT_SUPABASE_ANON_KEY and FINDIT_SUPABASE_SECRET_KEY are both required.');
}

if (problems.length > 0) {
  console.error(`Hosted smoke run refused for ${target}:\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nThis check exists because these scripts default to the local Supabase stack.'
    + '\nWithout it a hosted verification silently passes against localhost.'
    + '\nRun the matching `:local` script for local verification instead.',
  );
  process.exit(1);
}

const targetPath = resolve(process.cwd(), target);
try {
  await access(targetPath, constants.F_OK);
} catch {
  console.error(`Hosted smoke target does not exist: ${target}`);
  process.exit(2);
}

await import(pathToFileURL(targetPath).href);
