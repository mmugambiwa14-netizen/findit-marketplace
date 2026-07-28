import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSmokeTarget } from './lib/smoke-target.mjs';

const supabaseUrl = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const smokeTarget = assertSmokeTarget(supabaseUrl, 'The admin smoke test');
if (!anonKey || !secretKey) {
  throw new Error('FINDIT_SUPABASE_ANON_KEY and FINDIT_SUPABASE_SECRET_KEY are required.');
}

const options = { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } };
const root = createClient(supabaseUrl, secretKey, options);
const admin = createClient(supabaseUrl, anonKey, options);
const ordinary = createClient(supabaseUrl, anonKey, options);
const guest = createClient(supabaseUrl, anonKey, options);
const stamp = Date.now();
const adminEmail = `findit-admin-smoke-${stamp}@example.test`;
const userEmail = `findit-admin-target-${stamp}@example.test`;
const password = `FindIt!Admin${stamp}`;
let adminId;
let userId;
let listingId;
let reportId;
let supportRequestId;
let vehicleCategory;

function success(result, label) {
  assert.equal(result.error, null, `${label} failed: ${result.error?.message}`);
  return result.data;
}

try {
  adminId = success(await root.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, user_metadata: { full_name: 'Admin Smoke' } }), 'create super admin').user.id;
  userId = success(await root.auth.admin.createUser({ email: userEmail, password, email_confirm: true, user_metadata: { full_name: 'Target Smoke' } }), 'create target user').user.id;
  success(await root.from('users').update({ role: 'admin', super_admin: true }).eq('id', adminId), 'grant local super admin');
  success(await admin.auth.signInWithPassword({ email: adminEmail, password }), 'admin sign in');
  success(await ordinary.auth.signInWithPassword({ email: userEmail, password }), 'ordinary sign in');

  const denied = await ordinary.rpc('admin_dashboard_stats');
  assert.ok(denied.error, 'ordinary account must not invoke admin operations');
  const deniedSupport = await ordinary.rpc('admin_support_request_rows_page', { p_query: '', p_status: 'all', p_category: 'all', p_limit: 25, p_cursor_at: null, p_cursor_id: null });
  assert.ok(deniedSupport.error, 'ordinary account must not read the founder support inbox');

  const guestEmail = `findit-support-guest-${stamp}@example.test`;
  const supportConfirmation = success(await guest.rpc('submit_support_request', {
    p_category: 'technical',
    p_contact_email: guestEmail,
    p_message: 'The disposable local API smoke found a technical issue.',
    p_related_reference: 'smoke-reference',
  }), 'submit guest support request');
  assert.match(supportConfirmation.referenceId, /^FIT-\d{8}-[A-F0-9]{10}$/);
  const directSupportRead = await guest.from('support_requests').select('id');
  assert.ok(directSupportRead.error, 'guest must not directly read support requests');

  listingId = success(await root.from('listings').insert({ kind: 'car', seller_id: userId, seller_name: 'Target Smoke', title: 'Admin smoke vehicle', category: 'cars_sale', price: 9000, status: 'available' }).select('id').single(), 'create listing').id;
  success(await root.from('car_details').insert({ listing_id: listingId, brand: 'Toyota', model: 'Corolla' }), 'create vehicle detail');
  reportId = success(await root.from('reports').insert({ listing_id: listingId, listing_type: 'vehicle', listing_title: 'Admin smoke vehicle', reason: 'fake', reporter_id: userId }).select('id').single(), 'create report').id;

  const overview = success(await admin.rpc('admin_dashboard_stats'), 'load overview');
  assert.ok(Number(overview.pending_reports) >= 1);
  const marketplace = success(await admin.rpc('admin_marketplace_rows_page', { p_query: 'Admin smoke', p_kind: 'car', p_status: 'available', p_limit: 25, p_cursor_at: null, p_cursor_id: null }), 'load marketplace');
  assert.equal(marketplace.some((row) => row.item_id === listingId), true);
  const users = success(await admin.rpc('admin_user_rows_page', { p_query: userEmail, p_role: 'user', p_status: 'active', p_limit: 25, p_cursor_at: null, p_cursor_id: null }), 'load users');
  assert.equal(users.length, 1);
  const supportRows = success(await admin.rpc('admin_support_request_rows_page', { p_query: guestEmail, p_status: 'open', p_category: 'technical', p_limit: 25, p_cursor_at: null, p_cursor_id: null }), 'load founder support inbox');
  assert.equal(supportRows.length, 1);
  supportRequestId = supportRows[0].request_id;
  const resolvedSupport = success(await admin.rpc('admin_resolve_support_request', { p_request_id: supportRequestId, p_note: 'Local founder-inbox resolution verification' }), 'resolve support request');
  assert.equal(resolvedSupport.status, 'resolved');

  const categories = success(await admin.rpc('admin_category_rows'), 'load categories');
  assert.equal(categories.filter((row) => row.parent_id === null).length, 4);
  vehicleCategory = categories.find((row) => row.parent_id === null && row.slug === 'vehicles');
  assert.ok(vehicleCategory);
  success(await admin.rpc('admin_update_category', { p_category_id: vehicleCategory.category_id, p_display_label: 'Vehicles smoke label', p_sort_order: vehicleCategory.sort_order, p_is_active: true, p_reason: 'Local smoke verification' }), 'update category label');
  success(await admin.rpc('admin_update_category', { p_category_id: vehicleCategory.category_id, p_display_label: 'Vehicles', p_sort_order: vehicleCategory.sort_order, p_is_active: true, p_reason: 'Restore smoke fixture label' }), 'restore category label');

  success(await admin.rpc('admin_set_user_role', { p_user_id: userId, p_role: 'admin', p_reason: 'Local role operation verification' }), 'promote target');
  success(await admin.rpc('admin_set_user_role', { p_user_id: userId, p_role: 'user', p_reason: 'Restore target role' }), 'restore target role');
  success(await admin.rpc('admin_set_user_status', { p_user_id: userId, p_status: 'suspended', p_reason: 'Local status operation verification', p_ban_until: null }), 'suspend target');
  success(await admin.rpc('admin_set_user_status', { p_user_id: userId, p_status: 'active', p_reason: 'Restore smoke target', p_ban_until: null }), 'restore target');
  success(await admin.rpc('admin_review_report', { p_report_id: reportId, p_status: 'reviewed', p_notes: 'Local report review verification' }), 'review report');
  success(await admin.rpc('admin_moderate_marketplace_item', { p_item_id: listingId, p_kind: 'car', p_action: 'pause', p_reason: 'Local moderation verification' }), 'pause listing');

  const audit = success(await admin.rpc('admin_audit_rows_page', { p_query: '', p_target_type: 'all', p_limit: 100, p_cursor_at: null, p_cursor_id: null }), 'load audit');
  assert.ok(audit.length >= 9, 'all privileged smoke operations must be audited');

  console.log(`Phase 3 ${smokeTarget.label} admin smoke: PASS`);
  console.log('Verified admin authorization, overview, marketplace, users, reports, founder support inbox, categories, and audit operations.');
} finally {
  if (supportRequestId) await root.from('support_requests').delete().eq('id', supportRequestId);
  if (listingId) await root.from('reports').delete().eq('listing_id', listingId);
  if (reportId) await root.from('reports').delete().eq('id', reportId);
  if (listingId) await root.from('listings').delete().eq('id', listingId);
  if (userId) await root.from('app_alerts').delete().eq('user_id', userId);
  if (adminId) await root.from('audit_logs').delete().eq('admin_user_id', adminId);
  await admin.auth.signOut();
  await ordinary.auth.signOut();
  if (userId) await root.auth.admin.deleteUser(userId);
  if (adminId) await root.auth.admin.deleteUser(adminId);
}
