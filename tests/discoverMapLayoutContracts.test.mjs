import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/discover/DiscoverMapView.jsx', import.meta.url), 'utf8');

test('map category filters live below the map instead of covering it', () => {
  const railClass = source.match(/className="([^"]*discover-map-rail[^"]*)"/)?.[1] || '';

  assert.match(source, /<section className="space-y-3" aria-label="Discover marketplace map">/);
  assert.match(source, /<div className="locked-map-panel relative min-h-\[540px\]">/);
  assert.match(railClass, /surface-panel/);
  assert.doesNotMatch(railClass, /\babsolute\b|\bbottom-/);
  assert.doesNotMatch(source, /discover-map-rail absolute/);
});
