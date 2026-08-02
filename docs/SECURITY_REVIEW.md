# Security Review

Reviewed: 2026-07-26
Scope: approved FindIt V1 source, hosted staging backend and release controls

## Conclusion

No Critical code defect or reachable High production vulnerability is known in
the approved V1 surface. Base44 code, configuration, credentials, functions and
packages have been removed. The current production build and its generated text
assets contain no Base44 reference.

This is a release security review, not a penetration-test certificate.
Production launch remains blocked until SMTP, browser/session lifecycle,
monitoring, native recovery, the GitHub Actions startup restriction and any
legacy-data decision are resolved.

## Evidence

- All 30 migrations are deployed to staging; all 49 public tables have RLS.
- Hosted adversarial suites pass for Auth, account state, ownership,
  participant isolation, admin authorization, audit evidence, essential
  notifications, private media and independently authenticated workers.
- Two private Storage buckets and four Edge Functions are deployed.
- Upload functions validate actual JPEG/PNG/WebP bytes, MIME, byte count,
  dimensions, hash, owner path and rate limits; common privacy metadata and
  trailing payloads are stripped before storage.
- Browser roles are limited to user and admin. Business and dealer are profile
  types; exceptional super-admin operations use narrow server-side checks.
- Admin mutations require reasons and write result/correlation audit evidence.
- Production dependency audit finds no reachable Moderate, High or Critical
  advisory. The acknowledged React Router advisory requires an RSC/server-action
  surface, which this Vite SPA does not expose.
- A clean checkout passes lint, full and scoped typechecks, 78 source contracts,
  environment validation, Base44 elimination, production build and bundle
  budgets.
- Hosted fixtures are disposable and are removed by every acceptance suite.

## Finding disposition

| ID | Original risk | Final V1 disposition |
|---|---|---|
| SEC-001 | Managed role/status self-update | Closed: trigger and narrow audited operations enforce managed fields. |
| SEC-002 | Missing RLS | Closed for V1: all 49 public tables have RLS; Storage has explicit private policies. |
| SEC-003 | Owner-semantic listing views | Closed: views use `security_invoker = true`; adversarial reads pass. |
| SEC-004 | Invalid trigger/policy migration | Closed: corrected chain deploys and lints through `0029`. |
| SEC-005 | Supabase/Base44 identity mismatch | Closed by Base44 source/runtime elimination. |
| SEC-006 | Account controls | Closed for hosted V1 API; deployed browser expiry/recovery matrix remains a launch test. |
| SEC-007 | Relationship authorization | Closed for V1 messaging and marketplace relationships; future rich support needs a new design. |
| SEC-008 | Verification self-review | Removed from V1; legacy legal/verification browser grants are denied. |
| SEC-009 | Privileged Base44 browser calls | Closed by source deletion. |
| SEC-010 | Hard-coded super-admin bootstrap | Closed by source deletion and controlled Supabase authorization. |
| SEC-011 | Untrusted uploads | Closed for approved V1 image classes; malware scanning/derivatives remain future hardening. |
| SEC-012 | Abuse controls | Partially mitigated with database/function limits; production gateway/CAPTCHA and alerting remain required for anonymous support and Auth abuse. |
| SEC-013 | Dependency advisories | Closed for reachable production code; retain the documented RSC-only exception review. |
| SEC-014 | Best-effort privileged audit | Closed for V1 admin operations; future external side effects should use an outbox. |
| SEC-015 | URL/local-storage Base44 tokens | Closed by source and build elimination. |
| SEC-016 | Password recovery proof | Source mitigation complete; valid/expired/replayed/multi-tab browser testing remains. |
| SEC-017 | Inconsistent validation | Trusted database/function boundaries validate sensitive operations; shared client schemas remain technical debt. |
| SEC-018 | Silent UI error handling | Active paths were reduced and reviewed; centralized production telemetry remains operational work. |
| SEC-019 | CSS/chart injection | Closed by primitive removal with the unused chart surface. |
| SEC-020 | Misleading ticket attachments | Closed by deletion; V1 Contact Support has no attachment path. |
| SEC-021 | Broad type coverage | Closed: full `npm run typecheck` passes. |
| SEC-022 | Excess function execution grants | Closed by `0027` exact allowlists and hosted authorization checks. |
| SEC-023 | Legal-domain exposure | Closed for V1 by `0028`; legal functionality is absent. |
| SEC-024 | Deferred-commerce exposure | Closed for V1 by `0029` and production-off feature enforcement. |

## Authentication and authorization

Supabase Auth is the only identity provider boundary. Public reads use explicit
projections and publication filters. Authenticated ownership and relationship
checks are enforced by RLS or narrow security-definer RPCs. Client metadata does
not grant admin access. Suspended accounts are denied protected operations.

Production must use a real SMTP provider, approved redirect URLs and rate
limits. Google/Apple OAuth must remain disabled until credentials, callback
domains and lifecycle tests are complete. No service-role key may enter a
browser variable or build.

## Storage and workers

`listing-media` and `marketplace-media` remain private. Metadata rows, generated
paths and signed delivery form the authorization boundary. Cleanup and expiry
workers require independently rotated secrets as well as the public project
key; browser-key, missing-key and mixed-key requests are denied.

GitHub contains the required worker secrets and schedules, and hosted worker
behavior passes direct acceptance. GitHub currently returns
`startup_failure` before creating workflow jobs, so schedules are not
operational until that account-level restriction is resolved.

## Residual production risks

1. No deployed frontend browser evidence exists for confirmation, recovery,
   refresh, revocation, responsive layout, accessibility or deep links.
2. Production SMTP, optional OAuth, alert destinations and incident ownership
   are not configured.
3. Native isolated restore/PITR evidence and approved RPO/RTO are absent.
4. No Base44 production data or object export was supplied. Use a fresh launch
   unless an export is later reconciled through a separately tested process.
5. Anonymous Contact Support and Auth endpoints require production gateway
   abuse controls and observable denials.
6. A separate production Supabase project, domain, DNS/TLS and final secret
   rotation are still required.

## Release decision

The repository and hosted staging backend meet the approved V1 engineering
security bar. Do not onboard real users until every residual production risk
above is accepted or closed and the checklist in
`PRODUCTION_READINESS_REPORT.md` is signed.

---

## Addendum — 2026-08-02: seller contact boundary and RLS-bypassing grants

Two issues were found on staging (`bwgklpxoetrrkutottdb`) during an
authorization audit and fixed in migrations `0109`–`0111`.

### 1. Seller contact details were readable by `anon` (Critical)

`public.listings` and `public.services` carry `contact_phone`,
`contact_whatsapp` and `contact_email`. RLS is row-level, so the
`listings_public_read_available` / `services_public_read_active` policies
combined with SELECT grants exposed every published seller's contact record to
anyone holding the public anon key.

Verified before the fix, acting as `anon`: 11 listings visible, 10 with phone,
11 with email, 10 with WhatsApp; 5 services, all 5 with phone.

**Rules now in force**

- `anon` holds **no** column grant on `contact_phone`, `contact_whatsapp` or
  `contact_email` on either table.
- `public.listings` and `public.services` expose generated
  `has_contact_phone` / `has_contact_whatsapp` / `has_contact_email` booleans
  instead, so cards can render Call/WhatsApp/Email affordances without the
  values.
- Actual values are returned **only** by `public.reveal_listing_contact(uuid)`
  and `public.reveal_service_contact(uuid)`. Both are `SECURITY DEFINER` with
  `search_path = ''`, require an authenticated active account, verify the
  subject is publicly visible or owned by the caller, enforce a rolling 24h
  budget of 40 reveals per account, and append to
  `public.contact_reveal_events`. Neither is executable by `anon`.
- `services` uses an explicit column allowlist rather than a table-level SELECT
  grant, matching how `listings` was already configured. The allowlist is
  generated from the live column list, so a column added later is **not**
  exposed until it is deliberately granted.
- `authenticated` retains the contact column grant because the owner edit flow
  reads a seller's own values directly. Every such query is scoped to
  `seller_id` / `provider_id`. Closing this too requires routing owner reads
  through an RPC and remains open.

### 2. `anon` and `authenticated` held TRUNCATE on every public table (Critical)

TRUNCATE is **not** governed by row level security. Postgres checks the
table-level privilege and empties the table; policies are never consulted. The
stock Supabase default privilege set (`grant all on tables to anon,
authenticated, service_role`) therefore gave every browser client an
irreversible data-destruction primitive on all 43 granted tables, including
`users`, `listings`, `services` and `audit_logs`.

Demonstrated on staging before the fix: a table with RLS **enabled** and
**zero policies** — the most restrictive configuration available — was
truncated successfully while acting as `anon`. Row count went 1 → 0.

**Rules now in force**

- `TRUNCATE`, `TRIGGER` and `REFERENCES` are revoked from `anon` and
  `authenticated` on every table in `public`, and removed from the default
  privileges for role `postgres` so new tables do not inherit them.
- `INSERT` / `UPDATE` / `DELETE` are revoked from `anon` entirely. Every write
  policy in this schema requires `is_active_user()` or a non-null
  `auth.uid()`, so anonymous writes were dead privilege; removing them means a
  future policy mistake cannot become an anonymous write.
- `SELECT` / `INSERT` / `UPDATE` / `DELETE` for `authenticated` are unchanged —
  those are the operations RLS does govern.
- `service_role` is deliberately untouched; it is the trusted server-side role
  and bypasses RLS by design.

**Standing rule:** RLS is necessary but not sufficient. When adding a table,
confirm the privilege grants as well as the policies — `has_table_privilege`,
not just `pg_policies`.

### Applied to production

Both issues were confirmed present on production (`jvbpxnfxkptuexgssplj`) and
have been fixed there as well:

- 40 tables granted TRUNCATE to `anon` and to `authenticated`.
- `anon` held SELECT on the contact columns of `listings`, and a table-level
  SELECT grant on `services`.

Production was empty at the time of the fix (0 users, 0 listings, 0 services),
so no live data was ever exposed through these defects and no migration
carried a data risk. Production is pre-launch; fixing before onboarding is the
correct order.

Production differs from staging (63 tables vs 88, and a `public.is_admin()`
without the `private` schema indirection), so migration `0109` creates the
`private` schema idempotently rather than assuming it exists. No USAGE on that
schema is granted to `anon` or `authenticated`.

Verified on production after the change: `anon` denied on all contact columns
and both reveal RPCs; `authenticated` retains EXECUTE; TRUNCATE 40 → 0 for both
browser roles; `anon` INSERT/UPDATE/DELETE → 0; all public tables still have
RLS; `service_role` TRUNCATE preserved; a newly created table inherits SELECT
but neither TRUNCATE nor INSERT.

### Deployment ordering

The production database no longer serves `contact_phone`, `contact_whatsapp` or
`contact_email` to `anon`. A frontend build older than this commit still asks
for those columns in its public listing projection and will fail that query for
logged-out visitors. Deploy this commit before opening production to traffic.

---

## Addendum — 2026-08-02: Pass 2, authentication and session lifecycle

Audit of the auth surface. Only one code change was made; the remainder is
either already correct, a dashboard setting, or a gap recorded below.

### Verified correct (evidence, not assumption)

| Item | Evidence |
|---|---|
| Logout revokes refresh tokens globally | `supabase.auth.signOut()` already defaults to `{ scope: 'global' }` (auth-js `GoTrueClient.js:3350`). Now stated explicitly at `src/services/authService.js` so a future default change cannot downgrade it. |
| Server-side token validation uses `getUser()` | All five server call sites verify against the auth server: the four upload functions and `_shared/recommendation-service.ts:154`. `getSession()` appears only in browser code, where it is correct. |
| Admin authority is not from `user_metadata` | `private.is_admin()` reads `public.users` (role + super_admin + hashed founder identity). No policy or function reads `raw_user_meta_data`. |
| Privileged user columns are trigger-protected | `protect_user_managed_fields` rejects self-writes to role, super_admin, verified, status, email and phone fields; `protect_founder_admin_identity` rejects any admin claim not matching the hashed founder email. |
| Admin audit log is append-only | `audit_logs` has exactly one policy — SELECT gated on `private.is_admin()`. No client INSERT/UPDATE/DELETE policy exists; writes happen only inside SECURITY DEFINER functions. `anon` now holds no write privilege at all (migration 0111). |
| Open-redirect protection | `sanitizeReturnTo` (`src/lib/authNavigation.js`) requires a leading `/`, and rejects protocol-relative `//` and backslashes. All `returnTo` producers route through it. |
| Anonymous sign-in disabled | `enable_anonymous_sign_ins = false`. |
| Email confirmation appears enforced | staging `auth.users`: 4 users, 0 with `email_confirmed_at` null. |

### Open gaps

1. **The client uses the implicit flow, not PKCE.** `createClient` does not set
   `flowType`, and auth-js defaults to `implicit` (`GoTrueClient.js:24`).

   This is **not** a one-line fix. The recovery and confirmation templates use
   `{{ .ConfirmationURL }}` and the app relies on `detectSessionInUrl`; there is
   no `verifyOtp` / `token_hash` handling anywhere in `src/`. Setting
   `flowType: 'pkce'` alone turns those emails into `?code=` links that require
   the PKCE verifier from the localStorage of the browser that *requested* the
   reset — so a user who requests a reset on their phone and opens the email on
   a laptop would be unable to complete it.

   The complete migration is three coordinated changes:
   - templates switch from `{{ .ConfirmationURL }}` to `{{ .TokenHash }}`,
     linking to a route such as `/auth/confirm?token_hash=…&type=recovery`;
   - a new route calls `supabase.auth.verifyOtp({ token_hash, type })`;
   - only then set `flowType: 'pkce'`.

   The template half must be applied to the **hosted** project in the dashboard
   — repo templates under `supabase/templates/` govern local dev only. Because
   the template change cannot be made from here, PKCE was deliberately left off
   rather than shipped half-applied.

2. **No admin MFA.** staging `auth.mfa_factors` is empty — 0 enrolled, 0
   verified. Pass 2 also requires checking the AAL claim server-side on admin
   actions; no such check exists today.

3. **No account deletion or anonymisation flow.** Nothing in `src/` or the
   migrations implements it.

4. **No CAPTCHA.** `[auth.captcha]` is commented out in `supabase/config.toml`,
   and `[auth.rate_limit]` carries no overrides.

5. **No email-change flow exists.** `updateUser` is called only for password
   changes, so the "confirm at both old and new address" requirement has no
   surface to apply to yet. `email_change.html` exists but is unused. Worth
   configuring before the flow is built.

### Dashboard settings to confirm on both projects

`supabase/config.toml` governs **local development only**. The hosted staging
and production projects are configured in the dashboard, and the values below
were not verifiable from this environment.

| Setting | Where | Target |
|---|---|---|
| Access token (JWT) expiry | Authentication → Sessions | Consider 1800s. `config.toml` has 3600s locally; a marketplace holding identity data benefits from a shorter window, because signOut cannot revoke an already-issued JWT. |
| Refresh token rotation + reuse interval | Authentication → Sessions | Rotation on. Local config has rotation on with a 10s reuse interval. |
| Inactivity timeout / time-boxed sessions | Authentication → Sessions | Set one. (Pro plan feature.) |
| Leaked password protection (HaveIBeenPwned) | Authentication → password policy | Enable. |
| Minimum password length | Authentication → password policy | ≥10. Local config already sets 10. |
| Confirm email | Authentication → Providers → Email | Required before transacting. |
| CAPTCHA (Turnstile or hCaptcha) | Authentication → bot/abuse protection | Enable for signup, login and reset. |
| MFA / TOTP | Authentication → Multi-Factor Authentication | Enable, enrol every admin, and check AAL server-side. |
| Redirect URL allowlist | Authentication → URL Configuration | Exact production and preview URLs only. Local config lists localhost, the staging Vercel host and the GitHub Pages host — production is not in that list. |
| Email templates | Authentication → Emails | Required for the PKCE migration above. |

### Not verified from this environment

The live checks Pass 2 asks for — identical body and timing for reset requests
against a registered vs unregistered email, single-use and expired reset links,
and cross-device session revocation — could not be run. This environment's
network policy denies outbound HTTPS to `*.supabase.co`, so the auth REST
endpoints are unreachable from here (the Supabase MCP tooling reaches the
database by a different path). These remain **unverified**, not passing.

---

## Addendum — 2026-08-02: Pass 3, API surface, secrets and server-side trust

No code changes were required. The server-side layer is sound; the findings are
one correction to an earlier report and one genuine gap.

### Verified correct

| Item | Evidence |
|---|---|
| No `service_role` reachable from the browser | Zero hits in `src/`. Production build scanned for `service_role`, `sk_live`, `sk_test`, `BEGIN PRIVATE KEY`, `sb_secret_` and JWT-shaped strings — zero hits. The only key in the bundle is `sb_publishable_…`, which is public by design. |
| No secrets in git history | `git log --all -p` scanned for service-role assignments, `sb_secret_`, `sk_live_` — zero hits. Only `.env.example` was ever committed; no real `.env` appears in any commit. |
| Webhook signature verification | `tour-processing-callback` computes HMAC-SHA256 over `{timestamp}.{rawBody}` and compares with `constantTimeEqual`, returning 401 on mismatch. |
| Webhook replay protection | The same handler rejects any callback whose `x-findit-timestamp` is more than 300s from now. |
| Webhook idempotency | Duplicate `processor_job_id` + terminal status returns `{ duplicate: true }` without re-applying. |
| CORS is allowlisted, not reflected | `allowedRequestOrigin()` matches against `FINDIT_ALLOWED_ORIGINS` plus defaults and omits `Access-Control-Allow-Origin` entirely when unmatched. `Vary: Origin` is set. Local preview origins are permitted only when the Supabase URL is the local kong address. |
| No mass assignment | Zero `.insert({...spread})` / `.update({...spread})` patterns. `normalizeServiceEdit` rejects unknown keys with a thrown error; `normalizeOwnerListingUpdate` assigns each field explicitly. |
| No SSRF surface | The only outbound `fetch` calls target `TOUR_PROCESSOR_URL` and `TOUR_CACHE_PURGE_URL` — environment-derived and HMAC-signed. No user-supplied URL is ever fetched. |
| Logging hygiene | No `console.*` call in any Edge Function logs an authorization header, token, session, password or request body. |
| Error shape | Handlers return a generic message plus a `requestId` / `correlationId`. No stack traces, SQL text or table names are returned. |
| Elevated privilege is scoped | `service_role` clients are used only after authorization has already been established, or behind an RPC that enforces its own predicate. |

### Correction to the Pass 0 report

Pass 0 listed `tour-playback-access` as HIGH — "uses `service_role` with no caller
auth". That was **overstated**, and reading the code and the RPC corrected it:

- The function calls `public.public_tour_metadata`, which is `SECURITY DEFINER`
  and filters on `public.is_tour_public_eligible(t.id)` plus the tours backend
  feature flag. It returns only publicly eligible tours, so the endpoint serves
  public data by design — comparable to a public listing photo.
- `public_tour_metadata` is not executable by `anon` or `authenticated`, which is
  why the function needs an elevated client at all.
- `tour-admin-review-access` was also mis-flagged by the same grep. It requires a
  bearer token, calls `admin_tour_review_metadata` through a **user** client so
  the caller's JWT and RLS apply, and uses the elevated client only to sign URLs
  for paths the RPC already authorized. `private.admin_tour_review_metadata`
  opens with `if not public.is_admin() then raise exception … 42501`.

The `getUser` grep used in Pass 0 does not detect authorization performed via
RPC + RLS, which is the dominant pattern here. Residual note: `tour-playback-access`
mints signed URLs without authentication, so it is a rate-limiting and
enumeration concern rather than an authorization defect.

### Open gap

**Rate limiting is thin.** Only `tour-upload-intent` and the shared
recommendation service implement request budgets. Contact reveal is now capped
at the database level (40 per account per rolling 24h, migration 0109). Listing
creation, messaging and search reach PostgREST directly from the browser, so
they have no application-level limit — any control has to live in the database
or at a gateway.

Deliberate numbers were **not** invented for these. This repository supports
dealer/bulk-seller accounts, so an arbitrary listing-creation cap risks breaking
a legitimate use case. The limits are a product decision and are left for a
decision rather than guessed at.

### Note on schema validation

`zod` is not a dependency. Validation is hand-rolled in `src/services/*Contracts.js`.
For the mass-assignment property that matters, the hand-rolled version is
*stricter* than a default zod schema: `normalizeServiceEdit` throws on unknown
keys rather than stripping them. Adding zod would be a consistency improvement,
not a security fix, and would be a new dependency.

### Deferred to Pass 6

Pass 3 §17–23 (file uploads) are intentionally not covered here. The overlap map
makes Pass 6 Part A authoritative for uploads, EXIF stripping and re-encoding.
