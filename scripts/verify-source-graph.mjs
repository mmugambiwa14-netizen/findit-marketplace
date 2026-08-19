import { access, readdir, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const sourceRoots = ['src', 'tests', 'scripts', 'supabase/functions'];
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const resolutionExtensions = ['', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.json'];
const ignoredDirectories = new Set(['node_modules', 'dist', '.git', 'coverage']);

async function loadTypeScript() {
  const candidates = [
    'typescript',
    pathToFileURL(resolve(dirname(process.execPath), '../lib/node_modules/typescript/lib/typescript.js')).href,
    pathToFileURL(resolve(dirname(process.execPath), '../../lib/node_modules/typescript/lib/typescript.js')).href,
  ];
  for (const candidate of candidates) {
    try {
      const module = await import(candidate);
      return module.default ?? module;
    } catch {
      // Try the next local/global compiler location.
    }
  }
  throw new Error('TypeScript parser is unavailable. Run npm ci or install TypeScript in the active Node toolchain.');
}

async function collect(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) await collect(fullPath, output);
    else if (sourceExtensions.has(extname(entry.name))) output.push(fullPath);
  }
  return output;
}

async function exists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalImport(file, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = resolve(root, 'src', specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(file), specifier);
  else return true;

  for (const extension of resolutionExtensions) {
    const candidate = `${base}${extension}`;
    if (await exists(candidate)) return candidate;
  }
  for (const extension of resolutionExtensions.slice(1)) {
    const candidate = join(base, `index${extension}`);
    if (await exists(candidate)) return candidate;
  }
  return false;
}

const ts = await loadTypeScript();
const files = [];
for (const sourceRoot of sourceRoots) {
  const directory = resolve(root, sourceRoot);
  if (await exists(directory)) await collect(directory, files);
}
files.sort();

const parseFailures = [];
const unresolved = [];
const localEdges = new Map(files.map((file) => [file, []]));
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX
    : file.endsWith('.jsx') ? ts.ScriptKind.JSX
      : file.endsWith('.ts') ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  for (const diagnostic of parsed.parseDiagnostics) {
    const position = diagnostic.start == null ? null : parsed.getLineAndCharacterOfPosition(diagnostic.start);
    parseFailures.push(`${file}${position ? `:${position.line + 1}:${position.character + 1}` : ''}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  }

  const specifiers = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  for (const specifier of specifiers) {
    const resolved = await resolveLocalImport(file, specifier);
    if (!resolved) {
      unresolved.push(`${file}: ${specifier}`);
    } else if (resolved !== true && localEdges.has(file) && localEdges.has(resolved)) {
      localEdges.get(file).push(resolved);
    }
  }
}

const srcRoot = resolve(root, 'src');
const isWithin = (file, parent) => {
  const pathFromParent = relative(parent, file);
  return pathFromParent === '' || (!pathFromParent.startsWith('..') && !isAbsolute(pathFromParent));
};
const runtimeFiles = files.filter((file) => isWithin(file, srcRoot));
const runtimeRoots = [
  resolve(root, 'src/main.jsx'),
  resolve(root, 'src/documentBootstrap.js'),
];
const intentionalRuntimeExceptions = new Set([
  resolve(root, 'src/domain/peekThreads/ranking.js'),
  resolve(root, 'src/types/runtime-extensions.d.ts'),
]);
const reachableRuntime = new Set();
const runtimeQueue = runtimeRoots.filter((file) => localEdges.has(file));
while (runtimeQueue.length > 0) {
  const file = runtimeQueue.shift();
  if (reachableRuntime.has(file)) continue;
  reachableRuntime.add(file);
  for (const dependency of localEdges.get(file) || []) {
    if (isWithin(dependency, srcRoot) && !reachableRuntime.has(dependency)) runtimeQueue.push(dependency);
  }
}
const orphanRuntime = runtimeFiles.filter((file) => !reachableRuntime.has(file) && !intentionalRuntimeExceptions.has(file));
if (orphanRuntime.length) {
  unresolved.push(...orphanRuntime.map((file) => `${file}: not reachable from the runtime entry roots`));
}

if (parseFailures.length || unresolved.length) {
  if (parseFailures.length) {
    console.error('Source parse failures:');
    for (const failure of parseFailures) console.error(`- ${failure}`);
  }
  if (unresolved.length) {
    console.error('Unresolved local imports:');
    for (const failure of unresolved) console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Source graph verification passed: ${files.length} modules parsed, ${reachableRuntime.size} runtime modules reachable, 0 unresolved local imports.`);
