import { readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const projectRoot = resolve(import.meta.dirname, '..');
const outputRoot = join(projectRoot, 'dist');
const html = readFileSync(join(outputRoot, 'index.html'), 'utf8');
const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
const styleMatches = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)];
// Chunks the entry document preloads are fetched on the same initial paint, so
// they count towards the initial payload. Measuring the entry chunk alone would
// let a regression pass simply by relocating code into a preloaded sibling.
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
const initialScriptPaths = [entryPath, ...preloadMatches.map((match) => fromOutput(match[1]))];
const entryRawBytes = initialScriptPaths.reduce((total, file) => total + statSync(file).size, 0);
const entryGzipBytes = initialScriptPaths.reduce(
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
  entryRawBytes: 560 * 1024,
  entryGzipBytes: 170 * 1024,
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
  `Production build budget: PASS (${basename(entryPath)} ${entryRawBytes} B raw / ${entryGzipBytes} B gzip; CSS ${styleRawBytes} B raw / ${styleGzipBytes} B gzip)`,
);
