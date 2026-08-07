# PHASE 04 — AUTH, MFA, IDENTITY & AUTHORIZATION

**Audited ref:** `origin/main` @ `ee6f212` · **Evidence:** Static ✅ · Hosted auth settings ⛔ E-004/E-006

---

## 4.1 HEADLINE — MFA is enforced only in the browser; the database has no assurance-level check

`src/App.jsx:115-132` (`useMfaGate`) and `src/components/auth/MfaChallengeScreen.jsx` gate **what React
renders**. The gate calls `authService.mfaChallengeRequired()` (`authService.js:159-165`), which reads the
session's authenticator assurance level client-side:

```js
export async function mfaChallengeRequired() {
  const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
  if (currentLevel !== 'aal1') return false;
  if (nextLevel === 'aal2') return true;
  const verified = await listVerifiedTotpFactors();
  return verified.length > 0;
}
```

**A search of all 159 migrations for `aal1`, `aal2`, `assurance` and `amr` returns zero matches.** No RLS
policy, no `SECURITY DEFINER` function and no trigger inspects the assurance level. `private.is_admin()`
tests role membership only.

Supabase issues an `aal` claim in the JWT and it is readable in SQL via `auth.jwt() ->> 'aal'`, so the
control is available and simply not used.

### Why this matters

MFA exists to contain credential compromise. Here, an attacker who obtains a password (phishing, reuse,
breach) signs in, receives a valid **aal1** session, and is shown the MFA challenge screen — but that screen
is only a React branch. The attacker never has to run the SPA. With the aal1 access token they can call
PostgREST and every admin RPC directly:

```
POST /rest/v1/rpc/<admin_function>
Authorization: Bearer <aal1 access token>
```

Every server-side authorization check the admin surface relies on (`is_admin()`, the admin RPCs, the
admin-only RLS policies) passes, because none of them require aal2. The MFA step-up therefore provides
**no protection at all** against API-level access — precisely the threat it is deployed for.

Admin capability includes user suspension and ban, listing and service takedown, Peek removal, conversation
action and verified-business decisions, so the blast radius is the whole safety and trust surface.

**Appendix C gate "MFA cannot be route-bypassed" = FAIL.** The bypass is not a route manipulation; it is
skipping the client entirely.

→ **F-027 (P1, CONFIRMED)** — recommended for Tranche 0. Treat as P0 if MFA is being relied on as the
compensating control for admin password compromise.

**Fix shape** (proposal only, not applied): require `auth.jwt() ->> 'aal' = 'aal2'` inside
`private.is_admin()` / `private.is_super_admin()` for accounts that have a verified factor, or add an
`aal2` predicate to admin RLS policies and admin RPC preludes.

## 4.2 Authorization model — assessed strong everywhere else

### Role source is server-authoritative

`src/services/authService.js:96-103`:

```js
export async function hasRequiredRole(requiredRole) {
  if (requiredRole === 'user') return Boolean(await getSession());
  const rpcName = { admin: 'is_admin', super_admin: 'is_super_admin' }[requiredRole];
  if (!rpcName) throw new Error(`Unsupported required role: ${requiredRole}`);
  const { data, error } = await supabase.rpc(rpcName);
  if (error) throw error;
  return data === true;
}
```

The role is resolved by an RPC against Postgres, not from React state or a JWT claim the client could
shape. `ProtectedRoute.jsx:37-74` re-runs this on every mount and **fails closed**: a provider error renders
a distinct "could not verify" state (`:88-104`) rather than granting or denying silently.

**Actual roles** (no invented buyer/seller/agent roles): `users.role` plus a separate `users.super_admin`
boolean. Enumerated via `is_admin` / `is_super_admin` only.

### Admin self-assignment — PASS

`public.protect_user_managed_fields()` (`0011_rls_policies.sql:46-72`) is a `BEFORE UPDATE` trigger on
`public.users` (`0011:74-76`). When `auth.uid() = old.id and not public.is_admin()`, it raises `42501` if
any of these change:

`id`, `email`, **`role`** (`:52`), `phone`, `phone_verified`, `phone_otp_code`, `phone_otp_pending`,
`phone_otp_expires`, `verified`, `verified_at`, `verified_full_name`, **`super_admin`**, `status`,
`ban_reason`, `ban_until`, `created_at`.

So although `users_update_own_or_admin` permits a user to update their own row, a direct
`PATCH /rest/v1/users?id=eq.<self>` with `{"role":"admin"}` is rejected by the trigger.
`0030_v1_founder_admin_lock.sql:124` goes further — *"admin role delegation is disabled in founder-operated V1"* —
and `:134` blocks self role changes inside the admin RPC path too.

**Appendix C "Admin roles cannot self-assign" = PASS.** **"Suspension/ban enforcement works"** — `status`,
`ban_reason` and `ban_until` are trigger-protected and surfaced by `AccountBlocked` (`App.jsx:140`); enforcement
against API calls flows through `is_active_user()`, which every write RPC calls first.

### IDOR sweep

Phase 3 established that the write path for every core object is RLS-denied and forced through a
`SECURITY DEFINER` RPC carrying an explicit ownership predicate. Result by object:

| Object | Ownership control | Verdict |
|---|---|---|
| Listing create | `create_v1_listing_submission` — `submission_key` owner check, `seller_id = auth.uid()` | PASS |
| Listing transition | `owner_transition_listing` — `where id=… and seller_id=auth.uid() FOR UPDATE` | PASS |
| Listing managed fields | `protect_listing_managed_fields()` blocks `status`/`verified`/`views`/`seller_id` | PASS |
| Staged media | intent must match `user_id = auth.uid()` **and** `storage.objects.owner_id`, mimetype, byte size | PASS |
| Peek Request create | owner cannot request against own listing; 10-min duplicate window | PASS |
| Peek Request accept | `private.peek_request_parent_owner(...) = auth.uid()` → *"Only the listing owner can accept this Peek Request"* | PASS |
| Fulfilment rows | single SELECT policy `owner_id = auth.uid() or is_admin()`; all writes via RPC | PASS |
| `listing_tours` | `owner_id = auth.uid() or is_admin()` | PASS |
| Private location | `owner_id = auth.uid() or is_admin()`; writes restricted to `postgres`/`service_role`/admin | PASS |
| Messages | `conversations_participant_read` — `buyer_id = auth.uid() or seller_id = auth.uid()` | PASS |
| Reports | `reporter_id = auth.uid() or is_admin()` | PASS |
| Business application | `business_applications_owner_read` — `user_id = auth.uid() or is_admin()` | PASS |
| Contact reveal | `reveal_listing_contact` / `owner_listing_contacts`, audited and rate-limited | PASS |
| User row | `protect_user_managed_fields()` trigger | PASS |

**No IDOR found.** The one authorization weakness in this phase is the assurance-level gap in §4.1, which is
an authentication-strength issue rather than an object-ownership issue.

### Business self-verification — PASS

`business_applications` is owner/admin read only. The decision path is admin-only, and
`business_profiles.verified` / `verification_status` are not writable by the owner (the public-read policy
was dropped in `0013:274`; owner write policies are scoped and the verification columns are set by admin
RPCs). Detailed trace in FLOW-13.

## 4.3 Credential and session handling

| Control | Evidence | Verdict |
|---|---|---|
| Password policy | `src/lib/passwordPolicy.js:1-11` — min **10** chars, requires lower + upper + digit | Reasonable. No breach-list check; no max length issue. |
| Enumeration resistance | `src/pages/ForgotPassword.jsx:15-27` — always renders success, `catch` swallows the error deliberately | PASS |
| Global logout | `authService.js:85` — `supabase.auth.signOut({ scope: 'global' })` | PASS — revokes all sessions, not just local |
| Disposable email | `supabase/migrations/20260805110000_reject_disposable_signup_emails.sql` + `disposable_email_domains` table | Present; hosted hook activation is E-004 |
| Recovery-route MFA exemption | `App.jsx:146` — `location.pathname…endsWith('/reset-password')` | Correct and necessary; the exemption is scoped to that one path |
| Token storage | Supabase JS default (localStorage) via the single client `src/lib/supabaseClient.js` | Standard for a SPA; combined with §4.1 it is the token that carries the aal1 bypass |
| Query cache on logout | No `queryClientInstance.clear()` anywhere | See below |

**Query cache on logout — assessed, not raised as a finding.** `src/lib/query-client.js` configures no
persister, so the cache is in-memory only and dies on navigation; `signOut` performs a full
`window.location.href` navigation when given a redirect. The residual risk (log out → log in as a different
user with no page load in between) is narrow. Recorded as an observation.

**Noted for Phase 10:** `query-client.js:6-11` sets `staleTime: 30 min`, `gcTime: 1 h`,
`refetchOnWindowFocus: false`, `refetchOnReconnect: false`. This is a deliberate low-bandwidth optimisation
that also means a buyer can act on a listing that was sold or withdrawn up to 30 minutes earlier, with no
refetch on regaining focus or connectivity. Carried to Phase 10 as a freshness-versus-data tradeoff.

## 4.4 Phase 4 findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-027 | P1 | CONFIRMED | MFA is enforced only in the browser; no AAL check exists in any policy, function or trigger, so an aal1 token reaches every admin RPC directly |

**No P0 identified in Phase 4.**

## 4.5 Strengths recorded

- Role resolution is an RPC against Postgres, never client state, and re-verified on every protected mount.
- `ProtectedRoute` fails closed and distinguishes "denied" from "could not verify".
- `protect_user_managed_fields()` blocks self-escalation of `role` and `super_admin` at the trigger level, so it holds against direct PostgREST writes.
- Admin role delegation is disabled outright in founder-operated V1.
- Enumeration-safe password reset.
- Global-scope logout.
- No IDOR found across 14 traced object types.
