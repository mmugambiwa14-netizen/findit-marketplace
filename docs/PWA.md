# FindIt PWA — architecture, deployment and versioning

Covers what is implemented, how it is versioned and deployed, and what is
deliberately **not** implemented yet. Nothing here is aspirational: if a section
says something works, there is a test or a build gate behind it.

## What shipped

| Area | Status |
|---|---|
| Web app manifest, maskable icon, shortcuts | Implemented, tested |
| Service worker: precache, runtime caching, versioned invalidation | Implemented, tested |
| Offline fallback page | Implemented, tested |
| Update detection and user-controlled activation | Implemented |
| Install prompt with dismissal backoff | Implemented |
| Connectivity awareness (offline, slow, metered, reconnect) | Implemented |
| iOS standalone metadata and safe areas | Implemented |
| Background sync | **Not implemented** — see Not yet built |
| Push notifications | Implemented behind owner-provisioned VAPID and scheduler secrets |

## The caching boundary — read this before changing `public/sw.js`

The worker handles **only same-origin GET requests**. Everything else is passed
through untouched: no `respondWith`, no cache read, no cache write.

That one rule is what keeps user data out of the cache, because every piece of
user data in this application is fetched **cross-origin** from Supabase:

- PostgREST rows (listings, messages, profiles) → `*.supabase.co`
- Signed storage URLs for private media → `*.supabase.co`
- Edge Function responses → `*.supabase.co`

None of those are same-origin, so none can reach a cache. As defence in depth
against a *future* same-origin API, the worker also refuses any request carrying
an `Authorization` or `apikey` header, a `token=` query parameter, or
`credentials: 'include'`, and never caches a response bearing `Set-Cookie`.

`tests/serviceWorkerBoundary.test.mjs` executes the real worker against mocked
globals and asserts each of these, including that a PostgREST URL and a signed
storage URL are not handled.

**Consequence, stated plainly:** offline support covers the app shell and static
assets. Cached *user data* is deliberately left to the application layer, where
it can be scoped to an account and cleared on sign-out. A shared HTTP cache can
do neither.

### Caching strategies

| Request | Strategy | Why |
|---|---|---|
| Navigations | Network first → cached shell → `offline.html` | Signed-in users always get fresh HTML; a browser error page is never shown |
| `/assets/<name>-<hash>.<ext>` | Cache first | Content-hashed, so a new build emits a new URL and a stale entry can never shadow fresh code |
| `/brand/*`, `/manifest.webmanifest` | Stale while revalidate | Renders instantly, refreshes in the background |
| Everything else | Not handled | Safe default |

The asset pattern must match Vite's real output, which separates the hash with a
**hyphen** (`index-CAaKOM3W.js`), and whose hashes may themselves contain
hyphens (`findit-icon-32-Dv-RmQFK.png`). An earlier pattern expected
`name.hash.ext` and matched nothing at all — the worker looked healthy while
caching zero assets. The test suite now checks the pattern against every
filename in `dist/assets`.

## Versioning

`public/sw.js` contains a `__SW_VERSION__` placeholder.
`scripts/stamp-service-worker.mjs` replaces it during `npm run build` with a
SHA-256 of the sorted list of built filenames.

This matters because browsers decide whether a worker changed by byte-comparing
the script. A hand-maintained constant eventually ships un-bumped, the worker
looks unchanged, and users keep the old app forever. Deriving the version from
build output makes that impossible:

- Any bundle change → different filenames → different worker → update detected.
- No bundle change → byte-identical worker → users are not churned.

Cache names embed the version (`findit-shell-<version>`,
`findit-assets-<version>`), and `activate` deletes every `findit-*` cache not in
the current set.

The stamp script **fails the build** if `dist/sw.js` is missing or the
placeholder is absent. Both paths are exercised.

## Update flow (§17)

The worker never calls `skipWaiting()` on install. A new build installs and
waits.

1. `registerServiceWorker` detects the waiting worker and fires `onUpdateReady`.
2. `PwaStatusBar` shows "A new version is ready" with a Reload button.
3. On click, `applyPendingUpdate()` posts `SKIP_WAITING`.
4. The worker activates, `controllerchange` fires, the page reloads once.

Automatic activation is not used on purpose: sellers fill in long listing forms,
and swapping the app underneath one would discard a draft. A test asserts the
install handler does not call `skipWaiting`.

Installed apps can go days without a navigation, which is how browsers normally
notice a new worker, so `PwaProvider` also calls `registration.update()` every
30 minutes.

## Deployment

No deployment step changes. `npm run build` now runs, in order:

```
vite build
stamp-service-worker.mjs      # version stamping — fails if placeholder missing
verify-base44-elimination.mjs
verify-built-boundary.mjs
verify-bundle-secrets.mjs     # fails on secrets or source maps
verify-build-budget.mjs
```

`vercel.json` adds headers for three paths:

- `/sw.js` — `Content-Type: text/javascript`, `max-age=0, must-revalidate`,
  and `Service-Worker-Allowed: /`. A worker cached by a CDN is how a bad
  deploy becomes permanent.
- `/manifest.webmanifest` — `application/manifest+json`.
- `/offline.*` — one-hour cache.

Static files are served ahead of the SPA catch-all rewrite, which is why
`/sw.js`, `/manifest.webmanifest` and `/offline.html` resolve rather than
returning `index.html`. This was verified for `robots.txt` on the deployed
staging site.

### Rollback

Deploy the previous build. The new worker's version differs, so it installs,
waits, prompts, and on activation deletes the newer caches. No manual cache
purge is required.

To force every client off a broken worker, `unregisterServiceWorker()` in
`src/lib/serviceWorker.js` removes the registration and every `findit-*` cache.

## CSP interaction

The app CSP is strict, and two rules shaped this implementation:

- `script-src 'self'` — `offline.js` is a separate file, not an inline
  `<script>` body.
- `style-src-elem 'self'` — `offline.css` is a separate file, not a `<style>`
  block. Only style **attributes** are permitted (`style-src-attr
  'unsafe-inline'`).

`worker-src 'self' blob:` already permits a same-origin worker, so no CSP change
was needed. A test asserts `offline.html` contains neither an inline script body
nor a `<style>` block.

## iOS specifics

iOS ignores the manifest for standalone mode, so `index.html` carries
`apple-mobile-web-app-capable`, `apple-mobile-web-app-title` and
`apple-mobile-web-app-status-bar-style: black-translucent`.
`viewport-fit=cover` is what makes `env(safe-area-inset-*)` resolve to real
values; without it the app renders letterboxed in standalone mode.

Known iOS limitations, unchanged by this work: no `beforeinstallprompt` (so no
custom install button — users must use Share → Add to Home Screen), no
Background Sync, and storage eviction after periods of non-use.

## Not yet built

Both remaining items need decisions or credentials that cannot be created from
the repository.

### Background sync (§4)

Needs a durable outbox in IndexedDB plus a `sync` event handler, and a decision
per queued action about idempotency. Queuing a message is safe to retry with a
client-generated id; queuing a *listing publish* is not, without a server-side
deduplication key. Nothing was implemented rather than shipping a queue that can
double-post.

iOS does not support Background Sync at all, so any design also needs a
foreground flush on next launch.

### Push notifications (§5)

The Web Push foundation is now implemented in the existing notification domain:

- `notification_preferences` stores push and foreground-tone preferences;
- `web_push_subscriptions` remains owner-scoped and supports multiple devices;
- `web_push_delivery_jobs` plus `web_push_delivery_attempts` provide bounded,
  leased, idempotent delivery;
- the trusted `web-push-dispatch` Edge Function uses server-only VAPID secrets;
- the stamped service worker handles foreground handoff, background display,
  safe clicks and subscription renewal;
- permission is requested only after an explanation and a user action;
- the optional PeekaListing tone is foreground-only. Background/closed sound is
  controlled by the browser and operating system.

Remaining live acceptance requires owner-provisioned VAPID keys, dispatcher
secret, scheduler invocation and browser/OS permission. The browser public key
may be `VITE_`-prefixed; the private key must never be. The bundle secret scan
fails if a private key reaches `dist/`.

## Performance targets (§8) — not measured

Lighthouse scores were **not verified**. This environment's network policy
denies outbound HTTPS to `*.vercel.app`, so the deployed app cannot be audited
from here, and no headless Chrome run was possible.

What can be stated: the production entry bundle is 147 KB raw / 47.9 KB gzip
against a 170 KB gzip release gate, routes are already code-split, and no source
maps ship. The remaining §8 items — responsive `srcset`, AVIF/WebP negotiation,
blur placeholders, font preloading — are **not implemented**.

Run Lighthouse against a real deployment before claiming any score.
