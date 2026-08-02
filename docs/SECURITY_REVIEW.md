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
