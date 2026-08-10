import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { projectMomentum, rubberBand, shouldDismissDrag } from '../src/lib/motionTokens.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('motion projection and drag thresholds remain bounded and directional', () => {
  assert.ok(projectMomentum(1200) > 0);
  assert.ok(projectMomentum(-1200) < 0);
  assert.equal(projectMomentum(0), 0);
  assert.ok(Math.abs(rubberBand(180, 800)) < 180);
  assert.equal(shouldDismissDrag({ distance: 230, velocity: 0, size: 700 }), true);
  assert.equal(shouldDismissDrag({ distance: 30, velocity: 1000, size: 700 }), true);
  assert.equal(shouldDismissDrag({ distance: 30, velocity: 100, size: 700 }), false);
});

test('Pressable owns immediate pointer and keyboard feedback instead of page-specific handlers', async () => {
  const source = await read('src/components/ui/pressable.jsx');
  assert.match(source, /MOVE_CANCEL_THRESHOLD = 10/);
  assert.match(source, /onPointerDown=\{handlePointerDown\}/);
  assert.match(source, /onPointerMove=\{handlePointerMove\}/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(source, /data-pressed=\{pressed \? 'true' : 'false'\}/);
  assert.match(source, /asChild \? Slot : 'button'/);
  assert.match(source, /prefersReducedMotion\(\)/);
  assert.match(source, /transform: 'scale\(0\.98\)'/);
});

test('shared Button routes through Pressable so all application buttons inherit touch-down feedback', async () => {
  const source = await read('src/components/ui/button.jsx');
  assert.match(source, /import \{ Pressable \}/);
  assert.match(source, /<Pressable/);
  assert.match(source, /asChild=\{asChild\}/);
  assert.doesNotMatch(source, /active:translate-y-px/);
});

test('bottom sheets support direct manipulation velocity dismissal and reduced motion', async () => {
  const source = await read('src/components/ui/sheet.jsx');
  assert.match(source, /fluid-sheet-handle-region/);
  assert.match(source, /setPointerCapture/);
  assert.match(source, /rubberBand\(/);
  assert.match(source, /shouldDismissDrag/);
  assert.match(source, /settleElement/);
  assert.match(source, /prefersReducedMotion/);
  assert.match(source, /translate3d\(0, 105%, 0\)/);
});

test('fluid material layer includes component-owned reduced motion and CSS transparency/contrast equivalents', async () => {
  const [css, segmented, tabs] = await Promise.all([
    read('src/fluid-ui.css'),
    read('src/components/ui/segmented-control.jsx'),
    read('src/components/ui/animated-tabs.jsx'),
  ]);
  assert.match(segmented, /fluid-segmented-indicator/);
  assert.match(segmented, /prefersReducedMotion\(\)/);
  assert.match(tabs, /fluid-tabs-indicator/);
  assert.match(tabs, /prefersReducedMotion\(\)/);
  assert.match(css, /prefers-reduced-transparency: reduce/);
  assert.match(css, /prefers-contrast: more/);
  assert.match(css, /\.surface-panel,[\s\S]*\.clay-card[\s\S]*background-image: none/);
});

test('canonical bootstrap loads fluid styles and no longer ships the temporary staging submit tracer', async () => {
  const source = await read('src/main.jsx');
  assert.match(source, /import '@\/fluid-ui\.css'/);
  assert.doesNotMatch(source, /staging-submit-trace/);
  assert.doesNotMatch(source, /peekalisting:submission-diagnostic/);
});

test('foundation primitives are exercised by Discover listing sections and mobile navigation', async () => {
  const home = await read('src/pages/Home.jsx');
  const tabs = await read('src/components/listings/ListingDetailTabs.jsx');
  const nav = await read('src/components/layout/BottomNav.jsx');
  assert.match(home, /SegmentedControl/);
  assert.match(home, /DISCOVER_VIEWS/);
  assert.match(tabs, /AnimatedTabs/);
  assert.match(tabs, /semantics="navigation"/);
  assert.match(nav, /Pressable/);
  assert.match(nav, /asChild/);
});
