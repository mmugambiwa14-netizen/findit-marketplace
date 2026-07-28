import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.FINDIT_SUPABASE_URL;
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;
const expectedProjectRef = process.env.FINDIT_EXPECTED_PROJECT_REF;

if (process.env.FINDIT_ALLOW_HOSTED_SMOKE !== 'staging') {
  throw new Error('Set FINDIT_ALLOW_HOSTED_SMOKE=staging to authorize disposable hosted fixtures.');
}
if (!supabaseUrl || !anonKey || !secretKey || !expectedProjectRef) {
  throw new Error(
    'FINDIT_SUPABASE_URL, FINDIT_SUPABASE_ANON_KEY, FINDIT_SUPABASE_SECRET_KEY, and FINDIT_EXPECTED_PROJECT_REF are required.',
  );
}

const parsedUrl = new URL(supabaseUrl);
if (
  parsedUrl.protocol !== 'https:'
  || parsedUrl.hostname !== `${expectedProjectRef}.supabase.co`
  || !/^[a-z]{20}$/.test(expectedProjectRef)
) {
  throw new Error('Hosted smoke target does not match the explicitly approved Supabase project ref.');
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const root = createClient(supabaseUrl, secretKey, clientOptions);
const browser = createClient(supabaseUrl, anonKey, clientOptions);
const stamp = crypto.randomUUID();
const email = `findit-phase8-${stamp}@example.test`;
const password = `FindIt-${crypto.randomBytes(24).toString('base64url')}!9aA`;
let userId;

function success(result, operation) {
  if (result.error) throw new Error(`${operation} failed: ${result.error.message}`);
  return result.data;
}

async function waitForProfile(id) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await root
      .from('users')
      .select('id,email,full_name,phone,status,role')
      .eq('id', id)
      .maybeSingle();
    if (result.error) throw new Error(`read generated profile failed: ${result.error.message}`);
    if (result.data) return result.data;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Generated profile did not appear within the bounded wait.');
}

try {
  const created = success(
    await root.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Phase 8 Hosted Smoke',
        phone: '+263771000999',
      },
    }),
    'create disposable hosted user',
  );
  userId = created.user.id;

  const generatedProfile = await waitForProfile(userId);
  assert.equal(generatedProfile.id, userId);
  assert.equal(generatedProfile.email, email);
  assert.equal(generatedProfile.full_name, 'Phase 8 Hosted Smoke');
  assert.equal(generatedProfile.phone, '+263771000999');
  assert.equal(generatedProfile.status, 'active');
  assert.equal(generatedProfile.role, 'user');

  const signedIn = success(
    await browser.auth.signInWithPassword({ email, password }),
    'hosted password login',
  );
  assert.equal(signedIn.user.id, userId);
  assert.ok(signedIn.session.access_token);
  assert.ok(signedIn.session.refresh_token);

  const currentUser = success(await browser.auth.getUser(), 'read hosted authenticated user');
  assert.equal(currentUser.user.id, userId);

  const ownProfile = success(
    await browser
      .from('users')
      .select('id,email,full_name,phone,status,role')
      .eq('id', userId)
      .single(),
    'read own hosted profile through RLS',
  );
  assert.equal(ownProfile.id, userId);
  assert.equal(ownProfile.email, email);

  const anonymous = createClient(supabaseUrl, anonKey, clientOptions);
  const anonymousRead = await anonymous
    .from('users')
    .select('id,email')
    .eq('id', userId);
  assert.equal(anonymousRead.error, null);
  assert.deepEqual(anonymousRead.data, []);

  success(await browser.auth.signOut(), 'hosted logout');
  const signedOut = success(await browser.auth.getSession(), 'read signed-out hosted session');
  assert.equal(signedOut.session, null);

  console.log(
    'Phase 8 hosted Auth smoke passed: confirmed account, profile trigger, login, own-profile RLS, anonymous denial, logout, and cleanup.',
  );
} finally {
  if (userId) {
    const deleted = await root.auth.admin.deleteUser(userId);
    if (deleted.error) throw new Error(`hosted Auth smoke cleanup failed: ${deleted.error.message}`);
    const remaining = await root.from('users').select('id').eq('id', userId);
    if (remaining.error) throw new Error(`hosted profile cleanup check failed: ${remaining.error.message}`);
    assert.deepEqual(remaining.data, []);
  }
}
