// Runs every recommendation pgTAP suite against the local Supabase stack.
//
// This replaced ten near-identical npm scripts -- one per suite -- plus an
// eleventh that chained them with `&&`. Adding a suite meant adding two more
// entries and remembering to extend the chain; the suites are discovered here
// instead, so a new supabase/tests/v1_recommendation_*.sql file is picked up
// automatically.
//
// Pass a substring to run a single suite:
//   npm run test:recommendation-db -- personalization

import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPABASE_CLI_VERSION = '2.84.2';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [filter] = process.argv.slice(2);

const suites = (await readdir(resolve(root, 'supabase/tests')))
  .filter((name) => name.startsWith('v1_recommendation_') && name.endsWith('.sql'))
  .filter((name) => !filter || name.includes(filter))
  .sort();

if (suites.length === 0) {
  console.error(
    filter
      ? `No recommendation suite matches "${filter}".`
      : 'No recommendation pgTAP suites were found.',
  );
  process.exit(1);
}

console.log(`Running ${suites.length} recommendation pgTAP suite(s).`);

const failed = [];
for (const suite of suites) {
  console.log(`\n--- ${suite}`);
  const result = spawnSync(
    'npx',
    ['--yes', `supabase@${SUPABASE_CLI_VERSION}`, 'test', 'db', `supabase/tests/${suite}`, '--local'],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0) failed.push(suite);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} recommendation suite(s) failed:`);
  for (const suite of failed) console.error(`  - ${suite}`);
  process.exit(1);
}

console.log(`\nAll ${suites.length} recommendation suite(s) passed.`);
