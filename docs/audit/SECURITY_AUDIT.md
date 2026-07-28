# Security Audit

Static audit of the local tree. No secret value is reproduced in this document.
No remote service was contacted.

## Result

**No Critical findings. No exposed secret material.**

The application-security posture is materially better than typical for a
pre-launch project. The controls below were verified against source, not taken
from existing documentation.

## Secret handling

| Check | Result |
|---|---|
| `.env` present on disk | **No** — only `.env.example` |
| `.gitignore` covers `.env`, `.env.*`, negates `!.env.example` | **Yes** |
| Service-role key referenced anywhere in `src/` | **No** |
| Hard-coded token / API key / private key in `src/` | **No** |
| Privileged value behind a `VITE_` prefix | **No** |
| Secret printed by any script | **No** — worker scripts compare, never echo |

All 19 `VITE_*` variables consumed by `src/` are non-secret by construction:
the project URL, the anon publishable key, two auth-provider booleans and 15
feature flags. Server-only material (`FINDIT_*_WORKER_SECRET`,
`TOUR_PROCESSOR_SECRET`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`) is referenced
only through `Deno.env.get` inside Edge Functions or `env(...)` indirection in
`config.toml`, never inlined.

`.env.example` explicitly warns against placing a service-role key in a `VITE_`
variable, and `README.md` repeats it.

**S-01 (Informational)** — `supabase/config.toml` contains a Google OAuth
**client id** in plaintext. Client ids are public by design and are exposed to
every browser during the OAuth redirect; this is not a leak. The paired secret
is correctly `env(...)`-indirected. *No action required; noted to preempt
misreporting.* *Blocks: nothing.*

## Injection and unsafe rendering

| Vector | Result |
|---|---|
| `dangerouslySetInnerHTML` | **0 occurrences** |
| `innerHTML` / `outerHTML` | **0** |
| `eval` / `new Function` | **0** |
| String-concatenated SQL in client code | **0** — all access is via the SDK or RPCs |
| Dynamic SQL in migrations | Confined to `do $$` blocks with literal identifiers |

Stored XSS is structurally prevented: user content reaches the DOM only as React
text children. There is no HTML-rendering path for user input anywhere in the
tree.

SQL injection is prevented by parameterised RPC arguments; the 116
`SECURITY DEFINER` functions all pin `search_path`, closing the
function-shadowing escalation route.

## Authentication and authorization

- Session handling is delegated to `@supabase/supabase-js` with
  `persistSession`, `autoRefreshToken` and `detectSessionInUrl`.
- `supabaseClient.js` **throws at module load** if `VITE_SUPABASE_URL` or
  `VITE_SUPABASE_ANON_KEY` is absent, and validates the URL protocol. The app
  cannot silently start against an unconfigured or non-HTTP backend.
- `ProtectedRoute` gates authenticated and `requiredRole="admin"` routes, but is
  presentation only — every admin RPC independently enforces `is_admin()` in the
  database (see DATABASE_AND_RLS_AUDIT.md). **Authorization is not
  UI-state-dependent.**
- Admin identity is bound to a SHA-256 of the founder's normalised email
  (`0030`), not a literal address; `is_founder_identity()` is revoked from
  `public`, `anon` and `authenticated`.
- Password policy in `config.toml`: minimum length 10,
  `lower_upper_letters_digits`, refresh-token rotation on, reuse interval 10s,
  anonymous sign-in **disabled**, manual identity linking **disabled**.
- Account recovery uses Supabase's native recovery flow with a dedicated
  template; `ResetPassword.jsx` handles the temporary recovery session
  explicitly rather than leaving it ambient.

**No authentication bypass, IDOR or missing ownership check was identified.**
Ownership is enforced by RLS predicates rather than by client-supplied ids.

## Edge Function hardening

`_shared/tour-runtime.ts` centralises the request guard, and every tour function
routes responses through its `json()` helper, so the controls apply uniformly:

- **Strict origin allow-list.** `Access-Control-Allow-Origin` is echoed *only*
  when the request origin is in `FINDIT_ALLOWED_ORIGINS`. **No wildcard `*`
  appears in any function.**
- **Security headers on every response**: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `Vary: Origin`.
- **Method allow-list** (`POST`/`OPTIONS`), **content-type enforcement**
  (`application/json`), and a **64 KiB request-body cap** — rejecting oversized
  bodies before parsing.
- **Constant-time secret comparison** (`constantTimeEqual`) for all worker
  endpoints, preventing timing oracles on `FINDIT_*_WORKER_SECRET`.
- **HMAC with timestamp** (`x-findit-signature`, `x-findit-timestamp`) on the
  external `tour-processing-callback`, so the processor callback cannot be
  forged or replayed indefinitely.

Every `verify_jwt = false` function performs a stronger check of its own — a
worker secret, an HMAC signature, or a `SECURITY DEFINER` eligibility RPC.
**No function is genuinely unauthenticated.**

**S-02 (Informational, F-12)** — `DEFAULT_ORIGINS` falls back to
`http://127.0.0.1:5173,http://localhost:5173` when `FINDIT_ALLOWED_ORIGINS` is
unset. This is **fail-closed** — a misconfigured production deployment blocks
browser calls rather than accepting any origin, which is the right default. It
is a deployment prerequisite, not a vulnerability.
*Blocks: production yes (must be set).*

## File upload safety

- Uploads never go directly to storage from the browser. The client requests an
  **intent** (`tour-upload-intent`, `listing-image-upload`), the server validates
  and records it, and only then is a scoped signed URL issued.
- Filenames pass through `safeFilename()`; storage paths are derived
  server-side and owner-scoped. **Path traversal is not reachable** — the client
  never supplies a storage key.
- Content type and byte size are enforced three times: bucket definition,
  Edge Function validation, and a database CHECK constraint on the intent row.
- `_shared/trusted-image.ts` performs image sanitisation, covered by
  `tests/trustedImageSanitization.test.mjs`.

## Rate limiting and abuse resistance

`config.toml` sets auth rate limits (sign-in/sign-up 30 per 5 min, token refresh
150 per 5 min, OTP verification 30 per 5 min, email 20/hour). These are
Supabase-native and apply per IP.

**S-03 (Medium)** — application-level mutations (listing creation, report
submission, message send, tour upload intent) rely on Supabase's platform limits
and per-row constraints rather than an explicit per-user quota. Constraints do
bound some abuse (`conversations_one_buyer_per_listing` prevents thread
flooding against a single listing), but there is no global "N listings per user
per hour" control. Enumeration is limited by RLS, and error bodies are
structured codes (`origin_not_allowed`, `request_too_large`) rather than raw
database errors, so no schema detail leaks.

*Evidence:* no rate-limit logic in `src/services/*` or the non-worker Edge
Functions beyond input validation.
*Impact:* a determined authenticated user could generate bulk content faster
than a human, raising moderation and storage cost. Not a data-exposure risk.
*Correction:* add per-user, per-window counters in the existing
`SECURITY DEFINER` mutation RPCs, where the check cannot be bypassed.
*Blocks: GitHub no, fresh Supabase no, staging no, production — recommended before public launch.*

## Logging

No `console.log` of tokens, session objects, emails or passwords was found in
`src/`. Edge Functions log correlation IDs and bounded error codes
(`error.message.slice(0, 120)`), not payloads. `shouldSample()` keeps
observability output bounded.

## Dependency vulnerabilities

`npm audit` — 8 high severity, in two clusters:

**S-04 (Low, F-06)** — `react-router` 7.12.0–8.2.0, advisory
GHSA-qwww-vcr4-c8h2: "RSC Mode CSRF Bypass Allows Action Execution Before 400
Response". Installed: `react-router-dom` 7.18.1 (a runtime dependency).
*Actual impact:* **low**. The advisory concerns React Server Components mode.
This application is a client-rendered Vite SPA using `BrowserRouter` with no RSC,
no server actions and no framework data router, so the vulnerable path is not
reachable. It nevertheless fails any CI step running `npm audit`.
*Correction:* upgrade when a fixed 7.x is published. **Do not run
`npm audit fix --force`** — it downgrades to 7.11.0, a breaking change.
*Blocks: nothing today; revisit before production.*

**S-05 (Low, F-07)** — `brace-expansion` ≤5.0.7 DoS (GHSA-mh99-v99m-4gvg),
reached only through `eslint` → `minimatch` → `@eslint/config-array` and
`eslint-plugin-react`. **Dev-only; not in the production bundle.**
*Correction:* upgrade ESLint when a non-breaking fix lands.
*Blocks: nothing.*

## Destructive operations

Admin destructive actions (`remove` on listings/services, user ban) all require
a 3–1000 character reason via `require_admin_reason()`, are wrapped in
`select … for update`, and are recorded in `audit_logs` with before/after
snapshots. Report rows are detached (`set listing_id = null`) before a listing
delete rather than cascade-destroyed, preserving the moderation trail.

`audit:product-surface` reports **0 findings**, including no `window.confirm`
usage — destructive UI actions use the application dialog system.

## Summary table

| ID | Severity | Finding | Blocks production |
|---|---|---|---|
| S-01 | Info | OAuth client id in `config.toml` (public by design) | No |
| S-02 | Info | CORS defaults to localhost when unset (fail-closed) | Yes — must configure |
| S-03 | Medium | No application-level per-user rate limiting | Recommended |
| S-04 | Low | `react-router` advisory, RSC path not exercised | No |
| S-05 | Low | `brace-expansion` advisory, dev-only | No |

Nothing here blocks GitHub import or connection to a fresh Supabase development
project.
