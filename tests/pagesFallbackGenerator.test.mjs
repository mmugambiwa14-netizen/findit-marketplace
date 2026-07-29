import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPagesFallback } from '../scripts/create-pages-spa-fallback.mjs';

test('Pages fallback generation embeds only a normalized deployment base', () => {
  const html = renderPagesFallback('/findit-marketplace/');

  assert.match(html, /"\/findit-marketplace\/"/);
  assert.match(html, /window\.location\.replace/);
  assert.match(html, /window\.location\.search/);
  assert.match(html, /window\.location\.hash/);
});

test('Pages fallback rejects ambiguous or non-absolute bases', () => {
  for (const value of ['', 'findit/', '/findit', '//findit/', '/findit//nested/']) {
    assert.throws(() => renderPagesFallback(value), /Pages base path/);
  }
});
