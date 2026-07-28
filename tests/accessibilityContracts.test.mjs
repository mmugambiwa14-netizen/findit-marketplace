import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [layout, topNavigation, bottomNavigation, bell, notificationCenter] = await Promise.all([
  readFile(new URL('../src/components/layout/AppLayout.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/layout/TopNav.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/layout/BottomNav.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/layout/NotificationBell.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/NotificationCenter.jsx', import.meta.url), 'utf8'),
]);

test('the active application shell exposes navigation landmarks and a keyboard skip link', () => {
  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /id="main-content"/);
  assert.match(topNavigation, /aria-label="Primary navigation"/);
  assert.match(bottomNavigation, /aria-label="Mobile navigation"/);
  assert.match(bottomNavigation, /aria-current=/);
});

test('essential notification state is announced without duplicating decorative content', () => {
  assert.match(bell, /`Notifications, \$\{count\} unread`/);
  assert.match(bell, /aria-hidden="true"/);
  assert.match(notificationCenter, /role="status"/);
  assert.match(notificationCenter, /role="alert"/);
});
