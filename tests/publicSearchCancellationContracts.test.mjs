import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [searchPage, service, listingRepository, locationsRepository] = await Promise.all([
  read('src/pages/Search.jsx'),
  read('src/services/publicListingsService.js'),
  read('src/repositories/publicListingsRepository.js'),
  read('src/repositories/locationsRepository.js'),
]);

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('active Search result pages pass TanStack cancellation into the service', () => {
  const resultsBlock = between(searchPage, 'const resultsQuery = useInfiniteQuery', 'const listings = useMemo');
  assert.match(resultsBlock, /queryFn: \(\{ pageParam, signal \}\)/);
  assert.match(resultsBlock, /searchPublicListingsPage\(\{ \.\.\.request, cursor: pageParam \|\| null \}, \{ signal \}\)/);
  assert.match(resultsBlock, /getNextPageParam: \(lastPage\) => lastPage\.nextCursor/);
});

test('active Search suggestions pass TanStack cancellation into the service', () => {
  const suggestionsBlock = between(searchPage, 'const { data: suggestions } = useQuery', 'const categorySuggestions = useMemo');
  assert.match(suggestionsBlock, /queryFn: \(\{ signal \}\) => getPublicSearchSuggestions\(type, suggestionQuery, \{ signal \}\)/);
  assert.match(searchPage, /useDebouncedValue\(queryInput\.trim\(\)\.slice\(0, 100\), 250\)/);
});

test('public listing Search propagates cancellation through the thin keyset RPC and card enrichment boundary', () => {
  const serviceBlock = between(service, 'export async function searchPublicListingsPage', 'export async function getPublicSearchSuggestions');
  assert.match(serviceBlock, /findPublicListingsPage\(request, signal\)/);
  assert.match(serviceBlock, /throwIfAborted\(signal\)/);
  assert.match(serviceBlock, /enrichPublicListingCards\(cleanRows\)/);

  const repositoryBlock = between(listingRepository, 'export async function findPublicListingsPage', 'export async function findPublicListingTitleSuggestions');
  assert.match(repositoryBlock, /let query = supabase\.rpc\('public_listing_search_card_page_v1'/);
  assert.match(repositoryBlock, /if \(signal\) query = query\.abortSignal\(signal\)/);
});

test('listing and location suggestion reads are independently abortable', () => {
  const serviceBlock = between(service, 'export async function getPublicSearchSuggestions', 'export const searchPublicListings');
  assert.match(serviceBlock, /findPublicListingTitleSuggestions\(normalized\.kind, normalized\.query, 5, signal\)/);
  assert.match(serviceBlock, /findActiveLocationSuggestions\(normalized\.query, \{ signal \}\)/);
  assert.match(serviceBlock, /await Promise\.all\(\[/);
  assert.match(serviceBlock, /throwIfAborted\(signal\)/);

  const listingSuggestionBlock = between(listingRepository, 'export async function findPublicListingTitleSuggestions', 'export async function findPublicListingById');
  assert.match(listingSuggestionBlock, /signal = null/);
  assert.match(listingSuggestionBlock, /if \(signal\) query = query\.abortSignal\(signal\)/);

  const locationSuggestionBlock = locationsRepository.slice(locationsRepository.indexOf('export async function findActiveLocationSuggestions'));
  assert.match(locationSuggestionBlock, /signal = null/);
  assert.match(locationSuggestionBlock, /if \(signal\) query = query\.abortSignal\(signal\)/);
});
