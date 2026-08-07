import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Manifest contract (PWA §1).
 *
 * The failure this guards against is silent: a manifest that parses but points
 * at an icon that is not in the build still serves fine, and the only symptom
 * is that the install prompt never appears. Every referenced file is therefore
 * resolved on disk rather than trusted.
 */

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = join(projectRoot, 'public');
const manifest = JSON.parse(
  readFileSync(join(publicRoot, 'manifest.webmanifest'), 'utf8'),
);

const resolveAsset = (url) => join(publicRoot, url.replace(/^\//, ''));

test('manifest declares the fields browsers require for installability', () => {
  assert.equal(manifest.name, 'FindIt Marketplace');
  assert.equal(manifest.short_name, 'FindIt');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.ok(manifest.description);
  assert.ok(manifest.id, 'a stable id keeps app identity across start_url changes');
});

test('theme and background colours match the app shell', () => {
  // Must equal the <meta name="theme-color"> in index.html, or the splash
  // screen flashes a different colour than the app it launches into.
  assert.equal(manifest.theme_color, '#050914');
  assert.equal(manifest.background_color, '#050914');

  const html = readFileSync(join(projectRoot, 'index.html'), 'utf8');
  assert.ok(
    html.includes('<meta name="theme-color" content="#050914" />'),
    'index.html theme-color must match the manifest',
  );
});

test('every icon file referenced by the manifest exists', () => {
  assert.ok(manifest.icons.length >= 2);
  for (const icon of manifest.icons) {
    assert.ok(existsSync(resolveAsset(icon.src)), `missing icon: ${icon.src}`);
    assert.match(icon.sizes, /^\d+x\d+$/);
    assert.equal(icon.type, 'image/png');
  }
});

test('a 192 and a 512 icon are present, which Chrome requires to install', () => {
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes('192x192'));
  assert.ok(sizes.includes('512x512'));
});

test('a maskable icon is declared and is a distinct file from the plain one', () => {
  const maskable = manifest.icons.filter((icon) => icon.purpose === 'maskable');
  assert.equal(maskable.length, 1, 'exactly one maskable icon');

  const plain = manifest.icons.filter((icon) => icon.purpose === 'any').map((i) => i.src);
  assert.ok(
    !plain.includes(maskable[0].src),
    'a maskable icon needs safe-zone padding, so reusing the plain icon would '
    + 'let Android crop the mark',
  );
});

test('index.html declares an apple-touch-icon, which iOS requires to install', () => {
  // iOS ignores the manifest when choosing a home-screen icon and needs a PNG
  // apple-touch-icon link instead, so without this "Add to Home Screen" yields a
  // blank or screenshot icon on iPhone and iPad.
  //
  // Moved here from brandLegalEmailFounderContracts.test.mjs during F-049, so that
  // install metadata has a single contract rather than two that disagreed about
  // which brand the icon belongs to. It is expected to FAIL until F-017 (WP-19)
  // ships the PeekaListing raster set -- the requirement is real and unmet.
  const html = readFileSync(join(projectRoot, 'index.html'), 'utf8');
  const link = html.match(/<link[^>]+rel="apple-touch-icon"[^>]*>/);
  assert.ok(link, 'index.html must declare <link rel="apple-touch-icon">');

  const href = link[0].match(/href="([^"]+)"/)?.[1];
  assert.ok(href, 'the apple-touch-icon link must have an href');
  assert.ok(existsSync(resolveAsset(href)), `missing apple-touch-icon asset: ${href}`);
  assert.match(href, /\.png$/, 'iOS does not accept an SVG apple-touch-icon');
});

test('every shortcut resolves to a real route and a real icon', () => {
  const routes = readFileSync(join(projectRoot, 'src', 'App.jsx'), 'utf8');
  assert.ok(manifest.shortcuts.length > 0);

  for (const shortcut of manifest.shortcuts) {
    assert.ok(shortcut.name && shortcut.short_name && shortcut.url);
    assert.ok(
      routes.includes(`path="${shortcut.url}"`),
      `shortcut ${shortcut.url} must correspond to a declared route`,
    );
    for (const icon of shortcut.icons ?? []) {
      assert.ok(existsSync(resolveAsset(icon.src)), `missing shortcut icon: ${icon.src}`);
    }
  }
});

test('the offline fallback and its assets are present and self-contained', () => {
  for (const file of ['offline.html', 'offline.css', 'offline.js', 'sw.js']) {
    assert.ok(existsSync(join(publicRoot, file)), `missing ${file}`);
  }

  const offline = readFileSync(join(publicRoot, 'offline.html'), 'utf8');
  // The app CSP is `script-src 'self'; style-src-elem 'self'`, so an inline
  // <script> body or <style> block on this page would be blocked exactly when
  // the page is needed most.
  assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/.test(offline),
    'offline.html must not use an inline script body');
  assert.ok(!/<style[\s>]/.test(offline), 'offline.html must not use a <style> block');
});
