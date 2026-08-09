import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, styles] = await Promise.all([
  readFile(new URL('../src/components/discover/DiscoverMapView.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/findit-locked-design.css', import.meta.url), 'utf8'),
]);

test('map category filters live below the map instead of covering it', () => {
  const railClass = source.match(/className="([^"]*discover-map-rail[^"]*)"/)?.[1] || '';

  assert.match(source, /<section className="space-y-3" aria-label="Discover marketplace map">/);
  assert.match(source, /<div className="locked-map-panel relative min-h-\[540px\]">/);
  assert.match(railClass, /surface-panel/);
  assert.doesNotMatch(railClass, /\babsolute\b|\bbottom-/);
  assert.doesNotMatch(source, /discover-map-rail absolute/);
});

test('map markers render the icon assigned to each marketplace category', () => {
  assert.match(source, /const visual = CATEGORY_VISUALS\[item\._kind\]/);
  assert.match(source, /iconRoot\.render\(<Icon className="h-6 w-6" \/>\)/);
  assert.match(source, /new maplibregl\.Marker\(\{ element, anchor: 'bottom', subpixelPositioning: true \}\)/);
  assert.doesNotMatch(source, /maxBounds:\s*ZIMBABWE_MAP_BOUNDS/);
  assert.match(source, /minZoom:\s*0/);
  assert.doesNotMatch(source, /new maplibregl\.Marker\(\{ color:/);
  assert.match(styles, /\.findit-map-marker-pin/);
  assert.match(styles, /background: var\(--marker-color\)/);
  assert.match(styles, /\.findit-map-marker\[data-selected='true'\]/);
});
