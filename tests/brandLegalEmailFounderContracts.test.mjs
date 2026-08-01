import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  app,
  home,
  hero,
  brandLogo,
  topNav,
  bottomNav,
  guestPrompt,
  footer,
  legalContent,
  authLayout,
  adminSidebar,
  adminLayout,
  config,
  founderMigration,
  pageMetadata,
] = await Promise.all([
  read('src/App.jsx'),
  read('src/pages/Home.jsx'),
  read('src/components/home/HeroSection.jsx'),
  read('src/components/BrandLogo.jsx'),
  read('src/components/layout/TopNav.jsx'),
  read('src/components/layout/BottomNav.jsx'),
  read('src/components/auth/GuestPromptSheet.jsx'),
  read('src/components/layout/SiteFooter.jsx'),
  read('src/lib/legalContent.js'),
  read('src/components/AuthLayout.jsx'),
  read('src/components/admin/AdminSidebarCollapsible.jsx'),
  read('src/components/layout/AdminLayout.jsx'),
  read('supabase/config.toml'),
  read('supabase/migrations/0030_v1_founder_admin_lock.sql'),
  read('index.html'),
]);

test('the home experience is international and search-led', () => {
  assert.doesNotMatch(home, /Zimbabwe-focused/i);
  assert.doesNotMatch(pageMetadata, /Zimbabwe/i);
  assert.match(home, /DiscoverSearch/);
  assert.match(home, /DiscoverCategoryGrid/);
  assert.doesNotMatch(home, /getLatestPublicListings|featured|auction/i);
  assert.match(hero, /GoogleAuthButton/);
});

test('desktop top navigation omits the redundant Browse and Services links', () => {
  assert.doesNotMatch(topNav, />Browse</);
  assert.doesNotMatch(topNav, />Services</);
  assert.match(topNav, /\bPost\b/);
});

test('the polished FindIt identity is present across app shells and install metadata', async () => {
  assert.match(brandLogo, /findit-mark\.png/);
  for (const shell of [topNav, footer, authLayout, adminSidebar]) {
    assert.match(shell, /BrandLogo/);
  }

  for (const filename of [
    'findit-mark.png',
    'findit-icon-32.png',
    'findit-icon-64.png',
    'findit-icon-180.png',
    'findit-icon-192.png',
    'findit-icon-512.png',
  ]) {
    const asset = await readFile(new URL(`../src/assets/brand/${filename}`, import.meta.url));
    assert.ok(asset.byteLength > 0);
  }

  assert.match(pageMetadata, /findit-icon-32\.png/);
  assert.match(pageMetadata, /apple-touch-icon/);
});

test('guest prompts are compact, contextual, and include Google plus legal notice', () => {
  assert.match(bottomNav, /setGuestAction/);
  assert.match(bottomNav, /setGuestReturnTo/);
  assert.doesNotMatch(guestPrompt, /Create an account to save favourites and post listings/);
  assert.match(guestPrompt, /GoogleAuthButton/);
  assert.match(guestPrompt, /\/legal\/privacy/);
  assert.match(guestPrompt, /\/legal\/terms/);
});

test('all five legal documents are routed and discoverable across app shells', () => {
  for (const key of ['privacy', 'data-protection', 'terms', 'cookies', 'community-guidelines']) {
    assert.match(legalContent, new RegExp(`['"]?${key.replace('-', '\\-')}['"]?\\s*:`));
    assert.match(footer, new RegExp(`/legal/${key}`));
  }
  assert.match(app, /path="\/legal\/:document"/);
  assert.match(authLayout, /\/legal\/privacy/);
  assert.match(adminLayout, /SiteFooter/);
  assert.match(legalContent, /working policy draft/i);
});

test('every configured Supabase email uses the classic FindIt template family', async () => {
  const templateDirectory = new URL('../supabase/templates/', import.meta.url);
  const filenames = (await readdir(templateDirectory)).filter((name) => name.endsWith('.html')).sort();
  assert.equal(filenames.length, 13);

  for (const filename of filenames) {
    const html = await readFile(new URL(filename, templateDirectory), 'utf8');
    assert.match(html, /FIND<span style="color:#177f76">it<\/span>/);
    assert.match(html, /font-family:Georgia,serif/);
    assert.match(html, /{{ \.SiteURL }}\/(legal\/privacy|help)/);
    assert.doesNotMatch(html, /<script|tracking|pixel/i);
    assert.match(
      config,
      new RegExp(`(?:supabase/)?templates/${filename.replace('.', '\\.')}`),
    );
  }
});

test('founder-only authorization is enforced without committing the founder email', () => {
  assert.doesNotMatch(founderMigration, /mmugambiwa14@gmail\.com/i);
  assert.match(founderMigration, /is_founder_identity/);
  assert.match(founderMigration, /role = 'admin'/);
  assert.match(founderMigration, /super_admin = true/);
  assert.match(founderMigration, /admin role delegation is disabled in founder-operated V1/);
  assert.match(founderMigration, /session_user <> 'postgres'/);
});
