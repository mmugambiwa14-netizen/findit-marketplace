import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const supabaseUrl = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(supabaseUrl, 'The owner-listing smoke test');
if (!anonKey || !secretKey) {
  throw new Error('FINDIT_SUPABASE_ANON_KEY and FINDIT_SUPABASE_SECRET_KEY are required.');
}

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};
const adminClient = createClient(supabaseUrl, secretKey, clientOptions);
const ownerClient = createClient(supabaseUrl, anonKey, clientOptions);
const timestamp = Date.now();
const email = `findit-owner-smoke-${timestamp}@example.test`;
const password = `FindIt!Owner${timestamp}`;
let userId;
let listingId;

function assertSuccess(result, operation) {
  assert.equal(result.error, null, `${operation} failed: ${result.error?.message}`);
  return result.data;
}

try {
  const created = assertSuccess(
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { phone: '+263771234567' },
    }),
    'local owner creation',
  );
  userId = created.user?.id;
  assert.ok(userId, 'Local owner creation returned no user ID');

  const signedIn = assertSuccess(
    await ownerClient.auth.signInWithPassword({ email, password }),
    'local owner login',
  );
  assert.equal(signedIn.user?.id, userId, 'Owner login returned the wrong identity');

  const inserted = assertSuccess(
    await adminClient
      .from('listings')
      .insert({
        kind: 'property',
        seller_id: userId,
        seller_name: 'Owner Smoke',
        contact_email: email,
        title: 'Owner smoke published listing',
        description: 'Disposable local owner-listing fixture',
        price: 125000,
        currency: 'USD',
        status: 'available',
        photos: [],
      })
      .select('id')
      .single(),
    'trusted owner listing fixture',
  );
  listingId = inserted.id;

  assertSuccess(
    await adminClient.from('property_details').insert({
      listing_id: listingId,
      property_type: 'house',
      bedrooms: 3,
      bathrooms: 2,
    }),
    'trusted owner property detail fixture',
  );

  const ownerRead = assertSuccess(
    await ownerClient
      .from('listings')
      .select('id,kind,seller_id,title,status,price,property_details(property_type,bedrooms,bathrooms)')
      .eq('seller_id', userId)
      .eq('id', listingId)
      .single(),
    'owner listing read',
  );
  assert.equal(ownerRead.status, 'available', 'Owner listing read returned the wrong status');
  const propertyDetail = Array.isArray(ownerRead.property_details)
    ? ownerRead.property_details[0]
    : ownerRead.property_details;
  assert.equal(propertyDetail?.bedrooms, 3, 'Owner detail join returned the wrong data');

  const saved = assertSuccess(
    await ownerClient
      .from('saved_listings')
      .insert({ user_id: userId, listing_id: listingId })
      .select('id,listing_id,created_at')
      .single(),
    'save Favourite listing',
  );
  const favouriteRows = assertSuccess(
    await ownerClient
      .from('saved_listings')
      .select('listing_id,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    'load Favourite rows',
  );
  assert.deepEqual(favouriteRows.map((row) => row.listing_id), [listingId]);
  const favouriteListing = assertSuccess(
    await ownerClient
      .from('listings')
      .select('id,kind,status,property_details(property_type)')
      .in('id', favouriteRows.map((row) => row.listing_id))
      .eq('status', 'available')
      .single(),
    'load Favourite listing detail',
  );
  assert.equal(favouriteListing.id, listingId);
  assertSuccess(
    await ownerClient.from('saved_listings').delete().eq('id', saved.id),
    'remove Favourite listing',
  );

  const updated = assertSuccess(
    await ownerClient
      .from('listings')
      .update({ title: 'Owner smoke revised', price: 130000 })
      .eq('seller_id', userId)
      .eq('kind', 'property')
      .eq('id', listingId)
      .select('id,title,price,status')
      .single(),
    'owner listing content update',
  );
  assert.equal(updated.title, 'Owner smoke revised');
  assert.equal(Number(updated.price), 130000);
  assert.equal(updated.status, 'pending_review', 'Editing a live listing must return it to moderation');

  const publishBypass = await ownerClient
    .from('listings')
    .update({ status: 'available' })
    .eq('id', listingId);
  assert.ok(publishBypass.error, 'An owner must not publish by directly changing status');

  const deleted = assertSuccess(
    await ownerClient
      .from('listings')
      .delete()
      .eq('seller_id', userId)
      .eq('kind', 'property')
      .eq('id', listingId)
      .select('id')
      .single(),
    'owner listing delete',
  );
  assert.equal(deleted.id, listingId);
  listingId = undefined;

  const detailAfterDelete = await ownerClient
    .from('property_details')
    .select('listing_id', { count: 'exact', head: true })
    .eq('listing_id', deleted.id);
  assert.equal(detailAfterDelete.error, null, `detail cascade check failed: ${detailAfterDelete.error?.message}`);
  assert.equal(detailAfterDelete.count, 0, 'Deleting a listing did not cascade to its detail row');

  console.log(`Phase 3 ${smokeTarget.label} owner-listing smoke: PASS`);
  console.log('Verified owner read, Favourite list/remove, detail join, re-review after edit, publish-bypass denial, delete, and detail cascade.');
} finally {
  if (listingId) {
    await adminClient.from('listings').delete().eq('id', listingId);
  }
  await ownerClient.auth.signOut();
  if (userId) {
    await adminClient.auth.admin.deleteUser(userId);
  }
}
