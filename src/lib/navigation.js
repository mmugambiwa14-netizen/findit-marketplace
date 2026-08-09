export function goBackOrHome(navigate, fallback = '/') {
  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  let sameOriginReferrer = false;
  try {
    sameOriginReferrer = Boolean(referrer) && new URL(referrer).origin === window.location.origin;
  } catch {
    sameOriginReferrer = false;
  }

  if (window.history.length > 1 && sameOriginReferrer) navigate(-1);
  else navigate(fallback);
}
