import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function relativeLuminance(red, green, blue) {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return (0.2126 * channel(red)) + (0.7152 * channel(green)) + (0.0722 * channel(blue));
}

test('the primary CTA colour meets WCAG AA for normal white text', () => {
  const blue = relativeLuminance(0, 106, 245);
  const white = relativeLuminance(255, 255, 255);
  const ratio = (Math.max(blue, white) + 0.05) / (Math.min(blue, white) + 0.05);
  assert.ok(ratio >= 4.5, `expected at least 4.5:1, received ${ratio.toFixed(2)}:1`);
});

test('all live source and public assets use the current product name', async () => {
  const roots = ['src', 'public'];
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(?:js|jsx|html|txt|xml|webmanifest|json)$/.test(entry.name)) files.push(path);
    }
  }
  for (const root of roots) await visit(fileURLToPath(new URL(`../${root}/`, import.meta.url)));
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\bFindIt\b/, `${file} contains the retired product name`);
  }
});

test('owner terminal-state and managed-review migrations preserve private RPC boundaries', async () => {
  const lifecycle = await read('supabase/migrations/20260819100000_owner_listing_terminal_states.sql');
  const managed = await read('supabase/migrations/20260819101000_audit_managed_listing_decisions.sql');
  for (const migration of [lifecycle, managed]) {
    assert.match(migration, /create or replace function private\./i);
    assert.match(migration, /security definer/i);
    assert.match(migration, /create or replace function public\./i);
    assert.match(migration, /security invoker/i);
    assert.match(migration, /set search_path = ''/i);
  }
  assert.match(lifecycle, /'sold'/);
  assert.match(lifecycle, /'rented'/);
  assert.match(lifecycle, /public\.is_country_publishable\(coalesce\(listing_row\.country_code, 'ZW'\)\)/);
  assert.match(lifecycle, /grant execute on function private\.owner_transition_listing\(uuid, text\) to authenticated, service_role/i);
  assert.match(lifecycle, /findit:0101-authenticated-boundary/);
  assert.match(managed, /record_admin_action/);
  assert.match(managed, /before_row/);
  assert.match(managed, /after_row/);
});

test('unified admin audit projects business and recommendation activity', async () => {
  const migration = await read('supabase/migrations/20260819102000_unified_admin_audit_activity.sql');
  assert.match(migration, /business_review_events/);
  assert.match(migration, /recommendation_configuration_audit/);
  assert.match(migration, /admin_unified_audit_activity_page/);
  assert.match(migration, /md5\('business-review:/);
  assert.match(migration, /md5\('recommendation-configuration:/);
  assert.match(migration, /created_at desc, filtered\.audit_id desc/);
  assert.match(migration, /'business_review'/);
  assert.match(migration, /'recommendation_configuration'/);
});

test('SEO and mobile audit remediations are wired', async () => {
  const middleware = await read('functions/_middleware.js');
  const robots = await read('public/robots.txt');
  const sitemap = await read('public/sitemap.xml');
  const nav = await read('src/index.css');
  const admin = await read('src/components/layout/AdminLayout.jsx');
  const support = await read('src/pages/ContactSupport.jsx');
  assert.match(middleware, /application\/ld\+json/);
  assert.match(middleware, /schema\.org/);
  assert.match(robots, /Sitemap: https:\/\/peekalisting\.com\/sitemap\.xml/);
  assert.match(sitemap, /<urlset/);
  assert.match(nav, /--findit-nav-label-size:\s*0\.5625rem/);
  assert.match(admin, /admin-surface/);
  assert.match(support, /<h1[^>]*>Contact Support<\/h1>/);
});

test('mobile admin records keep critical actions visible without horizontal scrolling', async () => {
  const [helper, users, listings, peeks, support, audit, taxonomy, recommendations] = await Promise.all([
    read('src/components/admin/AdminMobileRecord.jsx'),
    read('src/components/admin/UsersTable.jsx'),
    read('src/pages/admin/AdminListings.jsx'),
    read('src/pages/admin/AdminPeeks.jsx'),
    read('src/pages/admin/AdminSupportRequests.jsx'),
    read('src/pages/admin/AdminAuditLog.jsx'),
    read('src/pages/admin/AdminCategories.jsx'),
    read('src/components/admin/AdminRecommendationAnalytics.jsx'),
  ]);
  assert.match(helper, /md:hidden/);
  assert.match(helper, /<dl/);
  for (const source of [users, listings, peeks, support, audit, taxonomy, recommendations]) {
    assert.match(source, /AdminMobile(?:List|Record)/);
    assert.match(source, /hidden[^"']*md:block|md:block[^"']*hidden/);
  }
  assert.match(listings, /mobile[^}]*\}|mobile\s*\/>/);
  assert.match(peeks, /Approve/);
  assert.match(peeks, /Reject/);
  assert.match(support, /Resolve request/);
});
