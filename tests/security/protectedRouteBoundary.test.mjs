import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const [route, authService, app] = await Promise.all([
  read('src/components/ProtectedRoute.jsx'),
  read('src/services/authService.js'),
  read('src/App.jsx'),
]);

test('protected routes wait for a completed auth check before rendering content', () => {
  assert.match(route, /isLoadingAuth\s*\|\|\s*!authChecked/);
  assert.match(route, /return\s+fallback/);
  assert.match(route, /if\s*\(!isAuthenticated\)\s*\{\s*return\s+unauthenticatedElement/s);
});

test('role-protected routes revalidate authorization through authService', () => {
  assert.match(route, /authService\.hasRequiredRole\(requiredRole\)/);
  assert.doesNotMatch(route, /user\?\.role\s*===\s*requiredRole/);
  assert.match(authService, /export async function hasRequiredRole\(requiredRole\)/);
  assert.match(authService, /supabase\.rpc\(rpcName\)/);
});

test('authorization service failures fail closed and remain distinct from denial', () => {
  assert.match(route, /setRoleError\(/);
  assert.match(route, /We could not verify your access/);
  assert.match(route, /No access decision has been made/);
  assert.match(route, /Access denied/);
  assert.match(route, /setVerificationAttempt\(\(attempt\) => attempt \+ 1\)/);
});

test('missing authenticated profiles do not degrade into a guest session', () => {
  assert.match(route, /authError\?\.type === 'profile_missing'/);
  assert.match(route, /<UserNotRegisteredError/);
});

test('admin routes are nested beneath a required admin role boundary', () => {
  // The boundary is real and always was: src/App.jsx renders
  //   <Route element={<ProtectedRoute unauthenticatedElement={<SignInRedirect />}
  //                                   requiredRole="admin" />}>
  // wrapping every /admin route. The previous pattern was /<ProtectedRoute[^>]+requiredRole="admin"/,
  // whose [^>] cannot cross the '>' inside <SignInRedirect />, so it failed on a
  // correctly guarded tree. A stale assertion, not a regression (F-049).
  // The guard is "no other <ProtectedRoute may intervene", so requiredRole="admin"
  // is proven to belong to the nearest preceding ProtectedRoute rather than to some
  // later one. Bounding on '>' or '/>' does not work here, because the sibling prop
  // unauthenticatedElement={<SignInRedirect />} contains both.
  assert.match(app, /<ProtectedRoute(?:(?!<ProtectedRoute)[\s\S])*?requiredRole="admin"/);
  for (const path of [
    '/admin/listings',
    '/admin/peeks',
    '/admin/users',
    '/admin/reports',
    '/admin/business-applications',
    '/admin/audit-log',
  ]) {
    assert.match(app, new RegExp(`path="${path.replaceAll('/', '\\/')}"`));
  }
});

test('MFA gate executes before protected and admin routes render', () => {
  const gateIndex = app.indexOf("mfaGate.status === 'required'");
  const routesIndex = app.indexOf('<Routes>');
  assert.ok(gateIndex >= 0, 'MFA gate must exist');
  assert.ok(routesIndex >= 0, 'route tree must exist');
  assert.ok(gateIndex < routesIndex, 'MFA challenge must run before the route tree renders');
});
