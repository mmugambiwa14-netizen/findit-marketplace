# Security Audit

Static source audit. No secret value is reproduced in this document.

Updated: 2026-08-10

## Result

**No Critical findings. No exposed secret material.**

The controls below are verified against source and release contracts rather than inferred from UI behavior.

## Secret handling

| Check | Result |
|---|---|
| `.env` committed | **No** — only `.env.example` |
| `.gitignore` covers `.env` and `.env.*` | **Yes** |
| Service-role key referenced in `src/` | **No** |
| Hard-coded private token/key in `src/` | **No** |
| Privileged value behind a `VITE_` prefix | **No** |
| Worker secret printed by runtime scripts | **No** |

The Supabase browser publishable/anon key is intentionally public and is not an authorization credential. Privileged server material remains behind server/Edge Function environment variables.

**S-01 (Informational)** — the Google OAuth client id in `supabase/config.toml` is public by design. The paired client secret remains environment-indirected.

## Injection and unsafe rendering

| Vector | Result |
|---|---|
| `dangerouslySetInnerHTML` | **0** |
| `innerHTML` / `outerHTML` | **0** |
| `eval` / `new Function` | **0** |
| String-concatenated client SQL | **0** |

User content is rendered through React text nodes. Database writes use the Supabase SDK/RPC boundary, and privileged database functions pin their search path.

## Authentication and authorization

- Browser sessions use Supabase Auth with refresh-token rotation.
- Missing Supabase browser configuration fails closed at module load.
- Route guards are presentation only; sensitive database operations independently authorize the caller through RLS/RPC checks.
- Anonymous sign-in and manual identity linking are disabled.
- Email confirmation is required.
- Passwords require at least 10 characters plus lowercase, uppercase, a number and a symbol in source/local Auth configuration and client validation.
- Password-change reauthentication is enabled in source configuration and is a required field in hosted Auth certification.
- Interactive account password changes also verify the current password in the application before calling `updateUser`.
- Password recovery requires a genuine Supabase recovery session and closes that recovery session after a successful reset where possible.

No client-only admin authorization, plaintext password handling, IDOR, or missing owner predicate is accepted by the release contracts.

## Edge Function hardening

Shared Edge Function guards enforce:

- exact-origin CORS rather than `*`;
- method and content-type allow lists;
- bounded request bodies;
- no-store/nosniff/referrer security headers;
- constant-time worker-secret comparison;
- timestamped HMAC verification for external processing callbacks.

Endpoints with gateway JWT verification disabled enforce their own stronger worker-secret, HMAC, eligibility, or user-context boundary.

**S-02 (Informational)** — development origin fallbacks are localhost-only and therefore fail closed in a misconfigured hosted deployment. Hosted deployment must set the exact allowed origins.

## File upload safety

- Browser uploads require a server-validated upload intent.
- Storage keys are server-derived and owner-scoped.
- Filename normalization prevents path traversal.
- MIME type and byte size are enforced at multiple boundaries.
- Listing/marketplace image buckets are private and limited to approved image MIME types and 5 MiB per object.
- Trusted-image sanitization is contract-tested.
- Upload-intent creation is rate limited by the shared abuse-budget system.

## Rate limiting and abuse resistance

Supabase Auth provides IP-based limits for sign-in/sign-up, refresh, OTP verification, email and SMS operations.

Application mutations use a database-backed token-bucket limiter in the private schema. Subjects are persisted only as SHA-256 digests, and limiter internals are not directly executable by browser roles. Existing budgets cover messages, support requests, upload intents, contact reveal events, Peek Requests, reports, business applications and managed-listing requests.

**S-03 (Resolved 2026-08-10)** — owner-controlled writes that were not covered by the original rollout are now protected by the same atomic limiter:

- listing creation: burst and daily budgets;
- substantive listing edits: burst and daily budgets;
- service creation: burst and daily budgets;
- substantive service edits: burst and daily budgets;
- supporting an existing Peek Request: burst and daily budgets;
- profile edits: hourly and daily budgets.

The triggers are actor-aware: they apply only when the authenticated user owns the affected row. Background/service/admin writes are not accidentally treated as seller activity. Passive listing/service view counters are excluded from edit budgets. High sustained ceilings preserve legitimate dealership/business ingestion while still preventing unbounded automated abuse.

## Logging and error exposure

Application and Edge Function logging avoids passwords, access tokens, session objects and whole request payloads. Public errors use bounded error messages/codes rather than stack traces or raw database details.

## Dependency security

The release pipeline runs the production dependency audit and generated-bundle security checks. Dependency advisories must be assessed against reachable runtime paths rather than fixed with unsafe forced downgrades. The release gate remains authoritative for the current dependency state.

## Destructive operations

Admin destructive actions require a reason, lock the affected row where appropriate and record auditable before/after state. User reports do not automatically remove content; takedown requires moderation action.

## Summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| S-01 | Info | Public OAuth client id in source | Expected |
| S-02 | Info | Localhost-only CORS fallback when allowed origins are absent | Fail-closed / deployment-configured |
| S-03 | Medium | Missing application mutation rate limiting | **Resolved** |

Credential-dependent hosted controls such as CAPTCHA, leaked-password checking, custom SMTP and provider settings remain verified through the exact-target Management API preflight rather than assumed from repository source.
