import { readFile, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { hasDestructiveRollbackStatements } from './lib/sqlRollbackBoundary.mjs';

const root = process.cwd();
const migrationsDirectory = resolve(root, 'supabase/migrations');
const rollbackDirectory = resolve(root, 'supabase/rollback');
const failures = [];

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();

if (!migrationFiles.length) failures.push('no numbered migrations found');

const numbers = migrationFiles.map((name) => Number(name.slice(0, 4)));
for (let index = 0; index < numbers.length; index += 1) {
  const expected = index + 1;
  if (numbers[index] !== expected) failures.push(`migration sequence expected ${String(expected).padStart(4, '0')} but found ${migrationFiles[index]}`);
}

const rollbackFiles = new Set((await readdir(rollbackDirectory)).filter((name) => name.endsWith('.rollback.sql')));
for (const migration of migrationFiles.filter((name) => Number(name.slice(0, 4)) >= 30)) {
  const expectedRollback = migration.replace(/\.sql$/, '.rollback.sql');
  if (!rollbackFiles.has(expectedRollback)) failures.push(`missing rollback pair for ${migration}`);
}

// The destructive-statement rules live in ./lib/sqlRollbackBoundary.mjs so they
// can be exercised directly by tests/sqlRollbackBoundary.test.mjs. This gate is
// the step whose failure skipped twelve later verification steps (F-013), so its
// behaviour is pinned by tests rather than inferred from a green run.

function dollarQuoteBalance(content) {
  const counts = new Map();
  for (const match of content.matchAll(/\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/g)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count % 2 !== 0);
}

function inspectSqlText(name, content) {
  if (content.includes('\0')) failures.push(`${name} contains a null byte that PostgreSQL cannot receive`);
  if (/^(?:<<<<<<<|=======|>>>>>>>)(?:\s|$)/m.test(content)) failures.push(`${name} contains a merge-conflict marker`);
  for (const [tag, count] of dollarQuoteBalance(content)) failures.push(`${name} has unbalanced ${tag} delimiters (${count})`);
}

for (const name of migrationFiles) {
  const content = await readFile(join(migrationsDirectory, name), 'utf8');
  inspectSqlText(name, content);
}

async function readPairedMigration(rollbackName) {
  try {
    return await readFile(
      join(migrationsDirectory, rollbackName.replace(/\.rollback\.sql$/, '.sql')),
      'utf8',
    );
  } catch {
    // No pair means no exemption. Fail closed.
    return null;
  }
}

for (const name of [...rollbackFiles].filter((file) => Number(file.slice(0, 4)) >= 40).sort()) {
  const content = await readFile(join(rollbackDirectory, name), 'utf8');
  if (hasDestructiveRollbackStatements(content, await readPairedMigration(name))) {
    failures.push(`${name} contains destructive table/data rollback statements`);
  }
  inspectSqlText(name, content);
}

// Previous reviewed release tips:
// - 0089_private_country_helper_implementations.sql
// - 0090_seller_profile_identifier_privacy.sql
// - 0091_private_public_tour_summaries_implementation.sql
// - 0092_zimbabwe_province_hierarchy.sql
// - 0093_private_marketplace_view_implementation.sql
// - 0094_private_recommended_service_event_implementation.sql
// - 0095_private_support_request_implementation.sql
// - 0096_private_recommendation_event_implementation.sql
// - 0097_private_public_listing_search_implementation.sql
// - 0098_private_notification_read_implementations.sql
// - 0099_private_personalization_preference_implementations.sql
// - 0100_release_control_consistency.sql
// - 0101_private_authenticated_rpc_implementations.sql
// - 0102_sub_saharan_location_registry.sql
// - 0103_canonical_sub_saharan_admin1_hierarchy.sql
// - 0104_consented_location_resolver_hardening.sql
// - 0105_consented_location_resolver_least_privilege.sql
// - 0106_active_country_boundary_spatial_index.sql
// - 0107_location_registry_free_tier_index_budget.sql
// - 0108_location_registry_parent_index_deduplication.sql
// - 0109_seller_contact_reveal_boundary.sql
// - 0110_revoke_rls_bypassing_grants.sql
// - 0111_services_contact_column_allowlist.sql
// - 0112_business_profile_url_scheme_constraint.sql
// - 0113_listing_text_and_price_bounds.sql
// - 0114_listing_category_attributes.sql
// - 0115_owner_contact_access_boundary.sql
// - 0116_peek_threads_foundation.sql
// - 0117_peek_request_read_boundary.sql
// - 0118_response_peeks_and_request_bindings.sql
// - 0119_peek_request_read_boundary_pagination.sql
// - 0120_admin_peek_request_moderation.sql
// - 0121_response_peek_lifecycle.sql
// - 0122_response_peek_upload_authorization.sql
// - 0123_response_peek_binding_and_notifications.sql
// Release-tip anchor: bump this deliberately when a migration is added.
const RELEASE_TIP_MIGRATION = '0124_live_conversation_updates.sql';
if (basename(migrationFiles.at(-1) ?? '') !== RELEASE_TIP_MIGRATION) {
  failures.push(
    `latest expected migration is ${RELEASE_TIP_MIGRATION}, found ${migrationFiles.at(-1) ?? 'none'}`,
  );
}

if (failures.length) {
  console.error('SQL boundary verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`SQL boundary verification passed: ${migrationFiles.length} contiguous migrations and ${rollbackFiles.size} rollback capsules inspected.`);
