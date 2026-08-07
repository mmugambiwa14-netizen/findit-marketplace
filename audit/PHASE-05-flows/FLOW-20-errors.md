# FLOW-20 — Error, empty and dead-content states
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`AppErrorBoundary` above the router (`main.jsx:43-45`); `bootstrap()` try/catch → `StartupFailure` (`main.jsx:47-50`); `Suspense` fallback (`App.jsx:154`); `PageNotFound` catch-all (`App.jsx:213`); `AuthUnavailable` (`App.jsx:78-94`); `UserNotRegisteredError`; `AccountBlocked`; `customerErrors.js` / `userFacingErrors.js`.

## Assessment
| Case | Behaviour |
|---|---|
| Unknown route | `PageNotFound` |
| Render error | `AppErrorBoundary` — **no white-screen path found** |
| Bootstrap/import failure | `StartupFailure` with reload button |
| Auth provider down | `AuthUnavailable` with retry + sign out — explicitly *not* an access denial |
| Missing profile | `UserNotRegisteredError` |
| Blocked/banned | `AccountBlocked` with status, reason, ban expiry |
| Role check failure | Distinct "could not verify" state, separate from "access denied" (`ProtectedRoute.jsx:88-115`) |
| Offline | `public/offline.html` shell |
| Supabase misconfiguration | `supabaseClient.js:46,57` throws a specific configuration error |

This is materially better than typical for a Vite SPA — failure states are differentiated rather than collapsed into one generic screen.

## Gaps
- **F-016 (P3)** — chunk-load rejection is not distinguished from a generic render error, so the user is not told to reload.
- **F-001** — `AppErrorBoundary.jsx:31` "FindIt could not display this screen"; `supabaseClient.js:46,57` "FindIt configuration error".
