import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const functionsRoot = fileURLToPath(new URL('../supabase/functions/', import.meta.url));

async function collectTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTypeScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(relative(root, fullPath).replaceAll('\\', '/'));
    }
  }

  return files;
}

const files = (await collectTypeScriptFiles(functionsRoot)).sort();
if (files.length === 0) {
  console.error('No Supabase Edge Function TypeScript files found.');
  process.exit(1);
}

// Supabase's Edge Runtime declarations include npm type dependencies that are
// not application dependencies. Resolve them from Deno's global cache without
// creating a local node_modules tree: automatic mode can replace npm's locked
// root packages with Deno-managed links and make a subsequent Vite build
// nondeterministic. The checker is read-only and must not update deno.lock.
const denoArgs = ['check', '--node-modules-dir=none', '--no-lock', ...files];
let result = spawnSync('deno', denoArgs, {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const missingDeno = result.error?.code === 'ENOENT' ||
  /not recognized|not found|No such file or directory/i.test(`${result.stderr ?? ''}${result.stdout ?? ''}`);

if (missingDeno) {
  result = spawnSync('npx', ['--yes', 'deno', ...denoArgs], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) {
  console.error('Deno is required for Edge Function typechecking.');
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
