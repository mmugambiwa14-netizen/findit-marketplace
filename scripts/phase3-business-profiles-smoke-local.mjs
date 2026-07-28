import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const supabaseUrl = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(supabaseUrl, 'The business-profile smoke test');
if (!anonKey || !secretKey) {
  throw new Error('FINDIT_SUPABASE_ANON_KEY and FINDIT_SUPABASE_SECRET_KEY are required.');
}

const options = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } };
const root = createClient(supabaseUrl, secretKey, options);
const owner = createClient(supabaseUrl, anonKey, options);
const guest = createClient(supabaseUrl, anonKey, options);
const stamp = Date.now();
const email = `findit-business-smoke-${stamp}@example.test`;
const password = `FindIt!Business${stamp}`;
const functionUrl = `${supabaseUrl}/functions/v1/marketplace-image-upload`;
const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const metadataPayload = Buffer.from('FindIt\0GPS=-17.8252,31.0335', 'utf8');
const metadataChunk = Buffer.alloc(12 + metadataPayload.length);
metadataChunk.writeUInt32BE(metadataPayload.length, 0);
metadataChunk.write('tEXt', 4, 4, 'ascii');
metadataPayload.copy(metadataChunk, 8);
const pngWithMetadata = Buffer.concat([onePixelPng.subarray(0, 33), metadataChunk, onePixelPng.subarray(33)]);
let ownerId;
let profileId;
let logoPath;
const listingIds = [];
const serviceIds = [];

function success(result, label) {
  assert.equal(result.error, null, `${label} failed: ${result.error?.message}`);
  return result.data;
}

async function uploadLogo(accessToken) {
  const form = new FormData();
  form.append('purpose', 'business_logo');
  form.append('file', new File([pngWithMetadata], 'business-logo.png', { type: 'image/png' }));
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey, Origin: smokeTarget.origin },
    body: form,
  });
  const body = await response.json();
  assert.equal(response.status, 201, `business logo upload failed: ${JSON.stringify(body)}`);
  assert.equal(body.metadataRemoved, true, 'business logo upload must strip image metadata');
  assert.equal(body.byteSize, onePixelPng.length, 'business logo stored size must describe sanitized bytes');
  logoPath = body.path;
  return body;
}

try {
  ownerId = success(await root.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Business Smoke Owner' },
  }), 'create owner').user.id;
  const login = success(await owner.auth.signInWithPassword({ email, password }), 'owner sign in');

  const profile = success(await owner.from('business_profiles').insert({
    user_id: ownerId,
    company_name: 'FindIt Smoke Motors',
    business_type: 'car_dealership',
    phone: '+263771234567',
    website: 'https://example.co.zw',
    social_links: { instagram: 'https://instagram.com/findit-smoke' },
    city: 'Harare',
  }).select('id,profile_type,verified,verification_status').single(), 'create dealer profile');
  profileId = profile.id;
  assert.equal(profile.profile_type, 'dealer');
  assert.equal(profile.verified, false);
  assert.equal(profile.verification_status, 'none');

  const logo = await uploadLogo(login.session.access_token);
  const hiddenBeforeAttachment = await guest.storage.from('marketplace-images').createSignedUrl(logo.path, 60);
  assert.ok(hiddenBeforeAttachment.error, 'an unattached business logo must not be signable by a guest');
  success(await owner.rpc('attach_marketplace_image', {
    p_intent_id: logo.intentId,
    p_storage_path: logo.path,
    p_target_kind: 'business',
    p_target_id: profileId,
    p_display_order: 0,
  }), 'attach business logo');
  const publicLogo = success(await guest.storage.from('marketplace-images').createSignedUrl(logo.path, 60), 'sign public business logo');
  const downloadedLogo = await fetch(publicLogo.signedUrl);
  assert.equal(downloadedLogo.status, 200, 'signed business logo download failed');
  assert.deepEqual(Buffer.from(await downloadedLogo.arrayBuffer()), onePixelPng);
  const logoBypass = await owner.from('business_profiles').update({ avatar_storage_path: null }).eq('id', profileId);
  assert.ok(logoBypass.error, 'an owner cannot bypass trusted business-logo attachment');

  const duplicate = await owner.from('business_profiles').insert({
    user_id: ownerId,
    company_name: 'Duplicate Profile',
    business_type: 'other',
    phone: '+263771234567',
  });
  assert.ok(duplicate.error, 'one owner cannot create multiple business profiles');

  const legal = await owner.from('business_profiles').update({ business_type: 'legal_firm' }).eq('id', profileId);
  assert.ok(legal.error, 'an owner cannot activate a legal profile in V1');
  const managed = await owner.from('business_profiles').update({ verified: true }).eq('id', profileId);
  assert.ok(managed.error, 'an owner cannot self-verify');

  for (const fixture of [
    { kind: 'car', title: 'Toyota Hilux dealer smoke', category: 'cars_sale', status: 'available' },
    { kind: 'property', title: 'Business office smoke', category: 'houses_sale', status: 'available' },
    { kind: 'car', title: 'Private vehicle draft', category: 'cars_sale', status: 'draft' },
  ]) {
    const row = success(await root.from('listings').insert({
      ...fixture,
      seller_id: ownerId,
      seller_name: 'FindIt Smoke Motors',
      price: 100,
    }).select('id').single(), `create ${fixture.title}`);
    listingIds.push(row.id);
    if (fixture.kind === 'car') success(await root.from('car_details').insert({ listing_id: row.id, brand: 'Toyota', model: 'Hilux' }), 'create car details');
    if (fixture.kind === 'property') success(await root.from('property_details').insert({ listing_id: row.id, property_type: 'commercial' }), 'create property details');
  }

  const service = success(await root.from('services').insert({
    provider_id: ownerId,
    provider_name: 'FindIt Smoke Motors',
    title: 'Vehicle servicing smoke',
    category: 'mechanic',
    status: 'active',
  }).select('id').single(), 'create service');
  serviceIds.push(service.id);

  const publicProfile = success(await guest.from('business_profiles_public')
    .select('id,user_id,profile_type,company_name,social_links,avatar_storage_path')
    .eq('id', profileId)
    .single(), 'guest profile read');
  assert.equal(publicProfile.profile_type, 'dealer');
  assert.equal('verified' in publicProfile, false);
  assert.equal('registration_number' in publicProfile, false);
  assert.equal(publicProfile.avatar_storage_path, logo.path);

  const publicCars = success(await guest.from('listings')
    .select('id,title,kind,status')
    .eq('seller_id', ownerId)
    .eq('kind', 'car')
    .eq('status', 'available')
    .ilike('title', '%Hilux%'), 'dealer inventory search');
  assert.equal(publicCars.length, 1);

  success(await root.from('users').update({ status: 'suspended' }).eq('id', ownerId), 'suspend owner');
  const hiddenProfile = success(await guest.from('business_profiles_public').select('id').eq('id', profileId), 'read suspended profile');
  assert.equal(hiddenProfile.length, 0, 'suspended owner profile must disappear');
  const hiddenLogo = await guest.storage.from('marketplace-images').createSignedUrl(logo.path, 60);
  assert.ok(hiddenLogo.error, 'suspending the owner must hide the private business logo');

  console.log(`Phase 3 ${smokeTarget.label} business/dealer profile smoke: PASS`);
  console.log('Verified one-profile ownership, public projection, dealer inventory search, and suspended-owner hiding.');
} finally {
  for (const id of serviceIds) await root.from('services').delete().eq('id', id);
  for (const id of listingIds) await root.from('listings').delete().eq('id', id);
  if (profileId) await root.from('business_profiles').delete().eq('id', profileId);
  if (logoPath) await root.storage.from('marketplace-images').remove([logoPath]);
  await owner.auth.signOut();
  if (ownerId) await root.auth.admin.deleteUser(ownerId);
}
