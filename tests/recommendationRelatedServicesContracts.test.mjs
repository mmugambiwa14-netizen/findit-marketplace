import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [
  migration,
  rollback,
  client,
  events,
  listingRecommendations,
  serviceRepository,
  servicesService,
  serviceCard,
] = await Promise.all([
  read('../supabase/migrations/0073_executable_related_services.sql'),
  read('../supabase/rollback/0073_executable_related_services.rollback.sql'),
  read('../src/services/recommendationServices.js'),
  read('../src/services/recommendationEventsService.js'),
  read('../src/components/listings/ListingRecommendations.jsx'),
  read('../src/repositories/servicesRepository.js'),
  read('../src/services/servicesService.js'),
  read('../src/components/services/ServiceCard.jsx'),
]);

test('related services rank the public services marketplace through taxonomy', () => {
  assert.match(migration, /from public\.services service/);
  assert.match(migration, /service\.status = 'active'/);
  assert.match(migration, /service\.category <> 'legal'/);
  assert.match(migration, /provider\.status = 'active'/);
  assert.match(migration, /target_node\.node_type = 'service'/);
  assert.match(migration, /jsonb_array_elements_text/);
  assert.match(migration, /'entityType', 'service'/);
  assert.match(migration, /'serviceId', service_id/);
  assert.doesNotMatch(
    migration.match(/create or replace function public\.related_services_service_v1([\s\S]*?)\n\$\$;/)?.[1] ?? '',
    /candidate\.category_key = 'services'/,
  );
});

test('related service responses are typed, bounded, and hydrated independently', () => {
  assert.match(client, /service === 'related_services_service'/);
  assert.match(client, /value\.entityType !== 'service'/);
  assert.match(client, /serviceId: value\.serviceId/);
  assert.match(serviceRepository, /\.in\('id', ids\)/);
  assert.match(serviceRepository, /\.eq\('status', 'active'\)/);
  assert.match(serviceRepository, /\.neq\('category', 'legal'\)/);
  assert.match(serviceRepository, /\.limit\(24\)/);
  assert.match(serviceRepository, /\.abortSignal\(signal\)/);
  assert.match(servicesService, /uniqueIds = \[\.\.\.new Set\(ids\)\]\.slice\(0, 24\)/);
  assert.match(listingRecommendations, /getPublicServicesByIds/);
  assert.match(listingRecommendations, /Promise\.allSettled/);
  assert.match(listingRecommendations, /<ServiceCard/);
  assert.match(serviceCard, /onOpen=\{onOpen\}/);
});

test('service impression and click delivery remains bounded and aggregate-safe', () => {
  assert.match(migration, /record_recommended_service_event_v1/);
  assert.match(migration, /event_name not in \('recommendation_impression', 'recommendation_click'\)/);
  assert.match(migration, /recommendation_name <> 'related-services-service'/);
  assert.match(migration, /service is not publicly available/);
  assert.match(events, /record_recommended_service_event_v1/);
  assert.match(events, /p_service_id: normalizedServiceItemId/);
  assert.match(events, /\.abortSignal\(signal\)/);
  assert.match(listingRecommendations, /serviceItemId: service\?\.id/);
});

test('rollback disables the policy without deleting marketplace or event data', () => {
  assert.doesNotMatch(rollback, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.match(rollback, /related_services_service/);
  assert.match(rollback, /enabled = false/);
  assert.match(rollback, /revoke all/);
});
