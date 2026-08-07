# FLOW-13 — Verified business (application → decision → public state)
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`/business-profiles` (auth + flag, `App.jsx:195`) → `BusinessProfiles.jsx` → `businessProfilesRepository`.
Admin: `/admin/business-applications` → `AdminBusinessApplications.jsx` → `adminRepository`.
Public: `/business/:id` and `/dealer/:id` → `PublicBusinessProfile.jsx` → **`private.public_business_profiles`**, granted to `anon` (Phase 3 §3.7).
Approval wiring: `20260807010000_connect_business_approval_to_verified_profiles.sql`, `20260807011000_verified_business_profile_bootstrap.sql`.

## Assessment
| Aspect | State |
|---|---|
| Evidence privacy | PASS — `business_applications_owner_read`: `user_id = auth.uid() or is_admin()`; the early `business_profiles_public_read using(true)` was dropped at `0013:274` |
| Public projection | PASS — public reads go through a dedicated `SECURITY DEFINER` projection, not the raw table, so `registration_number`, `issuing_body`, `address`, `email`, `phone` and `verification_status` are not exposed wholesale |
| **Owner cannot self-verify** | PASS — `verified` and `verification_status` are admin-RPC controlled; owner write policies are scoped |
| Separation from content moderation | PASS — business/category decisions are a distinct surface from report-driven safety |

## Gaps
- **F-014 (P2)** — 4 of the 10 typecheck errors are in `BusinessProfiles.jsx:26,33,75`.
- Required decision reasons, notification on decision, and suspension flow are asserted by migration names but not traced to UI in this pass — **UNVERIFIED — needs check** for the reason-required and notification legs.
