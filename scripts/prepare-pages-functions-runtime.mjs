import process from 'node:process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const outputUrl = new URL('../cloudflare/pages-runtime-config.js', import.meta.url);

function jwtRole(value) {
  const segments = value.split('.');
  if (segments.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'))?.role || null;
  } catch {
    return null;
  }
}

export function validatePagesPublishableKey(value) {
  const key = String(value || '').trim();
  if (key.startsWith('sb_secret_')) throw new Error('A Supabase secret key cannot be bundled into Pages Functions');
  if (key.startsWith('sb_publishable_')) return key;
  if (jwtRole(key) === 'anon') return key;
  throw new Error('Pages Functions require a Supabase publishable or legacy anon key');
}

export function renderPagesRuntimeConfig(urlValue, keyValue) {
  let url;
  try {
    url = new URL(String(urlValue || '').trim());
  } catch {
    throw new Error('Pages Functions require a valid Supabase URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Pages Functions require a secure Supabase URL');
  }
  const publishableKey = validatePagesPublishableKey(keyValue);
  return [
    '// Generated in the deployment checkout. Do not commit deployed values.',
    'export const generatedPagesRuntimeConfig = Object.freeze({',
    `  supabaseUrl: ${JSON.stringify(url.toString().replace(/\/$/, ''))},`,
    `  supabasePublishableKey: ${JSON.stringify(publishableKey)},`,
    '});',
    '',
  ].join('\n');
}

export async function preparePagesFunctionsRuntime(env = process.env) {
  const source = renderPagesRuntimeConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  await writeFile(outputUrl, source, 'utf8');
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await preparePagesFunctionsRuntime();
  console.log('Prepared environment-specific Cloudflare Pages Functions runtime configuration.');
}
