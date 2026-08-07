# FLOW-02 — Authentication (signup, signin, MFA, recovery, logout)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/register` → `src/pages/Register.jsx` → `authService` → Supabase Auth; disposable-domain rejection via `20260805110000_reject_disposable_signup_emails.sql` + `disposable_email_domains`.
`/login` → `Login.jsx` → session → `AuthContext.checkUserAuth()` → `getCurrentUser()` (`authService.js:105-112`) reads the `users` profile; a missing profile raises `profile_missing` → `UserNotRegisteredError` (`App.jsx:142`).
MFA: `useMfaGate` (`App.jsx:115-132`) → `mfaChallengeRequired()` (`authService.js:159-165`) → `MfaChallengeScreen`.
`/forgot-password` → `ForgotPassword.jsx:15-27`. `/reset-password` → `ResetPassword.jsx`, **exempt from the MFA gate** (`App.jsx:146`).
Logout: `signOut({ scope: 'global' })` (`authService.js:85`).

## Assessment
| Aspect | State |
|---|---|
| Password policy | `passwordPolicy.js:1-11` — min 10, upper+lower+digit |
| Enumeration | PASS — reset always reports success (`ForgotPassword.jsx:20-24`) |
| Global logout | PASS — `scope: 'global'` |
| Blocked accounts | `AccountBlocked` rendered ahead of routing (`App.jsx:140`) |
| Auth-provider failure | Fails to a retryable `AuthUnavailable` screen, not a silent deny (`App.jsx:141-143`) |
| **MFA enforcement** | **FAIL — F-027.** Client-side only; no `aal` predicate anywhere in SQL |

## Gaps
- **F-027 (P1)** — an aal1 bearer token reaches every admin RPC directly; the challenge screen is a React branch, not a boundary.
- Session tokens live in localStorage (Supabase default), which is what makes F-027 reachable after any XSS or device compromise. CSP (`vercel.json:17`) with no `script-src` `unsafe-inline` materially reduces the XSS path.
