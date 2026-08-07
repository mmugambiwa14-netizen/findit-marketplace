# FLOW-18 — PWA, install, update, offline
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`PwaProvider` / `PwaStatusBar` / `GlobalRefreshButton` / `InstallPrompt` (`App.jsx:276-281`); `src/lib/serviceWorker.js`; `public/sw.js` (177 lines); `public/offline.html` + `offline.css` + `offline.js`; `public/manifest.webmanifest`.

## Assessment
| Aspect | State |
|---|---|
| Cache rotation | PASS — `peekalisting-shell-*` / `peekalisting-assets-*` |
| **Legacy cache retirement** | PASS — `deleteFindItCaches()` (`serviceWorker.js:32,55,164`) and `name.startsWith('findit-')` in `sw.js`; old FindIt caches upgrade safely |
| Header discipline | PASS — `sw.js` served `max-age=0, must-revalidate` with `Service-Worker-Allowed: /`; assets `immutable`; HTML `no-store` (`vercel.json:62-91`) |
| Offline shell | Present, with its own cached CSS/JS |
| Install prompt | Deferred until repeat visits (`InstallPrompt.jsx:14,27-28`) |

## Gaps
- **F-017 (P2)** — the manifest ships a single SVG icon: no `apple-touch-icon` (so iOS home-screen install yields a blank icon), no 192/512 raster, no `maskable`. A contract test (`peekaListingBrandContracts.test.mjs:24`) locks this in.
- **F-016 (P3)** — a post-deploy chunk-load rejection renders a generic error rather than prompting reload.
- **F-001** — "Add FindIt to your home screen" (`InstallPrompt.jsx:108`), "Refresh FindIt" (`GlobalRefreshButton.jsx:29-30`).
