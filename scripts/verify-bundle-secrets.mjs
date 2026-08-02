// verify-bundle-secrets.mjs
//
// Build gate for Pass 4B Task 6. Everything Vite inlines into dist/ is public:
// VITE_-prefixed variables are compiled into the bundle and the bundle is
// served to anyone. This fails the build if anything secret-shaped reaches it.
//
// The Supabase publishable/anon key is expected to be present -- that is its
// design. It is allowlisted explicitly rather than by loosening the patterns,
// and a JWT-shaped token is accepted only when its decoded payload actually
// says `role: anon`, so a service_role JWT can never pass as "just the anon
// key".

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const outputRoot = join(projectRoot, 'dist');
const inspectExtensions = new Set(['.html', '.js', '.css', '.json', '.txt', '.map']);

const PATTERNS = [
  { name: 'service_role reference', re: /service_role/gi },
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]+/g },
  { name: 'Stripe live/test secret key', re: /\bsk_(?:live|test)_[A-Za-z0-9]{10,}/g },
  { name: 'PEM private key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/g },
  // The value must be a quoted string literal. Without that anchor this
  // matches minified library code such as
  // `regenerateClientSecret:this._regenerateOAuthClientSecret.bind(this)`
  // in supabase-js, which is a method name and not a secret.
  { name: 'secret assigned a literal value', re: /(?:api[_-]?secret|client[_-]?secret|webhook[_-]?secret)["']?\s*[:=]\s*["'][A-Za-z0-9._-]{16,}["']/gi },
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g },
];

function decodeJwtRole(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

function collect(directory, files = []) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) collect(path, files);
    else if (inspectExtensions.has(path.slice(path.lastIndexOf('.')))) files.push(path);
  }
  return files;
}

let files;
try {
  files = collect(outputRoot);
} catch {
  console.error('Bundle secret scan: FAIL (dist/ not found -- run the build first)');
  process.exit(1);
}

const violations = [];

for (const file of files) {
  const contents = readFileSync(file, 'utf8');
  for (const { name, re } of PATTERNS) {
    for (const match of contents.matchAll(re)) {
      const value = match[0];

      // A JWT is only acceptable when it is genuinely the anon key.
      if (name === 'JWT') {
        const role = decodeJwtRole(value);
        if (role === 'anon') continue;
        violations.push(`${relative(projectRoot, file)}: JWT with role="${role ?? 'unknown'}"`);
        continue;
      }

      violations.push(`${relative(projectRoot, file)}: ${name} (${value.slice(0, 24)}…)`);
    }
  }
}

// Source maps must never ship -- they reconstruct original source.
const sourceMaps = files.filter((file) => file.endsWith('.map'));
for (const map of sourceMaps) {
  violations.push(`${relative(projectRoot, map)}: source map present in build output`);
}

if (violations.length > 0) {
  console.error('Bundle secret scan: FAIL');
  for (const violation of violations) console.error(`  - ${violation}`);
  console.error('\nNothing secret may be VITE_-prefixed or committed into client source.');
  console.error('Rotate anything real that appears above -- it has been published.');
  process.exit(1);
}

console.log(
  `Bundle secret scan: PASS (${files.length} build artefacts inspected, no source maps, no secret material)`,
);
