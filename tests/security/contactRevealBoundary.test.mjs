import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const [repository, component] = await Promise.all([
  read('src/repositories/contactRevealRepository.js'),
  read('src/components/listings/ContactButtons.jsx'),
]);

test('contact values are fetched only through the dedicated reveal RPC boundary', () => {
  assert.match(repository, /reveal_service_contact/);
  assert.match(repository, /reveal_listing_contact/);
  assert.match(repository, /supabase\.rpc\(/);
  assert.doesNotMatch(repository, /\.from\(['"](?:services|properties|cars|machinery|listings)['"]\)/);
});

test('the RPC receives only the selected record identifier and type-specific parameter', () => {
  assert.match(repository, /p_service_id:\s*id/);
  assert.match(repository, /p_listing_id:\s*id/);
  assert.doesNotMatch(repository, /select\s*\(\s*['"].*contact_/s);
});

test('rate-limit failures are surfaced without exposing provider details', () => {
  assert.match(repository, /error\.code === '54000'/);
  assert.match(repository, /contact limit for today/i);
  assert.match(repository, /Unable to load contact details right now/);
  assert.doesNotMatch(repository, /throw\s+error\s*;/);
});

test('public listing rows use contact availability flags rather than rendering raw values', () => {
  assert.match(component, /listing\.has_contact_phone/);
  assert.match(component, /listing\.has_contact_whatsapp/);
  assert.match(component, /listing\.has_contact_email/);
  assert.match(component, /await revealContactDetails\(type, listing\.id\)/);
  assert.doesNotMatch(component, />\s*\{\s*(?:rawPhone|rawWhatsapp|rawEmail)\s*\}\s*</);
});

test('external actions require confirmation before the reveal call runs', () => {
  assert.match(component, /setExternalAction\(kind\)/);
  assert.match(component, /<AlertDialog[^>]*open=\{Boolean\(externalAction\)\}/);
  assert.match(component, /<AlertDialogAction[^>]*onClick=\{revealForAction\}/);
});

test('WhatsApp values are reduced to digits and new windows use noopener and noreferrer', () => {
  assert.match(component, /replace\(\/\[\^0-9\]\/g,\s*''\)/);
  assert.match(component, /window\.open\([^\n]+['_"]blank['_"],\s*['"]noopener,noreferrer['"]\)/);
});
