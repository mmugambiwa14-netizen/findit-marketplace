import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.FINDIT_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const mailpitUrl = process.env.FINDIT_MAILPIT_URL ?? 'http://127.0.0.1:55324';
const anonKey = process.env.FINDIT_SUPABASE_ANON_KEY;
const secretKey = process.env.FINDIT_SUPABASE_SECRET_KEY;

if (!anonKey || !secretKey) {
  throw new Error('FINDIT_SUPABASE_ANON_KEY and FINDIT_SUPABASE_SECRET_KEY are required. Use local keys from `supabase status`.');
}

const timestamp = Date.now();
const email = `findit-auth-smoke-${timestamp}@example.test`;
const initialPassword = `FindIt!${timestamp}A`;
const replacementPassword = `FindIt!${timestamp}B`;
const phone = '+263771234567';

function createLocalClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

const rootClient = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});
let createdUserId;

async function waitForMessage(recipient, subjectPattern, knownIds = new Set()) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const response = await fetch(`${mailpitUrl}/api/v1/messages`);
    assert.equal(response.ok, true, `Mailpit message list failed with ${response.status}`);
    const body = await response.json();
    const match = body.messages?.find((message) => {
      const recipients = message.To?.map((entry) => entry.Address) ?? [];
      return recipients.includes(recipient)
        && subjectPattern.test(message.Subject ?? '')
        && !knownIds.has(message.ID);
    });

    if (match) return match;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${subjectPattern} email to ${recipient}`);
}

async function getMessage(messageId) {
  const response = await fetch(`${mailpitUrl}/api/v1/message/${messageId}`);
  assert.equal(response.ok, true, `Mailpit message fetch failed with ${response.status}`);
  return response.json();
}

function findVerificationUrl(message) {
  const content = [message.HTML, message.Text, JSON.stringify(message)]
    .filter(Boolean)
    .join('\n')
    .replaceAll('&amp;', '&')
    .replaceAll('\\u0026', '&');
  const urls = content.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  const verificationUrl = urls
    .map((value) => value.replace(/[),.;]+$/, ''))
    .find((value) => value.includes('/auth/v1/verify?'));

  assert.ok(verificationUrl, 'The local auth email did not contain a verification URL');
  return verificationUrl;
}

async function exchangeEmailLink(messageId) {
  const message = await getMessage(messageId);
  const verificationUrl = findVerificationUrl(message);
  const response = await fetch(verificationUrl, { redirect: 'manual' });
  assert.ok(response.status >= 300 && response.status < 400, `Email link returned ${response.status}`);

  const location = response.headers.get('location');
  assert.ok(location, 'Email verification response did not include a redirect');
  const redirect = new URL(location, 'http://127.0.0.1:5173');
  const fragment = new URLSearchParams(redirect.hash.slice(1));
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');

  assert.ok(accessToken, 'Email verification redirect did not include an access token');
  assert.ok(refreshToken, 'Email verification redirect did not include a refresh token');
  return { access_token: accessToken, refresh_token: refreshToken };
}

async function expectAuthSuccess(result, operation) {
  assert.equal(result.error, null, `${operation} failed: ${result.error?.message}`);
  assert.ok(result.data, `${operation} returned no data`);
  return result.data;
}

function expectAuthNoError(result, operation) {
  assert.equal(result.error, null, `${operation} failed: ${result.error?.message}`);
}

try {
const signupClient = createLocalClient();
const signup = await expectAuthSuccess(
  await signupClient.auth.signUp({
    email,
    password: initialPassword,
    options: {
      data: { phone },
      emailRedirectTo: 'http://127.0.0.1:5173/',
    },
  }),
  'signup',
);
createdUserId = signup.user?.id;
assert.equal(signup.session, null, 'Email-confirmation signup unexpectedly created an immediate session');
assert.equal(signup.user?.email, email, 'Signup returned the wrong email');

const confirmationMessage = await waitForMessage(email, /confirm/i);
const confirmationSession = await exchangeEmailLink(confirmationMessage.ID);
const confirmedClient = createLocalClient();
await expectAuthSuccess(await confirmedClient.auth.setSession(confirmationSession), 'confirmation session');

const profile = await confirmedClient
  .from('users')
  .select('id,email,phone,status,role')
  .single();
assert.equal(profile.error, null, `Profile lookup failed: ${profile.error?.message}`);
assert.equal(profile.data.email, email, 'The public profile email does not match the auth identity');
assert.equal(profile.data.phone, phone, 'Signup phone metadata was not copied into the public profile');
assert.equal(profile.data.status, 'active', 'A new user was not created with active status');
assert.equal(profile.data.role, 'user', 'A new user was not created with the user role');

expectAuthNoError(await confirmedClient.auth.signOut(), 'sign out after confirmation');

const loginClient = createLocalClient();
const login = await expectAuthSuccess(
  await loginClient.auth.signInWithPassword({ email, password: initialPassword }),
  'password login',
);
assert.equal(login.user?.id, profile.data.id, 'Password login returned the wrong user');
expectAuthNoError(await loginClient.auth.signOut(), 'sign out after password login');

const knownMessageIds = new Set([confirmationMessage.ID]);
const recoveryRequestClient = createLocalClient();
const recoveryRequest = await recoveryRequestClient.auth.resetPasswordForEmail(email, {
  redirectTo: 'http://127.0.0.1:5173/reset-password',
});
assert.equal(recoveryRequest.error, null, `Password recovery request failed: ${recoveryRequest.error?.message}`);

const recoveryMessage = await waitForMessage(email, /reset|password/i, knownMessageIds);
const recoverySession = await exchangeEmailLink(recoveryMessage.ID);
const recoveryClient = createLocalClient();
await expectAuthSuccess(await recoveryClient.auth.setSession(recoverySession), 'password recovery session');
await expectAuthSuccess(
  await recoveryClient.auth.updateUser({ password: replacementPassword }),
  'password update',
);
expectAuthNoError(await recoveryClient.auth.signOut(), 'sign out after password update');

const oldPasswordClient = createLocalClient();
const oldPasswordLogin = await oldPasswordClient.auth.signInWithPassword({
  email,
  password: initialPassword,
});
assert.ok(oldPasswordLogin.error, 'The previous password remained valid after password recovery');

const replacementPasswordClient = createLocalClient();
const replacementPasswordLogin = await expectAuthSuccess(
  await replacementPasswordClient.auth.signInWithPassword({
    email,
    password: replacementPassword,
  }),
  'replacement-password login',
);
assert.equal(replacementPasswordLogin.user?.id, profile.data.id, 'Replacement-password login returned the wrong user');
expectAuthNoError(await replacementPasswordClient.auth.signOut(), 'final sign out');

console.log('Phase 2 local auth smoke: PASS');
console.log('Verified signup, confirmation, profile trigger, phone capture, login, logout, recovery, and password replacement.');
} finally {
  if (createdUserId) {
    const { error } = await rootClient.auth.admin.deleteUser(createdUserId);
    if (error) throw new Error(`Auth smoke cleanup failed: ${error.message}`);
  }
}
