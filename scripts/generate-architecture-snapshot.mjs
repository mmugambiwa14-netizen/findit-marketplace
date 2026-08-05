// Generates docs/ARCHITECTURE_SNAPSHOT.md from the repository itself.
//
// ARCHITECTURE.md previously carried hand-counted figures ("twenty-nine
// migrations, 49 tables, four Edge Functions"). By the time they were checked
// the real numbers were 138, 90 and 28 -- the prose had been accurate once and
// silently decayed for months. Counts that describe the repository should be
// derived from it, so this file owns them and ARCHITECTURE.md links here.
//
// Run `npm run docs:architecture` to refresh; the contract test fails when the
// committed snapshot no longer matches the repository.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const sqlIn = async (directory) =>
  (await readdir(resolve(root, directory))).filter((name) => name.endsWith('.sql')).sort();

const migrations = await sqlIn('supabase/migrations');
const pgTapSuites = await sqlIn('supabase/tests');

const migrationSql = (
  await Promise.all(
    migrations.map((name) => readFile(resolve(root, 'supabase/migrations', name), 'utf8')),
  )
).join('\n');

const distinct = (pattern) => {
  const found = new Set();
  for (const match of migrationSql.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    if (name && !['public', 'private'].includes(name)) found.add(name);
  }
  return found;
};

const tables = distinct(/create table (?:if not exists )?(?:public\.)?([a-z_0-9]+)/gi);
const views = distinct(/create (?:or replace )?view (?:public\.)?([a-z_0-9]+)/gi);
const policies = (migrationSql.match(/create policy/gi) ?? []).length;
const securityDefiner = (migrationSql.match(/security definer/gi) ?? []).length;
const searchPathPins = (migrationSql.match(/set search_path/gi) ?? []).length;
const rlsEnabled = distinct(
  /alter table (?:public\.)?([a-z_0-9]+)\s+enable row level security/gi,
);

const edgeFunctions = (
  await readdir(resolve(root, 'supabase/functions'), { withFileTypes: true })
)
  .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
  .map((entry) => entry.name)
  .sort();

const workflows = (await readdir(resolve(root, '.github/workflows')))
  .filter((name) => name.endsWith('.yml'))
  .sort();

const tablesWithoutRls = [...tables].filter((name) => !rlsEnabled.has(name)).sort();

const snapshot = `# Architecture snapshot

<!--
  GENERATED FILE -- do not edit by hand.
  Run \`npm run docs:architecture\` to regenerate.
  tests/architectureSnapshotContracts.test.mjs fails when this drifts.
-->

Derived from the repository on each run of \`npm run docs:architecture\`.

## Database

| Measure | Count |
|---|---|
| Migrations | ${migrations.length} |
| Tables created | ${tables.size} |
| Tables with RLS enabled | ${rlsEnabled.size} |
| Views | ${views.size} |
| \`create policy\` statements | ${policies} |
| \`security definer\` functions | ${securityDefiner} |
| \`set search_path\` pins | ${searchPathPins} |
| pgTAP suites | ${pgTapSuites.length} |

${
  tablesWithoutRls.length === 0
    ? 'Every table created in a migration has row level security enabled.'
    : `Tables without an \`enable row level security\` statement: ${tablesWithoutRls.map((n) => `\`${n}\``).join(', ')}.`
}

## Edge Functions (${edgeFunctions.length})

${edgeFunctions.map((name) => `- \`${name}\``).join('\n')}

## GitHub workflows (${workflows.length})

${workflows.map((name) => `- \`${name}\``).join('\n')}

## First and last migration

- First: \`${migrations[0]}\`
- Last: \`${migrations.at(-1)}\`
`;

await writeFile(resolve(root, 'docs/ARCHITECTURE_SNAPSHOT.md'), snapshot);
console.log(
  `Architecture snapshot written: ${migrations.length} migrations, ${tables.size} tables, `
  + `${edgeFunctions.length} Edge Functions, ${pgTapSuites.length} pgTAP suites.`,
);
