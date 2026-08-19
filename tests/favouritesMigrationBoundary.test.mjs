import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the active Favourites page uses the Supabase domain boundary only', async () => {
  const [page, service, repository] = await Promise.all([
    readFile(new URL('../src/pages/Saved.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/favouritesService.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/repositories/favouritesRepository.js', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(page, /base44Client|base44\.entities/);
  assert.match(page, /getFavouriteListingsPage/);
  assert.match(service, /findSavedListingsByIds/);
  assert.match(repository, /from\('saved_listings'\)/);
});
