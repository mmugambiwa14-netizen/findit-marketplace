import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [searchPage, filterSheet, searchToolbar, sortSheet] = await Promise.all([
  read('src/pages/Search.jsx'),
  read('src/components/search/FilterSheet.jsx'),
  read('src/components/search/SearchToolbar.jsx'),
  read('src/components/search/SortSheet.jsx'),
]);

test('filter sheet stages category, location, specs, currency and price until one apply action', () => {
  assert.match(filterSheet, /const \[draftFilters, setDraftFilters\]/);
  assert.match(filterSheet, /const \[draftLocation, setDraftLocation\]/);
  assert.match(filterSheet, /setDraftMinPrice/);
  assert.match(filterSheet, /setDraftMaxPrice/);
  assert.match(filterSheet, /onApply\(\{/);
  assert.match(filterSheet, /filters:\s*\{/);
  assert.match(filterSheet, /location:\s*draftLocation/);
  assert.match(filterSheet, />Reset</);
  assert.match(filterSheet, />Show results</);
  assert.match(filterSheet, /max-h-\[88dvh\]/);
});

test('Search commits staged filters through one URL update boundary', () => {
  assert.match(searchPage, /const applyFilterSheet = \(\{ filters: nextFilters, location \}\) =>/);
  assert.match(searchPage, /currency:\s*nextCurrency/);
  assert.match(searchPage, /minPrice:\s*nextCurrency \? nextFilters\.minPrice : null/);
  assert.match(searchPage, /maxPrice:\s*nextCurrency \? nextFilters\.maxPrice : null/);
  assert.match(searchPage, /location:\s*location\?\.city \|\| null/);
  assert.match(searchPage, /onApply=\{applyFilterSheet\}/);
  assert.doesNotMatch(searchPage, /<FilterSheet[\s\S]*?onLocationChange=/);
  assert.doesNotMatch(searchPage, /<FilterSheet[\s\S]*?onApplyPrice=/);
});

test('mobile search exposes labeled filters and sort with active-filter count', () => {
  assert.match(searchToolbar, /grid grid-cols-2 gap-2/);
  assert.match(searchToolbar, /<span>Filters<\/span>/);
  assert.match(searchToolbar, /filterCount > 0/);
  assert.match(searchToolbar, /Open filters, \$\{filterCount\} active/);
  assert.match(searchToolbar, /<span className="truncate">\{sortLabel\}<\/span>/);
  assert.match(searchToolbar, /placeholder="Search listings"/);
  assert.doesNotMatch(searchToolbar, /hidden text-xs font-semibold lg:inline/);
});

test('price sorting remains unavailable until a listing currency is selected', () => {
  assert.match(sortSheet, /requiresCurrency/);
  assert.match(sortSheet, /Price sorting needs a currency/);
  assert.match(sortSheet, /disabled=\{disabled\}/);
  assert.match(searchPage, /!currency && PRICE_SORTS\.has\(normalizedSort\)/);
});
