import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

async function collect(directory, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'coverage'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path, output);
    else if (['.js', '.jsx', '.mjs', '.ts', '.tsx'].includes(extname(entry.name))) output.push(path);
  }
  return output;
}

const [
  app,
  main,
  register,
  resetPassword,
  authService,
  authContext,
  protectedRoute,
  missingProfile,
  accountBlocked,
  guestDialog,
  locationSelector,
  phoneInput,
  phoneNumber,
  searchPage,
  searchToolbar,
  mediaViewer,
  publicListingsService,
  servicesService,
  browserStorage,
  share,
  propertyDetail,
  carDetail,
  machineryDetail,
  serviceDetail,
] = await Promise.all([
  read('src/App.jsx'),
  read('src/main.jsx'),
  read('src/pages/Register.jsx'),
  read('src/pages/ResetPassword.jsx'),
  read('src/services/authService.js'),
  read('src/lib/AuthContext.jsx'),
  read('src/components/ProtectedRoute.jsx'),
  read('src/components/UserNotRegisteredError.jsx'),
  read('src/components/auth/AccountBlocked.jsx'),
  read('src/components/auth/GuestPromptSheet.jsx'),
  read('src/components/location/LocationSelector.jsx'),
  read('src/components/ui/PhoneInput.jsx'),
  read('src/lib/phoneNumber.js'),
  read('src/pages/Search.jsx'),
  read('src/components/search/SearchToolbar.jsx'),
  read('src/components/listings/ListingMediaViewer.jsx'),
  read('src/services/publicListingsService.js'),
  read('src/services/servicesService.js'),
  read('src/lib/browserStorage.js'),
  read('src/lib/share.js'),
  read('src/pages/PropertyDetail.jsx'),
  read('src/pages/CarDetail.jsx'),
  read('src/pages/MachineryDetail.jsx'),
  read('src/pages/ServiceDetail.jsx'),
]);

const sourceFiles = await collect(resolve(root, 'src'));
const sourceEntries = await Promise.all(sourceFiles.map(async (path) => ({ path, source: await readFile(path, 'utf8') })));

test('the complete routed product surface is declared and has a fallback', () => {
  const routePatterns = [...app.matchAll(/<Route\b[\s\S]*?\bpath=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.equal(routePatterns.length, 42);
  for (const path of [
    '/', '/search', '/property/:id', '/car/:id', '/machinery/:id', '/services', '/service/:id',
    '/tours', '/post', '/saved', '/chats', '/chats/:conversationId', '/profile', '/my-listings',
    '/my-services', '/settings', '/notifications', '/admin', '/admin/listings', '/admin/users',
    '/admin/reports', '/admin/categories', '/admin/audit-log', '*',
  ]) assert.ok(routePatterns.includes(path), `Missing route ${path}`);
  assert.match(app, /<Route path="\/create" element={<LegacyPathRedirect to="\/post" \/>}/);
  assert.match(app, /<Route path="\/messages\/:conversationId" element={<LegacyConversationRedirect \/>}/);
});

test('application-level crashes are contained by a global error boundary', () => {
  assert.match(main, /AppErrorBoundary/);
  assert.match(main, /<AppErrorBoundary>[\s\S]*<App \/>[\s\S]*<\/AppErrorBoundary>/);
});

test('registration and OAuth preserve protected return destinations through confirmation', () => {
  assert.match(register, /redirectPath:\s*returnTo/);
  assert.match(register, /resendSignupConfirmation\(email, returnTo\)/);
  assert.match(register, /signInWithOAuth\(provider, returnTo\)/);
  assert.match(authService, /emailRedirectTo:\s*appUrl\(redirectPath\)/);
  assert.match(authService, /redirectTo:\s*appUrl\(redirectPath\)/);
});

test('registration and password reset reject weak passwords and expose errors accessibly', () => {
  assert.match(register, /password\.length < 8/);
  assert.ok((register.match(/minLength=\{8\}/g) || []).length >= 2);
  assert.match(register, /role="alert"/);
  assert.match(register, /aria-describedby="register-password-requirements"/);
  assert.match(resetPassword, /newPassword\.length < 8/);
  assert.match(resetPassword, /minLength=\{8\}/);
  assert.match(resetPassword, /role="alert"/);
  assert.match(resetPassword, /aria-describedby="password-requirements"/);
  assert.match(resetPassword, /await authService\.signOut\(\)/);
  assert.match(resetPassword, /setRecoverySessionClosed\(false\)/);
  assert.match(resetPassword, /could not close the recovery session/);
});

test('logout and blocked-account sign-out report real outcomes', () => {
  assert.match(authContext, /await authService\.signOut\([^)]*\)/);
  assert.match(authContext, /return true/);
  assert.match(authContext, /return false/);
  assert.match(accountBlocked, /await authService\.signOut\([^)]*\)/);
  assert.match(accountBlocked, /setSignOutError/);
  assert.match(accountBlocked, /disabled=\{signingOut\}/);
});

test('the browser auth profile excludes OTP and privileged implementation columns', () => {
  const projection = authService.match(/const AUTH_PROFILE_SELECT = `([\s\S]*?)`;/)?.[1] || '';
  assert.ok(projection);
  assert.match(authService, /\.select\(AUTH_PROFILE_SELECT\)/);
  assert.doesNotMatch(authService, /\.select\(['"]\*['"]\)/);
  for (const privateColumn of ['phone_otp_code', 'phone_otp_pending', 'phone_otp_expires', 'super_admin']) {
    assert.doesNotMatch(projection, new RegExp(privateColumn));
  }
});

test('missing profiles and temporary role-service failures are not misreported as access denial', () => {
  assert.match(app, /authError\.type === 'profile_missing'/);
  assert.match(protectedRoute, /authError\?\.type === 'profile_missing'/);
  assert.match(protectedRoute, /We could not verify your access/);
  assert.match(protectedRoute, /No access decision has been made/);
  assert.match(protectedRoute, /Access denied/);
  assert.match(missingProfile, /User profile not found|account profile/i);
});

test('guest authentication prompts use a focus-managed dialog and retain the current action', () => {
  assert.match(guestDialog, /@\/components\/ui\/dialog/);
  assert.match(guestDialog, /<DialogContent/);
  assert.match(guestDialog, /createLoginPath/);
  assert.match(guestDialog, /returnTo/);
  assert.doesNotMatch(guestDialog, /<div[^>]+onClick=/);
});

test('location selection clears stale dependent state and exposes loading failure recovery', () => {
  assert.match(locationSelector, /setState\(\"\"\)/);
  assert.match(locationSelector, /setCity\(\"\"\)/);
  assert.match(locationSelector, /Retry/);
  assert.match(locationSelector, /disabled=\{!country/);
  assert.match(locationSelector, /disabled=\{!state/);
});

test('phone entry uses labelled controls and longest-prefix parsing', () => {
  assert.match(phoneNumber, /sort\(\(left, right\) => \([\s\S]*right\.code\.length - left\.code\.length/);
  assert.match(phoneNumber, /normalized\.startsWith\(country\.code\)/);
  assert.match(phoneInput, /aria-label=\{`Choose country calling code/);
  assert.match(phoneInput, /role="listbox"/);
  assert.match(phoneInput, /autoComplete=\{autoComplete\}/);
});

test('public search is debounced, cursor-based and keyboard-operable', () => {
  assert.match(searchPage, /useDebouncedValue/);
  assert.match(searchPage, /useInfiniteQuery/);
  assert.match(searchToolbar, /role="combobox"/);
  assert.match(searchToolbar, /aria-activedescendant/);
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter', 'Escape']) assert.match(searchToolbar, new RegExp(key));
});

test('Tour playback is authorized only after explicit Play and can be reissued', () => {
  assert.match(mediaViewer, /const openTour = async/);
  assert.match(mediaViewer, /await getPublicTourPlayback\(parentType, parentId\)/);
  assert.match(mediaViewer, /onClick=\{openTour\}/);
  assert.match(mediaViewer, /retryPlayback/);
  assert.match(mediaViewer, /playback link expired/);
  assert.doesNotMatch(publicListingsService, /getPublicTourPlayback|tryGetPublicTourPlayback/);
  assert.doesNotMatch(servicesService, /getPublicTourPlayback|tryGetPublicTourPlayback/);
  for (const page of [propertyDetail, carDetail, machineryDetail, serviceDetail]) {
    assert.match(page, /parentId=/);
    assert.match(page, /ListingMediaViewer/);
  }
});

test('browser storage failures degrade safely instead of crashing page flows', () => {
  for (const helper of ['readStoredString', 'readStoredJson', 'writeStoredString', 'writeStoredJson', 'removeStoredValue']) {
    assert.match(browserStorage, new RegExp(`export function ${helper}`));
  }
  assert.ok((browserStorage.match(/catch \{/g) || []).length >= 5);
  for (const { path, source } of sourceEntries) {
    const modulePath = path.replaceAll('\\', '/');
    if (modulePath.endsWith('src/lib/browserStorage.js') || modulePath.endsWith('src/services/authService.js')) continue;
    assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage)\b/, `Unsafe storage access in ${path}`);
  }
});

test('sharing awaits the platform result and never reports false clipboard success', () => {
  assert.match(share, /export async function shareListing/);
  assert.match(share, /await navigator\.share/);
  assert.match(share, /await navigator\.clipboard\.writeText/);
  assert.match(share, /return false/);
  assert.match(share, /AbortError/);
});

test('all native buttons, new-tab links, images and click targets meet static interaction safety rules', () => {
  for (const { path, source } of sourceEntries) {
    for (const match of source.matchAll(/<button\b([\s\S]*?)(?:>|\/\>)/g)) {
      assert.match(match[1], /\btype=/, `Native button without type in ${path}`);
    }
    for (const match of source.matchAll(/<(?:a|Link|NavLink)\b([\s\S]*?)target=["']_blank["']([\s\S]*?)(?:>|\/\>)/g)) {
      const attributes = `${match[1]} ${match[2]}`;
      assert.match(attributes, /rel=["'][^"']*noopener[^"']*noreferrer[^"']*["']/, `Unsafe new-tab link in ${path}`);
    }
    for (const match of source.matchAll(/<img\b([\s\S]*?)(?:>|\/\>)/g)) {
      assert.match(match[1], /\balt=/, `Image without alt in ${path}`);
    }
    assert.doesNotMatch(source, /images\.unsplash\.com/, `Remote listing placeholder in ${path}`);
    assert.doesNotMatch(source, /<(?:div|span|p|li)\b[^>]*\bonClick=/, `Non-keyboard click target in ${path}`);
  }
});
