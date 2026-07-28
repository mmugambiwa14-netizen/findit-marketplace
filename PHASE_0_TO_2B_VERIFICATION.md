# Phase 0-2B Verification Report

Date: 2026-07-17  
Authoritative input: `findit-phase2b-registration-reset.zip`  
Archive SHA-256: `3AB4B526101413DF7F0844D2A8C3241625632CEBA96AEC9665E20438C8F45352`

> **Document 3 addendum (2026-07-17):** the report below preserves the
> authoritative archive verification result. Subsequent bounded work corrected
> the migration `0004` trigger source, made listing views security-invoker,
> enabled RLS on all 41 exposed tables, protected managed user fields, hardened
> support inserts, removed the 155 lint errors, and remediated the dependency
> lockfile audit. A later clean local reset applied all 12 migrations, database
> lint found no schema errors, 22 focused pgTAP assertions passed, and a local
> Auth API signup/confirmation/login/session/logout/recovery smoke flow passed.
> These changes are tracked in `BUG_INVENTORY.md` and `QA_STATUS.md`; they do
> not retroactively change the archive-at-upload findings or establish shared
> production verification.

> **Phase 2C addendum (2026-07-17):** subsequent current-code work removes
> the archive-era `ProtectedRoute` Base44 role check in favour of the existing
> Supabase database role predicates, and fixes the two archive-era reset-page
> findings by requiring a recorded `PASSWORD_RECOVERY` event and handling
> lookup rejection. The archive findings below remain historical; current
> evidence and the remaining browser/hybrid limitations are tracked in
> `MIGRATION.md`, `QA_STATUS.md`, and `BUG_INVENTORY.md`.

> **Document 4 addendum (2026-07-17):** the final deliverables and definition
> of done are now reviewed and represented by the current handover reports.
> This archive verification remains historical; those reports record that the
> migration is not release-ready until their production evidence gates pass.

## Scope

This report verifies the completion claims for Phase 0, Phase 1, Phase 2A,
and Phase 2B against the supplied archive. It does not treat the presence of
Base44 code as a failure by itself. Remaining dependencies are classified by
their planned migration phase in `BASE44_DEPENDENCY_MAP.md`.

Evidence reviewed:

- `FindIt_Technical_Audit.md`, `MIGRATION.md`, and all files under `docs/`.
- All twelve SQL files under `supabase/migrations/`.
- `src/services/authService.js`, `src/lib/supabaseClient.js`,
  `src/lib/AuthContext.jsx`, `src/components/ProtectedRoute.jsx`, and the
  login, registration, recovery, logout, blocked-account, admin-navigation,
  user-administration, and phone-verification code.
- Base44 client/bootstrap code, all 40 entity definitions, all 59 function
  implementations, all three agent definitions, route registration, build
  configuration, and feature flags.
- Specification Document 2 was subsequently reviewed against this same
  baseline. Its architecture, security, environment, and storage findings are
  recorded in `DOCUMENT_2_COMPLIANCE_REVIEW.md` and the linked `docs/`
  inventories; it does not change the phase verdicts below.

No production Base44 tenant, data export, Supabase project, configured auth
provider, email inbox, or staging credentials were supplied. No live behavior
or data state is inferred from source.

## Verdict

| Phase | Documentation claim | Verified verdict | Reason |
|---|---|---|---|
| Phase 0 | Complete | **Incomplete under MD1** | The technical audit exists, but all five mandatory MD1 discovery documents were absent from the archive. They are added by this review. Production behavior, data, storage, and provider evidence remain unknown. |
| Phase 1 | Complete | **Implemented in source; failed verification** | Twelve additive migrations and the Supabase client scaffold exist. Migration `0004` declares a trigger function with a formal argument, which PostgreSQL does not allow for trigger functions. RLS also has critical authorization gaps. The chain has never been applied to a fresh database. |
| Phase 2A | Done | **Code implemented; operational completion not verified** | Supabase session/login/logout code exists and the frontend builds. Live QA was explicitly not run. Supabase login does not establish the Base44 token still required by protected admin and many user workflows. |
| Phase 2B | Done | **Code implemented; operational completion not verified** | Supabase signup, confirmation resend, password recovery, and phone metadata capture exist. Migration `0012` has not been applied, recovery timing is untested, and remaining phone/function workflows still require a Base44 session that Supabase signup does not create. |

The labels "done" and "complete" in the earlier documents therefore mean
source implementation only. They must not be used as production or staging
verification claims.

## Verification gates

Commands were run from an isolated extraction of the authoritative archive
after installing the archive's own lockfile.

| Gate | Result | Evidence / limitation |
|---|---|---|
| Dependency install | Pass with warnings | 632 packages installed. npm reported 23 untriaged vulnerabilities (1 low, 12 moderate, 10 high). No automatic audit fix was run. |
| Production build | **Pass** | `npm run build` exited 0. Base44 plugin reported that its proxy was not enabled because `VITE_BASE44_APP_BASE_URL` was unset. |
| Lint | **Fail** | `npm run lint` reports 155 errors, all unused imports, across legacy and migration-touched files. |
| Type checking | **Fail** | `npm run typecheck` reports 2,277 error lines: 146 in `node_modules` and 2,131 across 169 source files. The current `jsconfig.json` checks JavaScript dependencies pulled into the graph and is not a clean gate. |
| SQL apply | **Not runnable locally** | Supabase CLI and `psql` are absent. Docker CLI exists but the Docker engine is not running. Static review found a confirmed trigger-function defect before a live apply could be attempted. |
| Auth browser QA | **Blocked** | No configured Supabase/Base44 staging environment, provider setup, test identities, or email inbox was supplied. |

Build success proves only that Vite can create a bundle. It does not prove
database validity, authentication delivery/redirects, authorization, or
hybrid Base44 compatibility.

## Confirmed implementation discrepancies

### D-01: Phase 0 was not complete under MD1

`MIGRATION.md` marks Phase 0 complete by pointing only to
`FindIt_Technical_Audit.md`. MD1 requires five additional discovery artifacts.
Those files were missing from the authoritative ZIP. This review adds them
without replacing the technical audit.

### D-02: Migration 0004 cannot create its trigger as written

`0004_listings.sql` declares:

```sql
create or replace function public.enforce_listing_kind(expected listing_kind)
returns trigger
```

and passes values from `create trigger ... execute function ...('car')`.
PostgreSQL requires a trigger function to be declared with no formal
arguments; trigger arguments are read from `TG_ARGV`. This is a migration
chain blocker, not a style issue. See the PostgreSQL `CREATE TRIGGER`
documentation: https://www.postgresql.org/docs/current/sql-createtrigger.html

No existing migration is edited by this verification. The correction should
be an explicitly reviewed fix before any database is treated as initialized.

### D-03: `public.users` permits owner changes to privileged columns

The policy `users_update_own_profile_fields` restricts rows to
`id = auth.uid()` but does not restrict updated columns. No `REVOKE`, narrow
column grant, or defensive trigger exists in migrations `0001`-`0012`.
Under the normal Supabase authenticated table grants, a user could attempt to
change `role`, `super_admin`, `status`, `verified`, and other protected fields
on their own row. The comment in migration `0011` recognizes this limitation,
but the promised protected functions do not close it.

This is a critical privilege-escalation risk and blocks live exposure of the
schema.

### D-04: Four public tables have no RLS

The archive creates 41 public tables and enables RLS on 37. These four are
omitted from migration `0011`:

- `user_presence`
- `support_agents`
- `ticket_templates`
- `support_settings`

Supabase recommends RLS for every table in an exposed schema. The absence
must be resolved or accompanied by explicit privilege revocation and a
documented server-only access path.

### D-05: Listing views can bypass underlying RLS

`public.cars`, `public.properties`, and `public.machinery` are created without
`security_invoker = true`, and no access revocation is present. Supabase notes
that views use their creator's permissions by default and can bypass the
underlying tables' RLS. See:
https://supabase.com/docs/guides/database/postgres/row-level-security#views

Until fixed and role-tested, the views may expose non-public listing rows.

### D-06: Several RLS policies validate identity but not relationship or fields

Static review found the following authorization/integrity gaps:

- `support_messages_create` checks only `sender_id = auth.uid()` and does not
  require the sender to participate in the referenced ticket.
- Ticket owners can update the whole support-ticket row, including operational
  fields intended for staff.
- Support attachments have a participant SELECT policy but no INSERT policy.
- `inquiries_create` does not verify that buyer, seller, and listing relate.
- Review/rating inserts do not prove a completed transaction or booking.
- A legal practitioner can update the whole practitioner row, including
  verification-controlled fields.
- Service booking/dispute participant policies omit some provider/counterparty
  access paths implied by the UI.
- Alerts have SELECT/UPDATE but no DELETE policy although the UI exposes alert
  deletion.

These require a route/service-to-policy matrix and live role tests. They must
not be patched from assumptions about production workflow.

### D-07: Entity replacement is not field-complete

All 40 Base44 entities have a proposed target table or normalized table set,
but a table name is not full contract parity. Fields present in the exported
contracts but absent from their Phase 1 target include:

- `AppAlert.listing_type`
- `Follow.seller_name`
- `Inquiry.listing_type`
- `SavedListing.listing_type` (the enum exists but is unused by the table)
- `SellerRating.listing_type`
- `AuditLog.admin_email` (potentially derivable, but no adapter/ETL exists)

Email references are also converted to UUIDs and coordinates are normalized.
No Phase 3 adapter or production ETL/reconciliation code exists in the
authoritative Phase 2B archive, so these transformations are not yet verified.

### D-08: Supabase and Base44 sessions are not bridged

`authService` creates a Supabase session. The remaining Base44 SDK client is
initialized from the separate `base44_access_token` URL/local-storage value.
No login, signup, or auth-state code exchanges or mirrors Supabase credentials
into a Base44 session.

Consequences in the current snapshot include:

- Admin route verification still calls `base44.auth.me()` in
  `ProtectedRoute`; a user authenticated only with Supabase can be denied.
- `AuthContext` invokes Base44 `ensureAdminVerified` for admins without a
  demonstrated Base44 credential.
- Twenty-six live `base44.auth.*` files still read/update the user through
  Base44.
- Phone verification calls Base44 `sendPhoneOtp` and `verifyPhoneOtp`; newly
  registered Supabase users have no demonstrated Base44 function identity.
- Listing creation and other protected workflows that call `base44.auth.me()`
  can fail after successful Supabase login.

Keeping both sets of environment variables does not establish identity
continuity. This contradicts the requirement that each intermediate phase
remain behaviorally usable. Phase 2A/2B cannot be called operationally
complete until a tested compatibility strategy or coordinated cutover exists.

### D-09: Auth error and recovery states are incomplete

- `AuthContext` converts a profile/network error into guest state, making an
  outage indistinguishable from logout.
- A suspended/banned Supabase session remains valid; the UI blocks it, but
  the current RLS policies do not check account status.
- `ResetPassword` accepts any existing Supabase session as sufficient to
  enable password update, not specifically a recovery session.
- The initial `getSession()` promise in `ResetPassword` has no rejection
  handler and can leave the screen checking indefinitely.
- OAuth handlers do not expose provider-configuration state and have limited
  async error handling.
- If email confirmation is disabled in Supabase, registration still renders
  the "check your email" flow even when signup returned a session.

These are inspection findings. Exact UX changes require staging behavior and
product acceptance before implementation.

### D-10: Documentation overstates verification

- `MIGRATION.md` marks Phase 1 and the 2A/2B subphases complete while later
  paragraphs say migrations and browser flows were not run.
- Phase 2A was started before the Phase 1 `supabase db reset` gate described
  in the same file, and Phase 2B was started before the documented Phase 2A
  live-QA precondition.
- `docs/DATABASE.md` documents only migrations `0001`-`0011` and states every
  table has RLS; the archive contains `0012`, and four tables lack RLS.
- `docs/AUTH_MIGRATION_PLAN.md` assumes there are no production users based
  only on absence of repository evidence. MD1 requires the opposite default:
  assume active users unless proven otherwise.
- The technical-audit source counts are a historical snapshot and should not
  be read as post-migration counts. The Phase 2B tree contains 294 source
  files, 80 page modules, 173 component modules, 40 entities, 59 functions,
  and three agents. There are 123 live direct imports of `base44Client`
  (plus one migration comment that mentions the path).

## Remaining Base44 dependencies by planned phase

| Dependency | Current count/state | Planned phase | Classification |
|---|---|---|---|
| Supabase auth core already cut over | Login/logout/session/signup/recovery code | 2A/2B | In Progress pending live QA and hybrid-session resolution |
| Role/admin auth and remaining auth reads | ProtectedRoute plus 26 live auth-call files | 2C/2D and 3 | Planned; currently runtime Base44 |
| Entity CRUD | 40 entity contracts, 123 direct client-import files | 3 | Planned; schema scaffold only |
| Uploads and file extraction | Base44 integrations and upload callers | 4, with extraction in 6 | Planned / AI parts Feature Flagged |
| Payments, escrow, subscriptions | Retained schema/UI/contracts | 5 | Feature Flagged |
| Functions, notifications, SMS, email, AI | 59 functions and three agents | 3/6 | Planned, Blocked by provider/evidence, or Feature Flagged as detailed in the dependency map |
| Security, policy hardening, performance | SQL/RLS/auth risks above | 7 | Blocked before exposure; fixes must precede production use |
| Deployment and removal of Base44 build/config | SDK, Vite plugin, app params, hosted config | 8 after callers are migrated | Planned |

## Stop conditions and next safe work

Do not perform production data migration, destructive schema edits, feature
deletion, Base44 package removal, or broad Phase 2C/3 implementation until:

1. The missing specification document 4 is reviewed, or its absence is
   explicitly accepted for the next bounded task.
2. A production Base44 user/data/storage inventory proves whether active users
   and records exist.
3. The SQL defects are corrected additively/reviewed, and all migrations apply
   from empty state in a local or isolated Supabase environment.
4. An anon/user/owner/participant/admin/suspended role matrix passes against
   tables, views, RPCs, and storage.
5. A staging auth environment verifies signup confirmation, login, refresh,
   logout, recovery, admin access, blocked accounts, and all still-Base44
   protected workflows.
6. Lint/typecheck baselines are triaged so new migration changes can be gated
   without silently accepting unrelated errors.

Safe additive work includes correcting discovery documentation, creating SQL
and auth integration-test scaffolding, obtaining production inventories, and
designing reviewed forward-fix migrations. No broad implementation was begun
as part of this verification.
