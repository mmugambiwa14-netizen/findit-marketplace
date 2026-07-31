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

function applyStoredTheme() {
  let storedTheme = null;
  try {
    storedTheme = window.localStorage.getItem('theme');
  } catch {
    storedTheme = null;
  }

  const theme = storedTheme === 'light' ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#090b10' : '#f7f8fb',
  );
}

restoreDeepLink();
applyStoredTheme();
