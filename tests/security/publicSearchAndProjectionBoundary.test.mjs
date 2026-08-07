import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repositoryUrl = new URL('../../src/repositories/publicListingsRepository.js', import.meta.url);
const migrationUrl = new URL('../../supabase/migrations/20260808020000_currency_safe_public_listing_search_v2.sql', import.meta.url);

async function repositorySource() {
  return readFile(repositoryUrl, 'utf8');
}

function functionBody(source, functionName, nextExportName) {
  const start = source.indexOf(`export async function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} must exist`);
  const end = nextExportName
    ? source.indexOf(`export async function ${nextExportName}`, start + 1)
    : source.length;
  assert.notEqual(end, -1, `Unable to determine ${functionName} boundary`);
  return source.slice(start, end);
}

test('public listing projection remains explicit and excludes raw seller contact values', async () => {
  const source = await repositorySource();
  const projectionStart = source.indexOf('export const PUBLIC_LISTING_SELECT');
  const projectionEnd = source.indexOf('`;', projectionStart);
  assert.notEqual(projectionStart, -1);
  assert.notEqual(projectionEnd, -1);
  const projection = source.slice(projectionStart, projectionEnd);

  assert.doesNotMatch(projection, /select\s*\*/i);
  assert.doesNotMatch(projection, /\bcontact_phone\b/);
  assert.doesNotMatch(projection, /\bcontact_whatsapp\b/);
  assert.doesNotMatch(projection, /\bcontact_email\b/);
  assert.match(projection, /has_contact_phone/);
  assert.match(projection, /has_contact_whatsapp/);
  assert.match(projection, /has_contact_email/);
  assert.match(projection, /latitude:public_latitude/);
  assert.match(projection, /longitude:public_longitude/);
});

test('active public search remains on the currency-safe bounded v2 keyset RPC path', async () => {
  const source = await repositorySource();
  const body = functionBody(source, 'findPublicListingsPage', 'findPublicListingTitleSuggestions');

  assert.match(body, /supabase\.rpc\(['"]public_listing_search_page_v2['"]/);
  assert.doesNotMatch(body, /supabase\.rpc\(['"]public_listing_search_page['"]/);
  assert.match(body, /p_country_code:\s*request\.countryCode/);
  assert.match(body, /p_currency:\s*request\.currency/);
  assert.match(body, /p_cursor_value:/);
  assert.match(body, /p_cursor_id:/);
  assert.match(body, /p_limit:\s*request\.pageSize/);
  assert.doesNotMatch(body, /count:\s*['"]exact['"]/);
  assert.doesNotMatch(body, /\.range\(/);
});

test('v2 database search projects public coordinates and no raw contact values', async () => {
  const migration = await readFile(migrationUrl, 'utf8');
  const privateStart = migration.indexOf('create or replace function private.public_listing_search_page_v2');
  const publicStart = migration.indexOf('create or replace function public.public_listing_search_page_v2');
  assert.notEqual(privateStart, -1);
  assert.notEqual(publicStart, -1);
  const privateFunction = migration.slice(privateStart, publicStart);

  assert.match(privateFunction, /listing\.public_latitude/);
  assert.match(privateFunction, /listing\.public_longitude/);
  assert.match(privateFunction, /listing\.content_suspended_at is null/);
  assert.match(privateFunction, /listing\.native_currency/);
  assert.match(privateFunction, /listing\.native_price/);
  assert.doesNotMatch(privateFunction.match(/returns table \([\s\S]*?\)\s*language plpgsql/i)?.[0] ?? '', /\bcontact_phone text\b|\bcontact_whatsapp text\b|\bcontact_email text\b/);
});

test('public listing reads always preserve enquiry-eligible status filtering', async () => {
  const source = await repositorySource();
  const latest = functionBody(source, 'findLatestAvailableListings', 'findSavedListingsByIds');
  const recommended = functionBody(source, 'findPublicListingsByIds', 'findPublicListings');
  const seller = functionBody(source, 'findPublicSellerListings', null);

  for (const body of [latest, recommended, seller]) {
    assert.match(body, /\.in\(['"]status['"],\s*\[['"]available['"],\s*['"]under_offer['"]\]\)/);
  }
});

test('public seller pagination uses a stable descending cursor and limit plus one', async () => {
  const source = await repositorySource();
  const body = functionBody(source, 'findPublicSellerListings', null);

  assert.match(body, /applyDescendingCreatedAtCursor\(query, request\.cursor\)/);
  assert.match(body, /\.order\(['"]created_at['"],\s*\{\s*ascending:\s*false\s*\}\)/);
  assert.match(body, /\.order\(['"]id['"],\s*\{\s*ascending:\s*false\s*\}\)/);
  assert.match(body, /\.limit\(request\.limit \+ 1\)/);
  assert.doesNotMatch(body, /\.range\(/);
});

test('title suggestions remain kind-scoped, status-scoped, escaped, and bounded', async () => {
  const source = await repositorySource();
  const body = functionBody(source, 'findPublicListingTitleSuggestions', 'findPublicListingById');

  assert.match(body, /assertKind\(kind\)/);
  assert.match(body, /escapeLikePattern\(searchTerm\)/);
  assert.match(body, /\.in\(['"]status['"],\s*\[['"]available['"],\s*['"]under_offer['"]\]\)/);
  assert.match(body, /\.limit\(limit\)/);
});
