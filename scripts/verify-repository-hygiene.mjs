import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const ignoredExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.woff', '.woff2', '.ttf']);
const textFiles = [];
const failures = [];

const prohibitedUnicodeRanges = [
  [0x1f000, 0x1faff],
  [0x2300, 0x23ff],
  [0x2600, 0x27bf],
];

const secretPatterns = [
  { name: 'private key', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'GitHub token', expression: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/ },
  { name: 'AWS access key', expression: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Stripe live secret', expression: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'Supabase secret key', expression: /\bsb_secret_[A-Za-z0-9._-]{16,}\b/ },
];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (ignoredExtensions.has(extname(entry.name).toLowerCase())) continue;
    textFiles.push(path);
  }
}

function containsProhibitedSymbol(text) {
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (prohibitedUnicodeRanges.some(([start, end]) => codePoint >= start && codePoint <= end)) return character;
  }
  return null;
}

await walk(root);

for (const path of textFiles) {
  let content;
  try {
    content = await readFile(path, 'utf8');
  } catch {
    continue;
  }
  const displayPath = relative(root, path);
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (/^(?:<<<<<<<|=======|>>>>>>>)(?:\s|$)/.test(line)) {
      failures.push(`${displayPath}:${lineNumber}: unresolved merge-conflict marker`);
    }
    const prohibited = containsProhibitedSymbol(line);
    if (prohibited) {
      failures.push(`${displayPath}:${lineNumber}: prohibited emoji or pictographic symbol U+${prohibited.codePointAt(0).toString(16).toUpperCase()}`);
    }
    for (const pattern of secretPatterns) {
      if (pattern.expression.test(line)) failures.push(`${displayPath}:${lineNumber}: possible committed ${pattern.name}`);
    }
  });
}

if (failures.length) {
  console.error('Repository hygiene verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Repository hygiene verification passed: ${textFiles.length} text files inspected.`);
