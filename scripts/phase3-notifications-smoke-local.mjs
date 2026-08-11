import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { deleteDisposableFounder, signInFounder } from './lib/founder-smoke-fixtures.mjs';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(url, 'The essential-notifications smoke test');
if (!anonKey || !secretKey) {
  throw new Error('A Supabase publishable key and secret key are required.');
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const root = createClient(url, secretKey, options);
const admin = createClient(url, anonKey, options);
const owner = createClient(url, anonKey, options);
const reporter = createClient(url, anonKey, options);
const stranger = createClient(url, anonKey, options);
const stamp = Date.now();
const password = `FindIt!Notifications${stamp}`;
let adminId;
let ownerId;
let reporterId;
let strangerId;
let listingId;
let reportId;
let founder;

function success(result, label) {
  assert.equal(result.error, null, `${label} failed: ${result.error?.message}`);
  return result.data;
}

try {
  const ownerEmail = `findit-notification-owner-${stamp}@example.test`;
  const reporterEmail = `findit-notification-reporter-${stamp}@example.test`;
  const strangerEmail = `findit-notification-stranger-${stamp}@example.test`;
  founder = await signInFounder({ root, browser: admin, smokeTarget, password, label: 'notification smoke' });
  adminId = founder.userId;
  ownerId = success(await root.auth.admin.createUser({ email: ownerEmail, password, email_confirm: true, user_metadata: { full_name: 'Notification Owner' } }), 'create owner').user.id;
  reporterId = success(await root.auth.admin.createUser({ email: reporterEmail, password, email_confirm: true, user_metadata: { full_name: 'Notification Reporter' } }), 'create reporter').user.id;
  strangerId = success(await root.auth.admin.createUser({ email: strangerEmail, password, email_confirm: true, user_metadata: { full_name: 'Notification Stranger' } }), 'create stranger').user.id;
  success(await owner.auth.signInWithPassword({ email: ownerEmail, password }), 'owner sign in');
  success(await reporter.auth.signInWithPassword({ email: reporterEmail, password }), 'reporter sign in');
  success(await stranger.auth.signInWithPassword({ email: strangerEmail, password }), 'stranger sign in');

  listingId = success(await root.from('listings').insert({
    kind: 'car', seller_id: ownerId, seller_name: 'Notification Owner',
    title: 'Notification smoke vehicle', category: 'cars_sale', price: 11000,
    status: 'available',
  }).select('id').single(), 'create listing').id;
  success(await root.from('car_details').insert({ listing_id: listingId, brand: 'Toyota', model: 'RAV4' }), 'create detail');

  const forged = await owner.from('app_alerts').insert({
    user_id: ownerId, title: 'Forged', message: 'Forged', type: 'system',
    event_type: 'account_status', source_key: 'forged-client-event',
  });
  assert.ok(forged.error, 'ordinary clients must not create notifications');

  const reviewEvents = success(await owner.rpc('notification_rows', {
    p_event_type: 'all', p_unread_only: false, p_limit: 50, p_offset: 0,
  }), 'verify automatic publication notification boundary');
  assert.equal(
    reviewEvents.some((row) => ['listing_approved', 'listing_rejected'].includes(row.event_type)),
    false,
    'automatic curated publication must not claim that a human approved or rejected the listing',
  );
  success(await owner.rpc('owner_transition_listing', {
    p_listing_id: listingId,
    p_action: 'unavailable',
  }), 'owner makes listing unavailable');
  success(await root.from('listings').update({ status: 'available' }).eq('id', listingId), 'restore active listing');
  success(await root.from('listings').update({ expires_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), expiry_notice_sent_at: null }).eq('id', listingId), 'make expiry notice due');
  const expiry = success(await root.rpc('process_listing_expiry_notifications', { p_now: new Date().toISOString() }), 'process expiry notice');
  assert.equal(Number(expiry.notices_created), 1);
  const expiryAgain = success(await root.rpc('process_listing_expiry_notifications', { p_now: new Date().toISOString() }), 'repeat expiry notice');
  assert.equal(Number(expiryAgain.notices_created), 0, 'expiry notice must be idempotent');

  reportId = success(await reporter.from('reports').insert({
    listing_id: listingId, listing_type: 'vehicle', listing_title: 'Notification smoke vehicle',
    reason: 'fake', reporter_id: reporterId,
  }).select('id').single(), 'create report').id;
  success(await admin.rpc('admin_review_report', {
    p_report_id: reportId, p_status: 'dismissed',
    p_notes: 'Review completed; the advert is legitimate',
  }), 'resolve report');
  success(await admin.rpc('admin_set_user_status', {
    p_user_id: ownerId, p_status: 'suspended', p_reason: 'Temporary safety review', p_ban_until: null,
  }), 'suspend owner');
  success(await admin.rpc('admin_set_user_status', {
    p_user_id: ownerId, p_status: 'active', p_reason: 'Safety review complete', p_ban_until: null,
  }), 'restore owner');

  const ownerRows = success(await owner.rpc('notification_rows', {
    p_event_type: 'all', p_unread_only: false, p_limit: 50, p_offset: 0,
  }), 'load owner notifications');
  assert.deepEqual(new Set(ownerRows.map((row) => row.event_type)), new Set([
    'listing_status_changed', 'listing_expires_soon', 'account_status',
  ]));
  assert.equal(ownerRows.length, 4);
  assert.equal(ownerRows.every((row) => row.link === null || row.link.startsWith('/')), true);
  const ownerUnread = success(await owner.rpc('notification_unread_count'), 'load unread count');
  assert.equal(Number(ownerUnread), 4);
  success(await owner.rpc('mark_notification_read', { p_notification_id: ownerRows[0].notification_id }), 'mark one read');
  const marked = success(await owner.rpc('mark_all_notifications_read'), 'mark all read');
  assert.equal(Number(marked), 3);
  assert.equal(Number(success(await owner.rpc('notification_unread_count'), 'load cleared count')), 0);

  const reporterRows = success(await reporter.rpc('notification_rows', {
    p_event_type: 'report_resolved', p_unread_only: false, p_limit: 50, p_offset: 0,
  }), 'load reporter notification');
  assert.equal(reporterRows.length, 1);
  const strangerRows = success(await stranger.rpc('notification_rows', {
    p_event_type: 'all', p_unread_only: false, p_limit: 50, p_offset: 0,
  }), 'load stranger notifications');
  assert.equal(strangerRows.length, 0);

  console.log(`Phase 3 ${smokeTarget.label} essential notifications smoke: PASS`);
  console.log('Verified current lifecycle, expiry, report, and account events plus trusted creation, safe links, idempotency, read state, and isolation.');
} finally {
  if (ownerId) await root.from('app_alerts').delete().eq('user_id', ownerId);
  if (reporterId) await root.from('app_alerts').delete().eq('user_id', reporterId);
  if (reportId) await root.from('reports').delete().eq('id', reportId);
  if (listingId) await root.from('listings').delete().eq('id', listingId);
  if (adminId) await root.from('audit_logs').delete().eq('admin_user_id', adminId);
  await admin.auth.signOut();
  await owner.auth.signOut();
  await reporter.auth.signOut();
  await stranger.auth.signOut();
  if (ownerId) await root.auth.admin.deleteUser(ownerId);
  if (reporterId) await root.auth.admin.deleteUser(reporterId);
  if (strangerId) await root.auth.admin.deleteUser(strangerId);
  await deleteDisposableFounder(root, founder);
}
