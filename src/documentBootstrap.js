import { readStoredString } from './lib/browserStorage.js';

const ROUTE_KEY = '__findit_route';

function restoreDeepLink() {
  const currentUrl = new URL(window.location.href);
  const restoredRoute = currentUrl.searchParams.get(ROUTE_KEY);
  if (!restoredRoute) return;

  currentUrl.searchParams.delete(ROUTE_KEY);
  const baseUrl = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  const targetUrl = new URL(restoredRoute.replace(/^\/+/, ''), baseUrl);
  const targetWithinApplication = targetUrl.origin === window.location.origin
    && targetUrl.pathname.startsWith(baseUrl.pathname);

  window.history.replaceState(
    null,
    '',
    targetWithinApplication
      ? `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`
      : `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
  );
}

function applyDarkTheme() {
  // Light mode is intentionally suspended while the visual system is rebuilt.
  // Keep the light tokens in CSS so it can return without another palette migration.
  readStoredString('local', 'theme', null);
  document.documentElement.classList.add('dark');
  document.documentElement.style.colorScheme = 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#050914');
}

restoreDeepLink();
applyDarkTheme();
