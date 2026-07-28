import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [schema, upload, processing, moderation, cleanup] = await Promise.all([
  read('supabase/migrations/0031_v1_tour_schema.sql'),
  read('supabase/migrations/0032_v1_tour_storage_and_upload.sql'),
  read('supabase/migrations/0033_v1_tour_processing_and_publication.sql'),
  read('supabase/migrations/0034_v1_tour_moderation_and_reports.sql'),
  read('supabase/migrations/0035_v1_tour_cleanup_and_indexes.sql'),
]);

test('Tours have exactly one canonical parent and support atomic replacement', () => {
  assert.match(schema, /listing_tours_exactly_one_parent/);
  assert.match(schema, /listing_tour_slots_exactly_one_parent/);
  assert.match(schema, /current_tour_id uuid/);
  assert.match(schema, /pending_tour_id uuid/);
  assert.match(schema, /current_tour_id <> pending_tour_id/);
  assert.match(moderation, /set current_tour_id = candidate\.id, pending_tour_id = null/);
  assert.match(moderation, /status = 'superseded'/);
});

test('Tour constraints enforce the approved two-minute and 250 MB source boundary', () => {
  for (const source of [schema, upload, processing]) {
    assert.match(source, /120/);
    assert.match(source, /262144000/);
  }
  assert.match(upload, /video\/mp4/);
  assert.match(upload, /video\/quicktime/);
  assert.match(upload, /video\/webm/);
});

test('Tours require both backend feature control and private storage', () => {
  assert.match(schema, /marketplace_feature_controls/);
  assert.match(schema, /'tours',\s*false/);
  assert.match(upload, /'tour-sources',[\s\S]*?false/);
  assert.match(processing, /'tour-playback',[\s\S]*?false/);
  assert.match(processing, /'tour-thumbnails',[\s\S]*?false/);
  assert.doesNotMatch(upload, /create policy[\s\S]*tour-sources[\s\S]*for select to (anon|public)/i);
});

test('browser roles cannot write Tour state directly', () => {
  assert.match(schema, /revoke all on table public\.listing_tours from anon, authenticated/);
  assert.match(schema, /revoke all on table public\.listing_tour_slots from anon, authenticated/);
  assert.match(upload, /revoke all on function public\.authorize_tour_upload[\s\S]*from public, anon, authenticated/);
  assert.match(processing, /claim_tour_processing_jobs[\s\S]*to service_role/);
  assert.match(processing, /finalize_tour_processing[\s\S]*to service_role/);
});

test('reports preserve Tour parent identity and block direct Tour-column inserts', () => {
  assert.match(moderation, /reports_tour_parent_consistency/);
  assert.match(moderation, /tour_id uuid references public\.listing_tours/);
  assert.match(moderation, /service_id uuid references public\.services/);
  assert.match(moderation, /revoke insert on table public\.reports from authenticated/);
  assert.match(moderation, /grant insert \([\s\S]*listing_id[\s\S]*reporter_id[\s\S]*\) on table public\.reports to authenticated/);
  assert.doesNotMatch(moderation.match(/grant insert \([\s\S]*?\) on table public\.reports to authenticated/)?.[0] ?? '', /tour_id|tour_reason|service_id/);
});

test('cleanup survives parent deletion and has bounded claim/finalize leases', () => {
  assert.match(cleanup, /tour_asset_cleanup_queue/);
  assert.match(cleanup, /before delete on public\.listing_tours/);
  assert.match(cleanup, /'parent_deleted'/);
  assert.match(cleanup, /for update skip locked/);
  assert.match(cleanup, /lease_token uuid/);
  assert.match(cleanup, /finalize_tour_cleanup_job/);
  assert.match(cleanup, /sourceRetentionDays/);
});
