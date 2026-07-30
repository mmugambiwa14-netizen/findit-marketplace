import { readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const root = process.cwd();
const migrationsDirectory = resolve(root, 'supabase/migrations');
const rollbackDirectory = resolve(root, 'supabase/rollback');
const failures = [];

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();

if (!migrationFiles.length) failures.push('no numbered migrations found');

const numbers = migrationFiles.map((name) => Number(name.slice(0, 4)));
for (let index = 0; index < numbers.length; index += 1) {
  const expected = index + 1;
  if (numbers[index] !== expected) failures.push(`migration sequence expected ${String(expected).padStart(4, '0')} but found ${migrationFiles[index]}`);
}

const rollbackFiles = new Set((await readdir(rollbackDirectory)).filter((name) => name.endsWith('.rollback.sql')));
for (const migration of migrationFiles.filter((name) => Number(name.slice(0, 4)) >= 30)) {
  const expectedRollback = migration.replace(/\.sql$/, '.rollback.sql');
  if (!rollbackFiles.has(expectedRollback)) failures.push(`missing rollback pair for ${migration}`);
}

function dollarQuoteBalance(content) {
  const counts = new Map();
  for (const match of content.matchAll(/\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/g)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count % 2 !== 0);
}

for (const name of migrationFiles) {
  const content = await readFile(join(migrationsDirectory, name), 'utf8');
  if (/^(?:<<<<<<<|=======|>>>>>>>)(?:\s|$)/m.test(content)) failures.push(`${name} contains a merge-conflict marker`);
  for (const [tag, count] of dollarQuoteBalance(content)) failures.push(`${name} has unbalanced ${tag} delimiters (${count})`);
}

for (const name of [...rollbackFiles].filter((file) => Number(file.slice(0, 4)) >= 40).sort()) {
  const content = await readFile(join(rollbackDirectory, name), 'utf8');
  if (/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i.test(content)) {
    failures.push(`${name} contains destructive table/data rollback statements`);
  }
  if (/^(?:<<<<<<<|=======|>>>>>>>)(?:\s|$)/m.test(content)) failures.push(`${name} contains a merge-conflict marker`);
  for (const [tag, count] of dollarQuoteBalance(content)) failures.push(`${name} has unbalanced ${tag} delimiters (${count})`);
}

// Previous reviewed release tips:
// - 0089_private_country_helper_implementations.sql
// - 0090_seller_profile_identifier_privacy.sql
// - 0091_private_public_tour_summaries_implementation.sql
// - 0092_zimbabwe_province_hierarchy.sql
// Release-tip anchor: bump this deliberately when a migration is added, so an
// accidental or unreviewed migration cannot ride along silently.
if (basename(migrationFiles.at(-1) ?? '') !== '0093_private_marketplace_view_implementation.sql') {
  failures.push(`latest expected migration is 0093, found ${migrationFiles.at(-1) ?? 'none'}`);
}

if (failures.length) {
  console.error('SQL boundary verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SQL boundary verification passed: ${migrationFiles.length} contiguous migrations and ${rollbackFiles.size} rollback capsules inspected.`);
