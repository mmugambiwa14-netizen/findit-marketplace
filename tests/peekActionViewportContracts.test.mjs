import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [peekSlide, catalogueHeader, publishingGate, viewport, indexHtml] = await Promise.all([
  read('src/components/tours/ImmersivePeekSlide.jsx'),
  read('src/components/tours/TourCatalogueHeader.jsx'),
  read('src/components/business/BusinessPublishingGate.jsx'),
  read('src/pwa-viewport.css'),
  read('index.html'),
]);

test('Peek action row has one listing destination and a conditional request action', () => {
  assert.match(peekSlide, /const canRequestPeek = !isOwner && listingOnly;/);
  assert.match(peekSlide, /View listing/);
  assert.match(peekSlide, /Request a Peek/);
  assert.doesNotMatch(peekSlide, />More details</);
  assert.match(peekSlide, /canRequestPeek \? 'grid-cols-2' : 'grid-cols-1'/);
});

test('mobile publishing and Peek search controls stay above the Safari auto-zoom threshold', () => {
  assert.match(catalogueHeader, /tour-catalogue-search[\s\S]*text-base md:text-sm/);
  assert.match(catalogueHeader, /tour-catalogue-location[\s\S]*text-base md:text-sm/);
  assert.equal((publishingGate.match(/<select className="[^"]*text-base md:text-sm/g) || []).length, 2);
  assert.match(viewport, /@media \(max-width: 767px\)/);
  assert.match(viewport, /input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\):not\(\[type='range'\]\):not\(\[type='file'\]\)/);
  assert.match(viewport, /font-size: 16px/);
  assert.match(indexHtml, /maximum-scale=1(?:\.0)?/);
  assert.match(indexHtml, /user-scalable=no/);
});
