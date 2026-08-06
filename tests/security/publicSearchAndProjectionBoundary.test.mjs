import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repositoryUrl = new URL('../../src/repositories/publicListingsRepository.js', import.meta.url);

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
});

test('active public search remains on the bounded keyset RPC path', async () => {
  const source = await repositorySource();
  const body = functionBody(source, 'findPublicListingsPage', 'findPublicListingTitleSuggestions');

  assert.match(body, /supabase\.rpc\(['"]public_listing_search_page['"]/);
  assert.match(body, /p_cursor_value:/);
  assert.match(body, /p_cursor_id:/);
  assert.match(body, /p_limit:\s*request\.pageSize/);
  assert.doesNotMatch(body, /count:\s*['"]exact['"]/);
  assert.doesNotMatch(body, /\.range\(/);
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
