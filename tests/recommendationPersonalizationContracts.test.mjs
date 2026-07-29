import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [
  migration,
  rollback,
  preferenceService,
  personalizationSettings,
  listingRecommendations,
  eventService,
  supabaseConfig,
] = await Promise.all([
  read('../supabase/migrations/0071_privacy_preserving_personalization.sql'),
  read('../supabase/rollback/0071_privacy_preserving_personalization.rollback.sql'),
  read('../src/services/recommendationPersonalizationService.js'),
  read('../src/components/settings/PersonalizationSettings.jsx'),
  read('../src/components/listings/ListingRecommendations.jsx'),
  read('../src/services/recommendationEventsService.js'),
  read('../supabase/config.toml'),
]);

test('personalization is explicit, default off, owner scoped, and independently revocable', () => {
  assert.match(migration, /enabled boolean not null default false/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /using \(user_id = auth\.uid\(\)\)/);
  assert.match(migration, /grant select on public\.recommendation_personalization_preferences to authenticated/);
  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete|all)[\s\S]{0,100}recommendation_personalization_preferences[\s\S]{0,40}to authenticated/i,
  );
  assert.match(migration, /grant execute on function public\.set_my_recommendation_personalization_v1\(boolean\)[\s\S]{0,60}to authenticated/);
  assert.match(migration, /grant execute on function public\.clear_my_recommendation_personalization_data_v1\(\)[\s\S]{0,60}to authenticated/);
});

test('ranking uses only bounded first-party signals recorded after opt-in', () => {
  assert.match(migration, /personalization_not_enabled/);
  assert.match(migration, /event\.occurred_at >= greatest\(/);
  assert.match(migration, /preference_row\.enabled_at/);
  assert.match(migration, /now\(\) - interval '90 days'/);

  const signalBlock = migration.match(/and event\.event_type in \(([\s\S]*?)\)\s+group by/)?.[1] ?? '';
  for (const eventType of ['view', 'save', 'tour_watch', 'chat_start', 'recommendation_click']) {
    assert.match(signalBlock, new RegExp(`'${eventType}'`));
  }
  for (const excludedType of ['search', 'seller_follow', 'recommendation_impression']) {
    assert.doesNotMatch(signalBlock, new RegExp(`'${excludedType}'`));
  }
  assert.doesNotMatch(signalBlock, /\bmessage\b|\bcontact\b/i);
});

test('owner clear deletes only account-linked recommendation history and disables ranking', () => {
  assert.match(migration, /delete from public\.recommendation_events event\s+where event\.actor_id = viewer_id/);
  assert.match(migration, /on conflict \(user_id\) do update set\s+enabled = false/);
  assert.doesNotMatch(
    migration,
    /delete from public\.(?:listings|saved_listings|messages|conversations)/i,
  );
});

test('browser privacy controls expose consent, retry, and destructive confirmation states', () => {
  assert.match(preferenceService, /get_my_recommendation_personalization_v1/);
  assert.match(preferenceService, /set_my_recommendation_personalization_v1/);
  assert.match(preferenceService, /clear_my_recommendation_personalization_data_v1/);
  assert.match(personalizationSettings, /<Switch/);
  assert.match(personalizationSettings, /off by default/i);
  assert.match(personalizationSettings, /<AlertDialog/);
  assert.match(personalizationSettings, /Try again/);
  assert.match(personalizationSettings, /does not delete listings, saved items, or messages/i);
});

test('personalized listing sections remain optional and fail independently', () => {
  assert.match(listingRecommendations, /personalization\.data\?\.enabled === true/);
  assert.match(listingRecommendations, /personalization_not_enabled/);
  assert.match(listingRecommendations, /service_disabled/);
  assert.match(listingRecommendations, /slice\(0, MAX_SECTIONS\)/);
  assert.match(listingRecommendations, /Promise\.allSettled/);
  assert.match(listingRecommendations, /transport_unavailable/);
});

test('event timeouts abort PostgREST work instead of only abandoning the response', () => {
  assert.match(eventService, /new AbortController\(\)/);
  assert.match(eventService, /controller\.abort\(\)/);
  assert.match(eventService, /\.abortSignal\(signal\)/);
});

test('Auth redirect configuration covers root and nested browser routes', () => {
  assert.match(supabaseConfig, /http:\/\/localhost:5173\/\*\*/);
  assert.match(supabaseConfig, /http:\/\/127\.0\.0\.1:5173\/\*\*/);
  assert.match(supabaseConfig, /https:\/\/mmugambiwa14-netizen\.github\.io\/findit-marketplace\/\*\*/);
});

test('personalization rollback is non-destructive and preserves privacy enforcement', () => {
  assert.doesNotMatch(rollback, /\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.match(rollback, /force row level security/i);
  assert.match(rollback, /revoke/i);
  assert.match(rollback, /enabled = false/i);
});
