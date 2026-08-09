import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePublicServiceRequest,
  normalizeServiceCreate,
  normalizeServiceEdit,
  normalizeServiceStatus,
} from '../src/services/serviceContracts.js';
import {
  isTrustedMarketplaceImagePath,
  normalizeMarketplaceImageAttachment,
  normalizeMarketplaceImageDetachment,
  normalizeMarketplaceImageFile,
  normalizeServiceMediaReplacement,
} from '../src/services/marketplaceImageContracts.js';

const provider = { id: '00000000-0000-4000-8000-000000000001', full_name: 'Tariro' };
const mechanicTaxonomy = {
  allowedCategories: new Set(['mechanic']),
  allowedSubcategories: new Set(['pre_purchase_inspection', 'maintenance_repair']),
};

test('normalizes a bounded service create contract against the supplied canonical taxonomy', () => {
  const result = normalizeServiceCreate({
    title: ' Mobile vehicle inspection ',
    description: ' Careful pre-purchase checks ',
    category: 'mechanic',
    subcategories: ['pre_purchase_inspection', 'pre_purchase_inspection'],
    pricing_type: 'starting_from',
    price: '40',
    contact_phone: '+263771234567',
    contact_whatsapp: '',
    contact_email: 'TARIRO@EXAMPLE.TEST',
    currency: 'ZWL',
    location_name: 'Harare',
    can_travel: true,
  }, provider, mechanicTaxonomy);

  assert.equal(result.title, 'Mobile vehicle inspection');
  assert.equal(result.price, 40);
  assert.equal(result.currency, 'ZWL');
  assert.equal(result.contact_email, 'tariro@example.test');
  assert.deepEqual(result.subcategories, ['pre_purchase_inspection']);
  assert.deepEqual(result.photos, []);
  assert.equal(result.status, 'active');
});

test('service creation cannot invent category or specialization vocabulary locally', () => {
  assert.throws(() => normalizeServiceCreate({
    title: 'Legal advice', category: 'legal', subcategories: ['consultation'],
    pricing_type: 'quote', contact_phone: '+263771234567',
  }, provider, mechanicTaxonomy), /category is not active in the current taxonomy/);

  assert.throws(() => normalizeServiceCreate({
    title: 'Vehicle help', category: 'mechanic', subcategories: ['invented_service'],
    pricing_type: 'quote', contact_phone: '+263771234567',
  }, provider, mechanicTaxonomy), /Service type is not active in the current taxonomy/);

  assert.throws(() => normalizeServiceCreate({
    title: 'Vehicle help', category: 'mechanic', subcategories: ['pre_purchase_inspection'],
    pricing_type: 'quote', contact_phone: '+263771234567',
  }, provider), /taxonomy is unavailable/);
});

test('service edit rejects privileged fields and requires a contact path', () => {
  assert.throws(() => normalizeServiceEdit({
    title: 'Updated service', description: '', pricing_type: 'fixed', price: 10,
    contact_phone: '', contact_whatsapp: '', contact_email: '', verified: true,
  }), /not editable/);
  assert.throws(() => normalizeServiceEdit({
    title: 'Updated service', description: '', pricing_type: 'fixed', price: 10,
    contact_phone: '', contact_whatsapp: '', contact_email: '',
  }), /Phone or WhatsApp is required/);
});

test('normalizes public service search only against a supplied canonical category set', () => {
  const locationId = '22222222-2222-4222-8222-222222222222';
  assert.deepEqual(
    normalizePublicServiceRequest(
      { query: ' mechanic,(Harare)%_ ', category: 'mechanic', locationId, limit: 500 },
      { allowedCategories: new Set(['mechanic']) },
    ),
    { query: 'mechanic Harare', category: 'mechanic', locationId, limit: 48, cursor: null },
  );
  assert.deepEqual(normalizePublicServiceRequest({
    category: 'all',
    cursor: { createdAt: '2026-07-27T01:02:03.000Z', id: '11111111-1111-4111-8111-111111111111' },
  }).cursor, {
    createdAt: '2026-07-27T01:02:03.000Z',
    id: '11111111-1111-4111-8111-111111111111',
  });
  assert.throws(
    () => normalizePublicServiceRequest({ category: 'legal' }, { allowedCategories: new Set(['mechanic']) }),
    /not active in the current taxonomy/,
  );
  assert.throws(() => normalizePublicServiceRequest({ category: 'bad category!' }, { allowedCategories: new Set() }), /category is invalid/);
  assert.throws(() => normalizePublicServiceRequest({ locationId: 'not-a-location' }), /Location is invalid/);
  assert.equal(normalizeServiceStatus('paused'), 'paused');
  assert.throws(() => normalizeServiceStatus('deleted'), /status is invalid/);
});

test('trusted marketplace image paths are owner scoped and purpose specific', () => {
  const servicePath = `${provider.id}/service_photo/staging/10000000-0000-4000-8000-000000000001.webp`;
  assert.equal(isTrustedMarketplaceImagePath(servicePath, 'service_photo'), true);
  assert.equal(isTrustedMarketplaceImagePath(servicePath, 'business_logo'), false);
  assert.equal(isTrustedMarketplaceImagePath('https://example.test/photo.webp', 'service_photo'), false);
  const sellerPath = `${provider.id}/seller_logo/staging/10000000-0000-4000-8000-000000000001.webp`;
  assert.equal(isTrustedMarketplaceImagePath(sellerPath, 'seller_logo'), true);
  assert.equal(isTrustedMarketplaceImagePath(sellerPath, 'business_logo'), false);
});

test('seller logo detachment remains owner-scoped and purpose-specific', () => {
  const path = `${provider.id}/seller_logo/staging/10000000-0000-4000-8000-000000000001.png`;
  assert.deepEqual(normalizeMarketplaceImageDetachment('seller', provider.id, path), {
    targetKind: 'seller',
    targetId: provider.id,
    path,
  });
  assert.throws(
    () => normalizeMarketplaceImageDetachment('seller', provider.id, `${provider.id}/business_logo/staging/10000000-0000-4000-8000-000000000001.png`),
    /invalid/,
  );
});

test('marketplace image attachments bind purpose, target, and bounded order', () => {
  const path = `${provider.id}/service_photo/staging/10000000-0000-4000-8000-000000000001.png`;
  assert.deepEqual(normalizeMarketplaceImageAttachment({
    intentId: '20000000-0000-4000-8000-000000000001',
    purpose: 'service_photo',
    path,
    targetKind: 'service',
    targetId: '30000000-0000-4000-8000-000000000001',
    displayOrder: 5,
  }), {
    intentId: '20000000-0000-4000-8000-000000000001',
    path,
    targetKind: 'service',
    targetId: '30000000-0000-4000-8000-000000000001',
    displayOrder: 5,
  });
  assert.throws(() => normalizeMarketplaceImageAttachment({
    intentId: provider.id,
    purpose: 'business_logo',
    path: `${provider.id}/business_logo/staging/10000000-0000-4000-8000-000000000001.png`,
    targetKind: 'service',
    targetId: provider.id,
  }), /does not match/);
});

test('marketplace image files reject unsupported content declarations and size', () => {
  assert.throws(() => normalizeMarketplaceImageFile(new File(['text'], 'note.txt', { type: 'text/plain' })), /JPG, PNG, or WebP/);
  assert.throws(() => normalizeMarketplaceImageFile(new File([], 'empty.png', { type: 'image/png' })), /5 MB or smaller/);
});

test('service media replacement preserves trusted attachments and validates staged uploads', () => {
  const first = `${provider.id}/service_photo/staging/10000000-0000-4000-8000-000000000001.png`;
  const second = `${provider.id}/service_photo/staging/10000000-0000-4000-8000-000000000002.webp`;
  assert.deepEqual(normalizeServiceMediaReplacement(
    '30000000-0000-4000-8000-000000000001',
    [first],
    [{ intentId: '20000000-0000-4000-8000-000000000001', path: second }],
  ), {
    targetId: '30000000-0000-4000-8000-000000000001',
    keepPaths: [first],
    newMedia: [{ intentId: '20000000-0000-4000-8000-000000000001', path: second }],
  });
  assert.throws(() => normalizeServiceMediaReplacement(provider.id, [first, first], []), /unique/);
  assert.throws(() => normalizeServiceMediaReplacement(provider.id, [], Array.from({ length: 7 }, (_, index) => ({
    intentId: `20000000-0000-4000-8000-00000000000${index + 1}`,
    path: `${provider.id}/service_photo/staging/10000000-0000-4000-8000-00000000000${index + 1}.png`,
  }))), /up to 6/);
});
