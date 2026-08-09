export function goBackOrHome(navigate, fallback = '/') {
  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  const routerHistoryIndex = typeof window !== 'undefined' ? window.history.state?.idx : null;
  let sameOriginReferrer = false;
  try {
    sameOriginReferrer = Boolean(referrer) && new URL(referrer).origin === window.location.origin;
  } catch {
    sameOriginReferrer = false;
  }

  if (Number.isInteger(routerHistoryIndex) && routerHistoryIndex > 0) navigate(-1);
  else if (window.history.length > 1 && sameOriginReferrer) navigate(-1);
  else navigate(fallback);
}
