import { readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const projectRoot = resolve(import.meta.dirname, '..');
const outputRoot = join(projectRoot, 'dist');
const html = readFileSync(join(outputRoot, 'index.html'), 'utf8');
const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
const styleMatches = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)];
// Chunks the entry document preloads are fetched on the same initial paint, so
// they count towards the initial payload. The bootstrap also imports App and
// AppErrorBoundary dynamically before the first render; those imports and their
// static shared dependencies are part of the critical path even when Vite does
// not emit modulepreload tags for them. Measuring the entry chunk alone would
// let a regression pass simply by relocating code into a sibling chunk.
const preloadMatches = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)];

if (!entryMatch) {
  throw new Error('Build budget verification could not identify the initial JavaScript entry.');
}

const configuredBase = process.env.VITE_BASE_PATH || '/';
const normalizedBase = `/${configuredBase.replace(/^\/+|\/+$/g, '')}/`;
const fromOutput = (publicPath) => {
  const pathname = new URL(publicPath, 'https://findit.invalid/').pathname;
  const outputPath = normalizedBase === '//'
    ? pathname
    : pathname.startsWith(normalizedBase)
      ? pathname.slice(normalizedBase.length)
      : pathname;

  return join(outputRoot, outputPath.replace(/^\/+/, ''));
};
const entryPath = fromOutput(entryMatch[1]);
const stylePaths = styleMatches.map((match) => fromOutput(match[1]));
const staticImportPattern = /\b(?:from\s*|import\s*)["']([^"']+\.js)["']/g;
const dynamicImportPattern = /\bimport\(\s*["']([^"']+\.js)["']\s*\)/g;
const initialScriptPaths = [entryPath, ...preloadMatches.map((match) => fromOutput(match[1]))];

function referencedScripts(filePath, pattern) {
  const source = readFileSync(filePath, 'utf8');
  const importerPath = relative(outputRoot, filePath).replaceAll('\\', '/');
  const importerUrl = new URL(`https://findit.invalid/${importerPath}`);
  return [...source.matchAll(pattern)]
    .map((match) => match[1])
    .map((reference) => new URL(reference, importerUrl).pathname)
    .map((pathname) => join(outputRoot, pathname.replace(/^\/+/, '')));
}

// Walk the bootstrap graph once. Dynamic imports in the HTML entry are awaited
// by src/main.jsx, while dynamic imports discovered inside App are route-level
// lazy chunks and are intentionally not counted until navigation. Static shared
// imports are always fetched with their parent and are counted exactly once.
const criticalScriptPaths = new Set(initialScriptPaths);
const queue = [...initialScriptPaths];
for (const path of referencedScripts(entryPath, dynamicImportPattern)) {
  if (!criticalScriptPaths.has(path)) {
    criticalScriptPaths.add(path);
    queue.push(path);
  }
}
while (queue.length > 0) {
  const currentPath = queue.shift();
  for (const path of referencedScripts(currentPath, staticImportPattern)) {
    if (criticalScriptPaths.has(path)) continue;
    criticalScriptPaths.add(path);
    queue.push(path);
  }
}
const initialScriptPathsMeasured = [...criticalScriptPaths];
const entryRawBytes = initialScriptPathsMeasured.reduce((total, file) => total + statSync(file).size, 0);
const entryGzipBytes = initialScriptPathsMeasured.reduce(
  (total, file) => total + gzipSync(readFileSync(file)).length,
  0,
);
const styleRawBytes = stylePaths.reduce((total, file) => total + statSync(file).size, 0);
const styleGzipBytes = stylePaths.reduce(
  (total, file) => total + gzipSync(readFileSync(file)).length,
  0,
);

// These are release gates, not targets. Lower them deliberately after measured
// optimization; do not raise them merely to make a regression pass. The raw CSS
// ceiling was deliberately re-baselined by 1 KiB for the certified fluid
// interaction primitives while the transfer-sensitive gzip ceiling stays fixed.
const budgets = {
  // The bootstrap graph is intentionally measured rather than hidden behind
  // modulepreload detection. Keep a small guard band over the current measured
  // baseline (about 737 KiB raw / 219 KiB gzip) until the shell is split further.
  entryRawBytes: 760 * 1024,
  entryGzipBytes: 225 * 1024,
  styleRawBytes: 111 * 1024,
  styleGzipBytes: 25 * 1024,
};

const measured = { entryRawBytes, entryGzipBytes, styleRawBytes, styleGzipBytes };
const failures = Object.entries(budgets)
  .filter(([metric, maximum]) => measured[metric] > maximum)
  .map(([metric, maximum]) => `${metric}: ${measured[metric]} > ${maximum} bytes`);

if (failures.length > 0) {
  throw new Error(`Production build exceeds its performance budget:\n${failures.join('\n')}`);
}

console.log(
  `Production build budget: PASS (${initialScriptPathsMeasured.length} critical JS chunks; ${basename(entryPath)} ${entryRawBytes} B raw / ${entryGzipBytes} B gzip; CSS ${styleRawBytes} B raw / ${styleGzipBytes} B gzip)`,
);
