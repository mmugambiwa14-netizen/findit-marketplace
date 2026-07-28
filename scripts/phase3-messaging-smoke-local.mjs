import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const url = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(url, 'The messaging smoke test');
if (!anonKey || !secretKey) {
  throw new Error('A Supabase publishable key and secret key are required.');
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const root = createClient(url, secretKey, options);
const buyer = createClient(url, anonKey, options);
const seller = createClient(url, anonKey, options);
const stranger = createClient(url, anonKey, options);
const admin = createClient(url, anonKey, options);
const stamp = Date.now();
const password = `FindIt!Messages${stamp}`;
let buyerId;
let sellerId;
let strangerId;
let adminId;
let listingId;
let conversationId;

function success(result, label) {
  assert.equal(result.error, null, `${label} failed: ${result.error?.message}`);
  return result.data;
}

try {
  const buyerEmail = `findit-message-buyer-${stamp}@example.test`;
  const sellerEmail = `findit-message-seller-${stamp}@example.test`;
  const strangerEmail = `findit-message-stranger-${stamp}@example.test`;
  const adminEmail = `findit-message-admin-${stamp}@example.test`;
  buyerId = success(await root.auth.admin.createUser({ email: buyerEmail, password, email_confirm: true, user_metadata: { full_name: 'Message Buyer' } }), 'create buyer').user.id;
  sellerId = success(await root.auth.admin.createUser({ email: sellerEmail, password, email_confirm: true, user_metadata: { full_name: 'Message Seller' } }), 'create seller').user.id;
  strangerId = success(await root.auth.admin.createUser({ email: strangerEmail, password, email_confirm: true, user_metadata: { full_name: 'Message Stranger' } }), 'create stranger').user.id;
  adminId = success(await root.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: 'Message Admin' } }), 'create admin').user.id;
  success(await root.from('users').update({ role: 'admin', super_admin: true }).eq('id', adminId), 'grant admin');
  success(await buyer.auth.signInWithPassword({ email: buyerEmail, password }), 'buyer sign in');
  success(await seller.auth.signInWithPassword({ email: sellerEmail, password }), 'seller sign in');
  success(await stranger.auth.signInWithPassword({ email: strangerEmail, password }), 'stranger sign in');
  success(await admin.auth.signInWithPassword({ email: adminEmail, password }), 'admin sign in');

  listingId = success(await root.from('listings').insert({
    kind: 'car', seller_id: sellerId, seller_name: 'Message Seller',
    title: 'Messaging smoke vehicle', category: 'cars_sale', price: 10000,
    status: 'available',
  }).select('id').single(), 'create listing').id;
  success(await root.from('car_details').insert({ listing_id: listingId, brand: 'Toyota', model: 'Hilux' }), 'create detail');

  conversationId = success(await buyer.rpc('start_listing_conversation', { p_listing_id: listingId, p_message: 'Is this still available?' }), 'start conversation');
  const reopened = success(await buyer.rpc('start_listing_conversation', { p_listing_id: listingId, p_message: 'I am interested in viewing it.' }), 'reuse conversation');
  assert.equal(reopened, conversationId, 'one buyer/listing pair must reuse one conversation');

  const sellerInbox = success(await seller.rpc('message_inbox', { p_query: '', p_unread_only: false, p_limit: 50, p_cursor_at: null, p_cursor_id: null }), 'seller inbox');
  assert.equal(sellerInbox.length, 1);
  assert.equal(sellerInbox[0].other_user_name, 'Message Buyer');
  assert.equal(sellerInbox[0].has_unread, true);

  const strangerInbox = success(await stranger.rpc('message_inbox', { p_query: '', p_unread_only: false, p_limit: 50, p_cursor_at: null, p_cursor_id: null }), 'stranger inbox');
  assert.equal(strangerInbox.length, 0);
  const strangerRows = success(await stranger.from('inquiries').select('id').eq('conversation_id', conversationId), 'stranger direct read');
  assert.equal(strangerRows.length, 0);
  const strangerThread = await stranger.rpc('message_thread_rows', { p_conversation_id: conversationId, p_limit: 200 });
  assert.ok(strangerThread.error, 'non-participant must not load a thread');

  success(await seller.rpc('mark_conversation_seen', { p_conversation_id: conversationId }), 'mark seen');
  const sellerInboxSeen = success(await seller.rpc('message_inbox', { p_query: '', p_unread_only: true, p_limit: 50, p_cursor_at: null, p_cursor_id: null }), 'unread inbox');
  assert.equal(sellerInboxSeen.length, 0);
  success(await seller.rpc('send_conversation_message', { p_conversation_id: conversationId, p_message: 'Yes, it is available.' }), 'seller reply');

  const buyerThread = success(await buyer.rpc('message_thread_rows', { p_conversation_id: conversationId, p_limit: 200 }), 'buyer thread');
  assert.equal(buyerThread.length, 3);
  assert.deepEqual(Object.keys(buyerThread[0]).sort(), ['body', 'created_at', 'message_id', 'sender_id']);

  const directInsert = await buyer.from('inquiries').insert({
    listing_id: listingId, seller_id: sellerId, buyer_id: buyerId,
    sender_id: buyerId, conversation_id: conversationId, message: 'bypass',
  });
  assert.ok(directInsert.error, 'direct client inserts must be denied');

  success(await buyer.rpc('set_conversation_block', { p_conversation_id: conversationId, p_blocked: true }), 'block conversation');
  const blockedReply = await seller.rpc('send_conversation_message', { p_conversation_id: conversationId, p_message: 'This must be denied.' });
  assert.ok(blockedReply.error, 'either participant block must stop both senders');
  success(await buyer.rpc('set_conversation_block', { p_conversation_id: conversationId, p_blocked: false }), 'unblock conversation');

  const reportId = success(await buyer.rpc('report_conversation', { p_conversation_id: conversationId, p_reason: 'scam', p_description: 'Requested an unsafe deposit.' }), 'report conversation');
  const report = success(await buyer.from('conversation_reports').select('id,status,reason').eq('id', reportId).single(), 'reporter reads report');
  assert.equal(report.status, 'pending');

  for (let index = 0; index < 8; index += 1) {
    success(await buyer.rpc('send_conversation_message', { p_conversation_id: conversationId, p_message: `Rate message ${index + 1}` }), `rate message ${index + 1}`);
  }
  const rateDenied = await buyer.rpc('send_conversation_message', { p_conversation_id: conversationId, p_message: 'Eleventh message inside one minute' });
  assert.ok(rateDenied.error, 'the eleventh buyer message inside one minute must be rate-limited');

  const adminReports = success(await admin.rpc('admin_report_rows_page', { p_query: '', p_status: 'pending', p_kind: 'message', p_limit: 25, p_cursor_at: null, p_cursor_id: null }), 'admin message reports');
  assert.equal(adminReports.some((row) => row.report_id === reportId && row.listing_type === 'message'), true);
  success(await admin.rpc('admin_review_report', { p_report_id: reportId, p_status: 'actioned', p_notes: 'Close unsafe local smoke conversation' }), 'close reported conversation');
  const closed = success(await seller.rpc('message_conversation', { p_conversation_id: conversationId }), 'load closed conversation');
  assert.equal(closed.state, 'closed');
  assert.equal(closed.can_send, false);

  success(await root.from('users').update({ status: 'suspended' }).eq('id', buyerId), 'suspend buyer');
  const suspendedSend = await buyer.rpc('send_conversation_message', { p_conversation_id: conversationId, p_message: 'Suspended account bypass' });
  assert.ok(suspendedSend.error, 'suspended account must not send');

  console.log(`Phase 3 ${smokeTarget.label} messaging smoke: PASS`);
  console.log('Verified participant isolation, one conversation, unread state, plain text, block/report, rate limits, and suspended-user denial.');
} finally {
  if (listingId) await root.from('listings').delete().eq('id', listingId);
  await buyer.auth.signOut();
  await seller.auth.signOut();
  await stranger.auth.signOut();
  await admin.auth.signOut();
  if (adminId) await root.from('audit_logs').delete().eq('admin_user_id', adminId);
  if (buyerId) await root.auth.admin.deleteUser(buyerId);
  if (sellerId) await root.auth.admin.deleteUser(sellerId);
  if (strangerId) await root.auth.admin.deleteUser(strangerId);
  if (adminId) await root.auth.admin.deleteUser(adminId);
}
