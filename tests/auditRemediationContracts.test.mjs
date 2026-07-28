import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('public listing reads expose locality coordinates and not legacy exact columns', () => {
  const migration = read('supabase/migrations/0049_listing_location_privacy_and_public_projection.sql');
  const repository = read('src/repositories/publicListingsRepository.js');
  const grant = migration.slice(
    migration.indexOf('grant select ('),
    migration.indexOf(') on table public.listings to anon, authenticated;') + 1,
  );

  assert.match(migration, /insert into public\.listing_private_locations/i);
  assert.match(migration, /resolve_listing_public_location/i);
  assert.match(migration, /sync_listing_private_location/i);
  assert.match(migration, /provider_name is null or promoted_at is not null/i);
  assert.match(migration, /content_suspended_at is null/i);
  assert.doesNotMatch(migration, /grant select on table public\.listings to anon/i);
  assert.match(grant, /public_latitude/i);
  assert.match(grant, /public_longitude/i);
  assert.doesNotMatch(grant, /^\s*latitude\s*,?$/im);
  assert.doesNotMatch(grant, /^\s*longitude\s*,?$/im);
  assert.doesNotMatch(grant, /submission_key|moderation_reason|content_suspension_reason/i);
  assert.match(repository, /latitude:public_latitude/);
  assert.match(repository, /longitude:public_longitude/);
  assert.doesNotMatch(repository, /^\s*latitude,\s*$/m);
  assert.doesNotMatch(repository, /^\s*longitude,\s*$/m);
});

test('owner moderation notes use a bounded owner-only RPC', () => {
  const migration = read('supabase/migrations/0049_listing_location_privacy_and_public_projection.sql');
  const repository = read('src/repositories/ownerListingsRepository.js');

  assert.match(migration, /owner_listing_notes\(p_listing_ids uuid\[\]\)/i);
  assert.match(migration, /cardinality\(p_listing_ids\) not between 1 and 50/i);
  assert.match(migration, /listing\.seller_id = auth\.uid\(\)/i);
  assert.match(migration, /grant execute on function public\.owner_listing_notes\(uuid\[\]\) to authenticated/i);
  assert.doesNotMatch(migration, /grant execute on function public\.owner_listing_notes\(uuid\[\]\) to anon/i);
  assert.match(repository, /supabase\.rpc\('owner_listing_notes'/);
});

test('listing image hydration signs one unique path batch per page', () => {
  const service = read('src/services/listingCreationService.js');
  const hydration = service.slice(service.indexOf('export async function hydrateListingImages'));

  assert.match(hydration, /listings\.flatMap/);
  assert.match(hydration, /\[\.\.\.new Set\(/);
  assert.equal(
    [...hydration.matchAll(/signListingImagePaths\(/g)].length,
    1,
    'hydrateListingImages must make one signing call for the complete page',
  );
  assert.doesNotMatch(hydration, /Promise\.all\(\(rows[\s\S]*resolveListingImages/);
});

test('local preview media cannot enter a production build', () => {
  const viteConfig = read('vite.config.js');

  assert.equal(existsSync(resolve(root, 'public/mock')), false);
  assert.equal(existsSync(resolve(root, 'preview-assets/mock/findit-tour-preview.mp4')), true);
  assert.match(viteConfig, /command === 'serve' \|\| mode === 'preview'/);
  assert.match(viteConfig, /: false/);
});

test('every JSX image declares loading and asynchronous decoding behavior', () => {
  const sourceRoot = resolve(root, 'src');
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (['.js', '.jsx'].includes(extname(entry.name))) files.push(path);
    }
  };
  walk(sourceRoot);

  const missing = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
    const visit = (node) => {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'img') {
        const names = new Set(node.attributes.properties
          .filter(ts.isJsxAttribute)
          .map((attribute) => attribute.name.getText(source)));
        if (!names.has('loading') || !names.has('decoding')) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          missing.push(`${relative(root, file)}:${line}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  assert.deepEqual(missing, []);
});
