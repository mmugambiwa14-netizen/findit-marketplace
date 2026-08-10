import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('canonical source preserves the newer Zimbabwe-first Discover UI and fluid view control', async () => {
  const source = await read('src/pages/Home.jsx');
  assert.match(source, /LAUNCH_COUNTRY_CODE/);
  assert.match(source, /countryCode !== LAUNCH_COUNTRY_CODE/);
  assert.match(source, /SegmentedControl/);
  assert.match(source, /DISCOVER_VIEWS/);
});

test('listing details remain the newer tab-panel architecture and use fluid shared tabs', async () => {
  const source = await read('src/components/listings/ListingDetailTabs.jsx');
  assert.match(source, /Children/);
  assert.match(source, /useId/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /SearchResultsMap/);
  assert.match(source, /AnimatedTabs/);
  assert.match(source, /semantics="tabs"/);
  assert.doesNotMatch(source, /scrollIntoView/);
});

test('critical submit fixes cannot silently disappear during branch consolidation', async () => {
  const business = await read('src/components/business/BusinessPublishingGate.jsx');
  const peek = await read('src/components/peekThreads/PeekThreadsSection.jsx');
  const writes = await read('src/domain/peekThreads/writeContracts.js');
  assert.match(business, /reportInvalidForm/);
  assert.match(business, /noValidate/);
  assert.match(business, /Submit application/);
  assert.match(peek, /runGuarded/);
  assert.match(peek, /Describe what you want to see in at least 8 characters/);
  assert.match(writes, /parentType === 'listing'/);
  assert.match(writes, /parentType === 'service'/);
});

test('canonical staging is one root-path Cloudflare app sourced only from main', async () => {
  const workflow = await read('.github/workflows/peekalisting-preview.yml');
  const deploy = await read('scripts/deploy-canonical-cloudflare-staging.sh');
  const policy = await read('src/lib/stagingCapabilityPolicy.js');
  assert.match(workflow, /Deploy canonical PeekaListing staging/);
  assert.match(workflow, /branches:\s*\n\s*- main/);
  assert.match(workflow, /staging\.peekalisting\.com/);
  assert.match(workflow, /bwgklpxoetrrkutottdb/);
  assert.match(workflow, /VITE_BASE_PATH: \/$/m);
  assert.match(deploy, /sha=\$\{GITHUB_SHA\}/);
  assert.match(policy, /staging\.peekalisting\.com/);
  assert.doesNotMatch(policy, /vercel/iu);
});

test('temporary diagnostics and browser Supabase fallbacks are absent from canonical client source', async () => {
  const main = await read('src/main.jsx');
  const client = await read('src/lib/supabaseClient.js');
  assert.doesNotMatch(main, /staging-submit-trace/);
  assert.doesNotMatch(main, /submission-diagnostic/);
  assert.doesNotMatch(client, /submission-diagnostic/);
  assert.doesNotMatch(client, /bwgklpxoetrrkutottdb/);
  assert.match(client, /missingVariables/);
});

test('fluid interaction foundation is globally wired without replacing product architecture', async () => {
  const main = await read('src/main.jsx');
  const button = await read('src/components/ui/button.jsx');
  const sheet = await read('src/components/ui/sheet.jsx');
  const nav = await read('src/components/layout/BottomNav.jsx');
  assert.match(main, /fluid-ui\.css/);
  assert.match(button, /Pressable/);
  assert.match(sheet, /shouldDismissDrag/);
  assert.match(sheet, /setPointerCapture/);
  assert.match(nav, /Pressable/);
});
