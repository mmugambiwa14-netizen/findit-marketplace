# Authentication Migration Plan — Base44 → Supabase

**Status:** Phase 2A–2D implementation is complete for approved V1. Supabase
Auth is the only identity boundary and all Base44 Auth/client source has been
removed. Hosted targeted acceptance covers signup, profile creation, sign-in,
RLS account-state enforcement and logout; recovery source/API boundaries are
verified. The current source distinguishes guest, blocked, missing-profile and
provider-unavailable states; Login/Register await OAuth initiation; Register
handles confirmation and immediate-session responses. Production SMTP and
deployed-browser confirmation/recovery/refresh/revocation acceptance remain
launch gates. The remainder of this document is retained as the historical
cutover plan and evidence trail.
See
`../PHASE_0_TO_2B_VERIFICATION.md`, `../QA_STATUS.md`, and
`../BUG_INVENTORY.md` before advancing beyond this checkpoint.

Related docs: [`../MIGRATION.md`](../MIGRATION.md) ·
[`DATABASE.md`](DATABASE.md) · [`FEATURE_FLAGS.md`](FEATURE_FLAGS.md)

---

## 1. Existing auth flow (Base44) — as built today

Everything below was confirmed by reading the actual Phase-1 codebase, not
assumed.

**Client:** `src/api/base44Client.js` creates a single `base44` SDK instance
from `appParams` (`src/lib/app-params.js`), which reads `app_id` /
`access_token` from either the URL or `localStorage` (`base44_*` keys).

**Session bootstrap (`src/lib/AuthContext.jsx`):**
1. On mount, `checkAppState()` hits `/api/apps/public/prod/public-settings/by-id/:appId`
   via a raw axios client (`createAxiosClient` from the Base44 SDK internals)
   to fetch app-level public settings and detect `auth_required` /
   `user_not_registered` errors.
2. If a token is present, `checkUserAuth()` calls `base44.auth.me()`.
3. `me()` result drives three states: normal user, `blockedAccount`
   (`status === 'suspended' | 'banned'`, with `ban_reason`/`ban_until`), or
   guest (request failed → treated as unauthenticated, not an error).
4. Admins get an extra side-effect: `base44.functions.invoke('ensureAdminVerified')`
   fires-and-forgets on every auth check.

**Login (`src/pages/Login.jsx`):** `base44.auth.loginViaEmailPassword(email, password)`,
then `base44.auth.me()` to decide redirect target (`/admin` vs `/`). Also
`base44.auth.loginWithProvider('google' | 'apple', redirectPath)` for OAuth.

**Registration (`src/pages/Register.jsx`):** `base44.auth.register({ email, password })`
→ shows a 6-digit OTP screen → `base44.auth.verifyOtp({ email, otpCode })` →
if it returns `access_token`, `base44.auth.setToken(...)` is called manually
→ `base44.functions.invoke('setUserPhone', { phone })` (best-effort, doesn't
block signup) → hard redirect to `/`. `base44.auth.resendOtp(email)` for resend.

**Forgot / reset password:** `ForgotPassword.jsx` calls
`base44.auth.resetPasswordRequest(email)` (always shows success regardless of
outcome — deliberate email-enumeration protection, must be preserved).
`ResetPassword.jsx` reads a `?token=` query param and calls
`base44.auth.resetPassword({ resetToken, newPassword })`.

**Logout:** `base44.auth.logout(redirectUrl)` (clears token + redirects) or
`base44.auth.logout()` (clears token only) — called from `AuthContext.logout()`,
`AdminSidebar.jsx`, `AdminSidebarCollapsible.jsx`, and `AccountBlocked.jsx`.

**Protected routes (`src/components/ProtectedRoute.jsx`):** reads
`isAuthenticated` / `isLoadingAuth` / `authChecked` / `authError` from
`useAuth()`. If a `requiredRole` prop is set, it makes a **second**,
independent `base44.auth.me()` call to re-verify the role server-side rather
than trusting the client-cached user object — this is the pattern
`is_admin()`/`is_super_admin()` (Postgres `SECURITY DEFINER`, already shipped
in `0011_rls_policies.sql`) is designed to replace.

**Admin / role checks:** role is read off `user.role` (`'user' | 'admin'`)
in `AdminSidebar.jsx`, `AdminSidebarCollapsible.jsx`, `AdminUsers.jsx`, and
implicitly through `ProtectedRoute`'s `requiredRole` prop wherever it's used
in the router. `super_admin` is a separate boolean, not currently branched on
in the frontend (checked in the audit — it's enforced today only by the
`ensureAdminVerified` function and will be enforced by `is_super_admin()` in
Supabase).

**Phone verification (`RequirePhoneVerification.jsx`):** a soft gate (not a
route guard) shown only at listing-creation entry points when
`user.phone_verified === false`. Uses its own OTP functions
(`sendPhoneOtp` / `verifyPhoneOtp`), separate from the email OTP in
`Register.jsx`. Out of scope for Phase 2 — it depends on an SMS provider
decision, tracked separately.

**Account blocked (`AccountBlocked.jsx`):** rendered by `AuthContext`'s
`blockedAccount` state, not by `ProtectedRoute` — a suspended/banned user
still "authenticates" at the Base44 level, the block is an app-level status
check on top.

**Full inventory — every file with a live `base44.auth.*` call (34 files,
confirmed by grep, not estimated):**

| Call | Files |
|---|---|
| `.me()` | `ProtectedRoute.jsx`, `AuthContext.jsx`, `CurrencyContext.jsx`, `PageNotFound.jsx`, `CsvWizard.jsx`, `LegalBookingModal.jsx`, `MessageDialog.jsx`, `SupportTicketChat.jsx`, `CreateListing.jsx`, `Login.jsx`, `MyListings.jsx`, `MyTickets.jsx`, `PractitionerSignup.jsx`, `SupportHub.jsx`, `SupportTickets.jsx`, `TicketDetailUser.jsx`, + React-Query `queryFn` one-liners in `BusinessOwnerDashboard.jsx`, `BusinessProfiles.jsx`, `Inquiries.jsx`, `LegalPractitionerProfile.jsx`, `NotificationCenter.jsx`, `PractitionerDashboard.jsx`, `SellerProfile.jsx`, `Settings.jsx`, `TransactionHistory.jsx`, `AdminUsers.jsx` |
| `.logout()` | `AuthContext.jsx`, `AdminSidebar.jsx`, `AdminSidebarCollapsible.jsx`, `AccountBlocked.jsx` |
| `.loginViaEmailPassword()` / `.loginWithProvider()` | `Login.jsx` |
| `.register()` / `.verifyOtp()` / `.setToken()` / `.resendOtp()` / `.loginWithProvider()` | `Register.jsx` |
| `.resetPasswordRequest()` | `ForgotPassword.jsx` |
| `.resetPassword()` | `ResetPassword.jsx` |
| `.redirectToLogin()` | `AuthContext.jsx`, `ServiceLikeButton.jsx` |
| `.updateMe()` | `SellerProfileFields.jsx`, `CurrencyContext.jsx`, `Settings.jsx` |

Note: the ~20 `.me()` call sites used purely as a React-Query `queryFn` to
grab "the current user" for a page (not for gating access) are **data reads,
not auth-flow logic** — they'll be replaced when the service layer
(`src/services/*`) lands in Phase 3, by calling `useAuth().user` or a shared
`getCurrentUser()` helper instead of hitting the SDK directly per-page. They
are listed here for completeness but are not part of the Phase 2 auth cutover
scope; forcing all 34 into one auth phase is exactly the kind of oversized
step this plan exists to avoid.

---

## 2. Target auth flow (Supabase)

`public.users` (from `0002_users.sql`) already extends `auth.users` 1:1 via a
shared `id`, with `role`, `super_admin`, `status`, `ban_reason`, `ban_until`,
`phone`, `phone_verified` columns already in place — Phase 1 built this
specifically so Phase 2 wouldn't need another schema change. `is_admin()` /
`is_super_admin()` are already defined as `SECURITY DEFINER` SQL functions in
`0011_rls_policies.sql`.

New client-side shape:

- **`src/services/authService.js`** (new) — the only file besides
  `supabaseClient.js` that touches `supabase.auth.*`. Wraps:
  - `signInWithPassword(email, password)` → `supabase.auth.signInWithPassword`
  - `signInWithOAuth(provider)` → `supabase.auth.signInWithOAuth({ provider })`
  - `signUp(email, password)` → `supabase.auth.signUp` (Supabase sends its own
    confirmation email; replaces the custom OTP screen — see §5)
  - `signOut()` → `supabase.auth.signOut()`
  - `resetPasswordForEmail(email)` → `supabase.auth.resetPasswordForEmail`
  - `updatePassword(newPassword)` → `supabase.auth.updateUser({ password })`
  - `getSession()` / `onAuthStateChange(cb)` → thin wrappers
  - `getCurrentUser()` → gets the Supabase auth session, then `select * from
    users where id = auth.uid()` for the profile row (role, status, ban
    fields, phone_verified, etc.) — this single function is what replaces
    `base44.auth.me()` everywhere.
- **`src/lib/AuthContext.jsx`** — same public shape (`user`, `isAuthenticated`,
  `isLoadingAuth`, `authChecked`, `blockedAccount`, `authError`, `logout`,
  `navigateToLogin`, `checkUserAuth`) so the ~20 read-only consumers of
  `useAuth()` elsewhere in the app need zero changes. Internals swapped to
  call `authService` instead of `base44.auth`, and subscribe to
  `supabase.auth.onAuthStateChange` instead of polling once on mount.
- **2026-07-18 safety correction** — an auth/session or profile-read failure is
  no longer silently represented as a guest. `authState.js` yields explicit
  guest, blocked, and error states; the app renders a retryable safe state for
  missing profiles/provider failures. This does not create a Base44/Supabase
  identity bridge and does not replace live provider acceptance testing.
- **2026-07-18 local acceptance evidence** —
  `npm run test:auth-local` verifies signup, confirmation delivery/exchange,
  profile and phone capture, login/logout, recovery, password replacement,
  old-password rejection, and replacement-password login. Targeted Chromium
  verifies invalid login feedback, registration validation, invalid reset
  denial, and a genuine emailed recovery callback. Shared SMTP/OAuth,
  refresh/revocation, admin/blocked-user, legacy-user, and complete browser
  acceptance remain external or later-cutover gates.
- **Sessions** are handled entirely by `@supabase/supabase-js` (JWT in
  `localStorage`, auto-refresh) — no more hand-rolled `appParams` token
  plumbing for auth (the `base44_access_token` localStorage key and URL
  param handling in `app-params.js` stays only as long as any non-auth Base44
  SDK call remains, i.e. until Phase 3 finishes).

---

## 3. File-by-file migration order

Split into four checkpoints per your instruction — smaller, independently
verifiable, each leaving the app in a working state before the next starts.

**Phase 2A — Supabase Auth core: session management, login, logout**
1. `src/services/authService.js` (new)
2. `src/lib/AuthContext.jsx`
3. `src/pages/Login.jsx`
4. `src/components/admin/AdminSidebar.jsx` (logout call only)
5. `src/components/admin/AdminSidebarCollapsible.jsx` (logout call only)
6. `src/components/auth/AccountBlocked.jsx` (logout call only)

**Phase 2B — Registration, password reset, email verification**
7. `src/pages/Register.jsx`
8. `src/pages/ForgotPassword.jsx`
9. `src/pages/ResetPassword.jsx`

**Phase 2C — ProtectedRoute, roles, admin access, permissions**
10. `src/components/ProtectedRoute.jsx` (role re-verification via
    `is_admin()`/`is_super_admin()` instead of a second `base44.auth.me()`)
11. `src/pages/admin/AdminUsers.jsx` (role read)
12. Router config in `src/pages/index.jsx` / wherever `requiredRole` is
    wired (confirm exact file when this checkpoint starts)

**2026-07-17 implementation note:** `ProtectedRoute` now calls the existing
Supabase/Postgres `is_admin()` or `is_super_admin()` `SECURITY DEFINER` RPC
through `authService.hasRequiredRole()`. `AdminUsers` now reads its display-
only `super_admin` value from `useAuth().user`; its list and mutation calls
remain Base44 functions for their planned service/function migration. The
router was confirmed to wire `/admin/*` through `requiredRole="admin"` in
`src/App.jsx`, so it needed no source change. The route guard has no live
`base44.auth.*` call. Local pgTAP proves ordinary users fail and admins pass
the database role predicate; a browser check confirms an unauthenticated
`/admin` visit renders login. Admin-browser, shared-provider, and role-
assignment workflow QA remain required.

**Phase 2D — Remove Base44 auth completely (source/local gate complete)**
13. Repoint the final Base44-client auth consumers to `useAuth()`.
14. Confirm zero runtime `base44.auth.*` operations with an automated contract
    gate.
15. Record Base44 auth as retired from source while retaining Base44 runtime
    configuration required by separately classified data/function calls.

The 20 read-only `base44.auth.me()` "get current user for this page" call
sites (listed in §1) are **not** in this order — they belong to Phase 3
(service layer) since they're data reads through the wrong door, not auth
logic. Re-pointing them at `useAuth().user` is a Phase 3 cleanup task, not an
auth-flow risk.

---

## 4. Risk assessment

| Risk | Files affected | Mitigation |
|---|---|---|
| Session shape mismatch breaks every page reading `useAuth()` | All ~20 consumers of the hook | `AuthContext` keeps an identical public API; internals only |
| OAuth (Google/Apple) provider config not yet set up in Supabase | `Login.jsx`, `Register.jsx` | Verify both providers are configured in the Supabase dashboard before 2A ships; until then, feature-detect and hide the buttons rather than shipping a dead click |
| Custom 6-digit email OTP UX has no direct Supabase equivalent (Supabase's default is a magic-link/confirmation-URL email) | `Register.jsx` | Resolved — see §5: adopting Supabase's standard link-based flow, OTP screen removed |
| `ProtectedRoute`'s role re-check still calls `base44.auth.me()` until 2C lands | `ProtectedRoute.jsx` | Acceptable interim state **only if** the Base44 backend stays reachable through 2A/2B — call this out explicitly in each phase's "what still depends on Base44" note so it isn't mistaken for finished |
| Suspended/banned account UX (`AccountBlocked`) depends on `status`/`ban_*` columns | `AccountBlocked.jsx`, `AuthContext.jsx` | Columns already exist (`0002_users.sql`); `getCurrentUser()` must select them or this silently regresses |
| Admin auto-verify side effect (`ensureAdminVerified` function invoke) has no Supabase equivalent yet | `AuthContext.jsx` | Carry the same fire-and-forget call through 2A unchanged (still a Base44 function until Phase 6); do not drop silently |
| `RequirePhoneVerification`'s own OTP flow is unrelated to login/registration auth but reads `user.phone_verified` off the same context | `RequirePhoneVerification.jsx` | No change needed in Phase 2 — confirm `phone_verified` is still populated by `getCurrentUser()` |
| Route-level admin risk: a bug in `is_admin()` wiring could open or lock out `/admin/*` | Everything under `src/pages/admin/*` | 2C ships behind manual QA checklist (see §7) before removing the old role check, not simultaneously |

---

## 5. Email verification decision — resolved

**Decision (2026-07-07):** adopt Supabase's standard flow. No custom OTP
screen.

- Registration → `supabase.auth.signUp()` → Supabase sends its own
  confirmation email with a link → user is redirected back and verified.
  The 6-digit OTP screen in the current `Register.jsx` is removed, not kept
  behind a flag — it was Base44-specific UI with no Supabase equivalent
  worth reproducing.
- Password reset → `supabase.auth.resetPasswordForEmail()` /
  `supabase.auth.updateUser({ password })`, replacing
  `resetPasswordRequest` / `resetPassword`.
- Google/Apple sign-in stays, unchanged in shape (already wired in 2A) —
  optional, additive to email/password, not a replacement for it.

**Rationale:** simpler, matches what most users already expect from a
web sign-up flow, and removes a chunk of custom auth code (OTP generation,
resend, verification-code entry UI) that would otherwise need independent
maintenance. This decision unblocks Phase 2B — `Register.jsx`,
`ForgotPassword.jsx`, `ResetPassword.jsx` can now be rewritten directly
against this flow rather than waiting on a further product call.

**Known UX difference to flag before 2B ships:** Supabase's default
confirmation email requires leaving the app and returning via a link,
whereas the old flow kept the user on an in-app OTP screen the whole time.
Worth a short heads-up in the product notes for whoever reviews the new
`Register.jsx`, since it's a visible behavior change for real users, not
just an implementation detail.

---

## 6. Legacy user migration strategy

**2026-07-17 correction:** production user state is unknown. Absence of user
data in the repository and wording in a feature-flag document do not prove
that production users do not exist. Under MD1, assume implemented features
may have active users unless proven otherwise. Do not run a fresh-user cutover
or destructive auth change until an immutable Base44 user export/count and
identity mapping are available.

**If evidence proves there are no production users: this is a fresh user
database, not a migration. This is an unproven conditional branch, not the
default.**
- No import script needed. `public.users` starts empty; every account is
  created fresh via `supabase.auth.signUp()` going forward.
- No password carry-over question — there's nothing to carry over.
- The only "legacy" data that matters is whatever test/dev accounts exist in
  your own Base44 sandbox — those are disposable and don't need a migration
  path, just recreation if you still want them post-cutover.

**If there turns out to be an existing Base44 user base (documented here so
the plan doesn't have to be rewritten from scratch if that's the case):**
- **Passwords cannot be migrated.** Base44 (like virtually every auth
  provider) stores password hashes in a scheme only it can verify — there is
  no way to export a usable password hash into Supabase Auth. Every existing
  user would need to go through Supabase's password-reset flow at least once
  ("we've upgraded our login system — please reset your password") rather
  than silently keep their old password.
- **Profile data can be migrated.** Everything in the current `User` entity
  (email, full_name, role, phone, verified status, bio, avatar, etc.) can be
  bulk-inserted into `public.users` ahead of time via the Supabase Admin API
  (`auth.admin.createUser()` with `email_confirm: true` to pre-create the
  `auth.users` row without sending a confirmation email, keyed by email so
  the `id` lines up with the `public.users` row Phase 1 already expects it
  to reference).
- **Sequencing:** a one-time export/import script (not yet written — would
  be its own step, not bundled into 2B) would run once, before flipping
  `Login.jsx` over to Supabase, so existing users land on a "reset your
  password" prompt on first login rather than a "create an account" flow
  that would duplicate them.
- **Rollback implication:** unlike 2A–2D (file-level revert, no data risk),
  a real user migration is the one step in this whole plan that touches
  production user data — it would get its own checkpoint, its own dry run
  against a copy of the data, and its own explicit go/no-go, separate from
  the auth-code checkpoints in §3.

## 7. Rollback strategy

- Every checkpoint (2A/2B/2C/2D) is its own commit/patch and its own
  before/after entry in `MIGRATION.md` — reverting one sub-phase never
  requires reverting the others.
- Because `src/api/base44Client.js` and `@base44/sdk` are **not removed**
  until 2D, rolling back 2A/2B/2C is a file-level revert (restore the
  previous version of the specific files listed in §3 for that checkpoint),
  not a data migration — no user data is destroyed or moved in Phase 2, only
  read/write paths change.
- `.env` keeps both `VITE_SUPABASE_*` and `VITE_BASE44_*` populated through
  the whole of Phase 2, so rollback never requires re-provisioning credentials.
- Rollback trigger checklist — treat any of these as "stop and revert this
  checkpoint": login success rate drops, session persistence fails on
  refresh, any `/admin/*` route becomes reachable by a non-admin (or
  unreachable by an admin), or `AccountBlocked` stops gating a
  suspended/banned account.

**Manual/shared-environment QA checklist required before production acceptance.**
The repeatable local smoke and targeted Chromium checks now cover the core
credential/email paths, but the provider/lifecycle cases below still require a
configured shared environment and representative users:
1. Log in with email/password → lands on `/` (or `/admin` for an admin).
2. Log out → session cleared, protected pages redirect to `/login`.
3. Refresh the page while logged in → session persists (no forced re-login).
4. A `suspended`/`banned` test account sees `AccountBlocked`, not the app.
5. (2C only) A non-admin hitting an `/admin/*` route is denied; an admin
   isn't.

---

## 8. Success criteria for Phase 2 overall

- Zero runtime `base44.auth.*` operations remain in files that import the
  Base44 client; `tests/authMigrationBoundary.test.mjs` enforces this while
  allowing historical migration comments — the Phase 2D source gate.
- All five manual QA checklist items pass on every sub-phase they apply to.
- `MIGRATION.md` progress table shows `Authentication: 100%` only after 2D,
  not before — partial credit is logged per sub-phase, not claimed early.
