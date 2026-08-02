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

---

## Addendum — 2026-08-02: Pass 0B (external), Pass 3B (SSR), and live header verification

Target: `https://findit-marketplace-staging.vercel.app`.

### The decisive result: there is no server-rendered content at all

Every path tested returns a **byte-identical** static SPA shell — same ETag
`W/"cf8540d315662273f8a62c88792a581c"`, served from edge cache
(`x-vercel-cache: HIT`):

| Path | Status | Body |
|---|---|---|
| `/search?type=property` | 200 | identical shell |
| `/admin/users` | 200 | identical shell |
| `/robots.txt` | 200 | identical shell (before this change) |
| `/sitemap.xml` | 200 | identical shell |
| `/.well-known/security.txt` | 200 | identical shell |

The entire body is:

```html
<body>
  <div id="root"></div>
</body>
```

This settles several Pass 0B questions at once:

- **No JSON-LD / schema.org block exists anywhere.** Pass 0B calls
  Product/Offer/RealEstateListing markup carrying `telephone` or `email` "the
  most commonly missed contact leak on classifieds sites". This deployment has
  no structured-data block at all, so that leak is absent by construction.
- **No seller name, phone number or email appears in any HTML response.**
- **No prerender or dynamic-rendering path exists**, so there is no mechanism by
  which a crawler User-Agent could receive different content from a browser.
- The absence of `Vary: User-Agent` is therefore **not** a cache-poisoning
  vector here: nothing varies by User-Agent, because one cached static artifact
  answers every request.

### Pass 3B is not applicable — confirmed, not assumed

Pass 3B is conditional on SSR or prerendering existing. It does not. There is no
serialized state blob, no hydration payload, no inline JSON, and no server-side
Supabase client. All data loading happens in the browser against PostgREST,
where RLS is the boundary. Pass 3B is closed as N/A.

### Live header verification (Pass 4 §1–8)

The headers in `vercel.json` are confirmed live in the deployed response, not
merely configured:

`content-security-policy` with `script-src 'self'` and **no `unsafe-inline` in
script-src** · `strict-transport-security: max-age=63072000; includeSubDomains;
preload` · `x-frame-options: DENY` and `frame-ancestors 'none'` ·
`x-content-type-options: nosniff` · `referrer-policy: strict-origin-when-cross-origin` ·
`permissions-policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=()` ·
`cross-origin-opener-policy: same-origin-allow-popups` ·
`cross-origin-resource-policy: same-site` · `cache-control: no-store, max-age=0`.

### Findings

1. **No `robots.txt`, `sitemap.xml` or `security.txt` existed.** The `vercel.json`
   catch-all rewrite `"/(.*)" → "/index.html"` swallowed all three, returning
   HTML with `content-type: text/html`. A `robots.txt` has been added at
   `public/robots.txt`; the Vite plugin copies `public/` to the dist root and
   Vercel's filesystem check precedes rewrites, so it is served correctly.
   Verified present at `dist/robots.txt` after a build.

2. **`security.txt` was deliberately not added.** RFC 9116 wants absolute URLs,
   and the production web domain is not known here — a `security.txt` pointing
   at the wrong host is worse than none. The app has a suitable PII-free contact
   route at `/help/contact`. Add once the production domain is settled.

3. **Everything returns HTTP 200, including nonexistent paths** (soft-404). This
   is an SEO problem rather than a security one; for path enumeration it is
   mildly *helpful*, since status codes reveal nothing about which routes exist.

4. **`access-control-allow-origin: *` is present on every response.** This is a
   Vercel static-serving default, not something `vercel.json` sets. Severity is
   **low**: the responses are static HTML with no credentials and no
   `Access-Control-Allow-Credentials`. It is worth knowing that any JSON
   endpoint later added to this same origin would inherit it.

5. **The HTML is edge-cached (`age: 8676`) despite `cache-control: no-store`.**
   Safe as it stands, because the cached artifact contains no user data. Worth
   remembering that `no-store` here constrains the browser, not the Vercel edge.

6. **Staging is publicly reachable and returned 200 unauthenticated.** Vercel
   deployment protection appears to be off for this deployment. Pass 4 §14 wants
   it on for previews. Staging currently points at the staging Supabase project,
   which holds real seller contact records — worth enabling.

### Method limitation — stated rather than glossed

Pass 0B prescribes requesting each URL five times with different User-Agent
headers and diffing the responses. **That exact test was not run.** This
environment's network policy denies outbound HTTPS to `*.vercel.app` and
`*.supabase.co`, so `curl` cannot reach the deployment, and the two reachable
fetch paths (WebFetch and the Vercel MCP) do not permit setting a custom
User-Agent.

What was verified instead is the *mechanism*: the deployment is a single static
artifact with no server-side rendering, delivered from edge cache with a
constant ETag across unrelated paths. There is no code path capable of branching
on User-Agent. That is strong evidence, but it is inference from architecture
rather than the direct five-UA diff, and it is recorded as such. The direct test
should be run from an unrestricted network before launch.

---

## Addendum — 2026-08-02: Pass 4 and Pass 4B, client hardening and build guardrails

### Stored XSS in business profile links (fixed)

`src/pages/PublicBusinessProfile.jsx` rendered `profile.website` and every value
in `profile.social_links` — a user-controlled `jsonb` column — straight into an
anchor `href` with no scheme check.

`rel="noopener noreferrer"` was already present on both, and
`src/services/businessProfileContracts.js` does validate the scheme via
`httpUrl()`. But that validation **runs in the browser**, so it is UX rather
than enforcement: a user calling PostgREST directly with their own key could
store `javascript:alert(document.cookie)` in either column. React 18 warns about
a `javascript:` href and still renders it, leaving the link clickable — a stored
XSS reachable by any visitor to that profile.

Two layers were added:

1. **`src/lib/safeUrl.js`** — `safeExternalUrl()` parses the value with `URL`
   and returns it only when the protocol is `http:` or `https:`. Parsing rather
   than string-matching means `java\tscript:`, leading control characters and
   mixed case cannot slip past. This is the reliable boundary because it also
   covers rows written before the constraint existed.
2. **Migration `0112`** — CHECK constraints on `business_profiles.website` and
   `.social_links`. A CHECK may not contain a subquery, so the jsonb values are
   validated through an IMMUTABLE helper, `public.jsonb_values_are_http_urls`.

Proven on staging:

```
insert … social_links '{"x":"javascript:alert(document.cookie)"}'
  ERROR: 23514: new row for relation "business_profiles"
         violates check constraint "business_profiles_social_links_scheme"

insert … website 'https://example.co.zw',
         social_links '{"facebook":"https://facebook.com/legit"}'
  -> inserted
```

Applied to staging and production. Test rows removed.

### Build hardening (Pass 4B Task 1)

`vite.config.js` now states `build.sourcemap = false` explicitly (Vite already
defaulted to it; the point is that the intent survives a config edit) and adds
`esbuild: { drop: ['debugger'], pure: ['console.log','console.info','console.debug'],
legalComments: 'none' }`.

**esbuild (option A) was chosen over terser (option B)** because terser is a new
dependency and the global constraints require flagging those first. esbuild is
already Vite's default minifier, so option A costs nothing.

**No `src/lib/logger.ts` was created, deliberately.** Pass 4B asks for one to
no-op `debug`/`info`/`log` in production while keeping `error`/`warn`. A count of
the actual surface found **zero** `console.log`/`info`/`debug` calls in `src/`
and exactly **four** `console.error` calls — `AppErrorBoundary`, the `main.jsx`
bootstrap, and two in `AuthContext`. Those four are precisely what Pass 4B says
to preserve, and each logs an `Error` object rather than a token, session or
request body. A logger module here would be indirection wrapping four calls that
must not change behaviour. The `pure` list above is the forward guard: a
`console.log` added later is eliminated from production without anyone having to
remember a convention.

### Build guardrail (Pass 4B Task 6)

`scripts/verify-bundle-secrets.mjs` is new and wired into `npm run build`, so a
leak fails the build rather than shipping. It scans every
`.html/.js/.css/.json/.txt/.map` artefact in `dist/` for `service_role`,
`sb_secret_`, Stripe live/test keys, PEM private keys, AWS key ids, secrets
assigned a quoted literal, and any JWT — and fails if a `.map` file exists at all.

The Supabase publishable key is expected in the bundle and is not flagged. A
JWT is accepted **only** when its decoded payload says `role: "anon"`, so a
`service_role` JWT can never pass as "just the anon key".

Both directions were verified rather than assumed:

```
# planted a fake service_role JWT into dist/
Bundle secret scan: FAIL
  - dist/assets/index-B2JkXt2K.js: JWT with role="service_role"
exit code: 1

# after a clean rebuild
Bundle secret scan: PASS (155 build artefacts inspected, no source maps, no secret material)
```

One tuning note: the first version of the generic-secret pattern produced a
false positive on minified supabase-js
(`regenerateClientSecret:this._regenerateOAuthClientSecret.bind(this)` — a method
name, not a secret). The pattern now requires the value to be a quoted string
literal. A gate that cries wolf gets switched off, so this mattered.

### Dependabot (Pass 4 §16)

`.github/dependabot.yml` added — weekly npm and github-actions updates, with
minor/patch grouped into one PR and majors left separate. The lockfile is
already committed. The outstanding `react-router` advisory is unchanged and
still requires a decision: the fix is a breaking downgrade and the advisory is
scoped to RSC mode, which this Vite SPA does not expose.

### Already satisfied, re-confirmed

- Zero `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `document.write`,
  `eval` or `new Function` anywhere in `src/` (Pass 4 §9, §12).
- No markdown or rich-text renderer exists, so there is no raw-HTML passthrough
  to audit (Pass 4 §11).
- No `.map` files ship, now enforced by the build gate rather than by default
  (Pass 4 §13).
- Security headers verified live in the deployed response (Pass 4 §1–8), recorded
  in the Pass 0B addendum above.

### Still open from Pass 4

- **Vercel deployment protection** on preview/staging deployments (§14). Staging
  returned 200 unauthenticated while pointing at a database holding real seller
  contact records.
- **`security.txt`** (§17), pending a production domain.

---

## Addendum — 2026-08-02: Pass 6, uploads and text input

### Correction: the TRUNCATE finding was overstated

The 0110 addendum above says the stock default privileges gave "every browser
client holding the public anon key an irreversible data-destruction primitive".
**That overstates reachability and is corrected here.**

The grant was real, and TRUNCATE genuinely is not governed by RLS — the
demonstration (RLS enabled, zero policies, table truncated while acting as
`anon`) is accurate. But it was performed over a direct database connection.
An anon-key holder does not have one. Reaching `TRUNCATE` requires a path that
executes arbitrary SQL as `anon`, and none exists:

- PostgREST maps HTTP verbs to SELECT / INSERT / UPDATE / DELETE and RPC calls
  only. It has **no TRUNCATE verb at all**.
- The Storage REST API exposes no truncate operation.
- Of the 17 anon-executable functions in `public`, **zero** are SECURITY DEFINER
  and **zero** use dynamic SQL, so no RPC offers a SQL-execution path.
- The anon key is a PostgREST/Storage token, not database credentials.

So the accurate severity is **low-to-medium: unnecessary standing privilege
that violates least privilege and would become critical the moment any
arbitrary-SQL path appeared** — not "anyone can wipe your database today".
Revoking it in 0110/0111 remains correct hardening and cost nothing, but the
original framing was wrong and should not be relied on for prioritisation.

### Storage schema: same grants, cannot be revoked from here

Migration 0110 covered schema `public` only. The `storage` schema carries the
same default privilege set, and it is still in place:

```
storage.objects            anon TRUNCATE=true  INSERT=true  DELETE=true
storage.buckets            anon TRUNCATE=true  INSERT=true  DELETE=true
storage.buckets_analytics  anon TRUNCATE=true  INSERT=true  DELETE=true
```

A migration to revoke these was written, applied, and **had no effect** — the
apply reported success while the privileges were unchanged. The cause:

```
storage.objects owner: supabase_storage_admin
acl:  anon=arwdDxtm/supabase_storage_admin
current_user: postgres        pg_has_role(postgres, owner, USAGE): false
SET ROLE supabase_storage_admin -> 42501 permission denied
```

Postgres only lets the original grantor revoke a grant. These were granted by
`supabase_storage_admin`, `postgres` is not a member of that role, and REVOKE
issued by a non-grantor silently does nothing rather than erroring. The
migration was deleted rather than shipped as a no-op.

**Action required:** this needs Supabase support, or a connection as
`supabase_storage_admin`. By the reachability analysis above it is low severity
today — the Storage API has no truncate operation — but it is an open item and
should not be quietly forgotten.

### Part A — uploads: already in good shape

`supabase/functions/_shared/trusted-image.ts` was audited rather than replaced.
It parses magic bytes for PNG/JPEG/WebP, extracts real dimensions, enforces
`MAX_DIMENSION` 8000 and `MAX_PIXELS` 40,000,000 (decompression-bomb cover),
strips metadata, and re-inspects the sanitized bytes to confirm the format and
dimensions did not change.

Metadata actually removed: PNG `tEXt/zTXt/iTXt/eXIf/tIME`; JPEG APP1 (`0xE1`
— **where EXIF GPS lives**), APP13, COM, APP3–APP12, APP15; WebP `EXIF`/`XMP`
chunks with the feature flags cleared and the RIFF length repaired. Trailing
bytes after `IEND` / `EOI` are truncated, which is the polyglot case.

Storage paths are `${auth.uid()}/staging/${crypto.randomUUID()}.${ext}` —
server-generated from the verified user, never from the supplied filename. That
closes path traversal and right-to-left-override filename spoofing by
construction. Storage RLS requires `owner_id = auth.uid()` **and**
`storage.foldername(name)[1] = auth.uid()` on every INSERT, and no anon INSERT
policy exists on any bucket.

**One honest distinction: this is structural sanitisation, not re-encoding.**
Pass 6 A3 asks for a full pixel re-encode via sharp or equivalent. The
implementation rewrites container structure and drops metadata chunks; it does
not decode and re-encode pixels. That is a reasonable choice — the functions run
on Deno, where sharp is not available — and it does satisfy the privacy
requirement, since GPS EXIF is removed. The residual is narrower: a malformed
but structurally valid image that targets a decoder bug would survive, where a
re-encode would not. Recorded rather than papered over.

Existing tests already cover EXIF stripping for all three formats, trailing
payloads, server-generated owner-scoped keys, and byte/pixel bounds
(`tests/trustedImageSanitization.test.mjs`, `tests/storageUploadBoundary.test.mjs`).

### Part B — text input: this is where the gaps were

Sanitisation was **partial and inconsistent**. `messagingContracts.js` rejected
control characters, `tour-runtime.ts` stripped them server-side, and
`serviceContracts` did an NFKC pass on search queries — but `boundedText` for
listing titles and descriptions only trimmed and length-checked. Nothing
handled zero-width or bidi characters anywhere, and length was measured in
UTF-16 code units, so an emoji counted as two.

**`src/lib/sanitizeText.js`** is new and now backs both `ownerListingContracts`
and `serviceContracts`. It strips control characters (preserving tab, newline
and carriage return), zero-width characters (U+200B–U+200D, U+FEFF), and bidi
overrides (U+202A–U+202E, U+2066–U+2069); normalises to NFC *after* stripping,
so removing a control character cannot leave a base character separated from
its combining mark; collapses whitespace; and bounds length in codepoints.

**Codepoints, not grapheme clusters, is deliberate.** Postgres `char_length()`
counts codepoints, so the client bound and the CHECK constraints agree exactly.
Counting graphemes via `Intl.Segmenter` would score a skin-tone emoji as 1 and
let through a value the database then rejects.

`hasMixedScript()` covers the B2 impersonation vector that matters in practice —
a Cyrillic or Greek lookalike inside an otherwise Latin name. It does **not**
implement the full UTS #39 confusable skeleton, so same-script confusables
("rn" for "m") are not caught; that needs a confusables table and is a separate
decision about blocking versus flagging.

**Migration 0113** is the enforcement half: `char_length` bounds on
`listings.title` (1–160), `description` (≤5000), `seller_name` (≤120) and the
`services` equivalents. Proven against direct writes that bypass all client
validation:

```
title 200k chars           -> 23514 violates check constraint "listings_title_length"
title all-whitespace       -> 23514 violates check constraint "listings_title_length"
description 6000 chars     -> 23514 violates check constraint "listings_description_length"
service title 200k chars   -> 23514 violates check constraint "services_title_length"
legitimate title (control) -> accepted
```

Applied to staging and production.

Note on the price bound: `price` is `numeric(14,2)`, so the column type already
caps it below 10^12. The added `price < 1000000000000` constraint is therefore
redundant with the type rather than new protection — kept for explicitness, but
it is not the thing doing the work.

Null bytes are handled in the sanitizer rather than by a constraint, because
Postgres cannot store U+0000 in a text column at all and raises before any
CHECK runs — so a single one pasted into a form would surface as a 500 rather
than a validation message.

`tests/textSanitization.test.mjs` covers the Part C item-3 matrix: null byte,
zero-width space, RTL override and BOM stripped; emoji preserved; truncation
never splitting a surrogate pair; NFC equivalence; 200,000 characters rejected
as a `RangeError` rather than a crash; mixed-script detection.

### Part C status

| Check | Result |
|---|---|
| SVG / HTML-renamed-to-.jpg rejected | Covered by magic-byte parsing — no PNG/JPEG/WebP signature means `inspectImage` throws |
| Oversized file rejected | `MAX_BYTES` 5 MB checked against both `content-length` and `file.size` |
| Path-traversal filename | Impossible by construction — the path is `uid/staging/uuid.ext` |
| GPS EXIF removed | Covered by existing tests for all three formats |
| Text matrix (null/zero-width/RTL/emoji/200k) | `tests/textSanitization.test.mjs`, 9 tests passing |
| Anon write to a Storage bucket | **Not executed as a live curl** — this environment's network policy denies outbound HTTPS to `*.supabase.co`. Verified structurally instead: no anon INSERT policy exists on any bucket and every INSERT policy requires a non-null `auth.uid()` |
| Homoglyph registration blocked | **Not implemented.** `hasMixedScript()` exists and is tested, but it is not yet wired into registration or seller-name updates, and full confusable matching is not implemented |
