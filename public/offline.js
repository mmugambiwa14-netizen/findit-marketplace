/* Offline fallback behaviour.
 *
 * A separate file rather than an inline script: the app CSP sets
 * `script-src 'self'`, which blocks inline <script> bodies.
 *
 * Deliberately dependency-free and framework-free. This page has to work when
 * the application bundle could not be fetched, so it cannot rely on anything
 * the app provides.
 */
(function () {
  'use strict';

  var statusEl = document.getElementById('status');
  var retryEl = document.getElementById('retry');
  var reloading = false;

  function setStatus(message, online) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.setAttribute('data-online', online ? 'true' : 'false');
  }

  /* navigator.onLine only reports whether a network interface exists -- a
   * captive portal or a dead uplink still reports true. An actual request is
   * the only reliable signal, so reachability is probed rather than trusted. */
  function probe() {
    return fetch('/manifest.webmanifest', { method: 'HEAD', cache: 'no-store' })
      .then(function (response) { return response.ok; })
      .catch(function () { return false; });
  }

  function reloadOnce() {
    if (reloading) return;
    reloading = true;
    setStatus('Back online. Reloading…', true);
    window.location.replace('/');
  }

  function attempt(fromUser) {
    if (fromUser) setStatus('Checking your connection…', false);
    return probe().then(function (reachable) {
      if (reachable) {
        reloadOnce();
        return true;
      }
      if (fromUser) setStatus('Still offline. We will keep trying.', false);
      return false;
    });
  }

  if (retryEl) {
    retryEl.addEventListener('click', function () {
      retryEl.disabled = true;
      attempt(true).then(function () {
        retryEl.disabled = false;
      });
    });
  }

  window.addEventListener('online', function () { attempt(false); });
  window.addEventListener('offline', function () {
    setStatus('Waiting for a connection…', false);
  });

  /* Poll gently. Backs off so a phone left on this page overnight is not woken
   * every few seconds, and pauses entirely while the tab is hidden. */
  var delay = 4000;
  var MAX_DELAY = 60000;

  function schedule() {
    window.setTimeout(function () {
      if (document.visibilityState === 'visible') {
        attempt(false).then(function (reachable) {
          if (!reachable) {
            delay = Math.min(Math.round(delay * 1.6), MAX_DELAY);
            schedule();
          }
        });
      } else {
        schedule();
      }
    }, delay);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      delay = 4000;
      attempt(false);
    }
  });

  schedule();
}());
