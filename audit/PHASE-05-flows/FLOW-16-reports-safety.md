# FLOW-16 — Reports & safety operations
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
`ReportListingDialog.jsx` → reports repository → `reports` table.
Admin: `/admin/reports` → `AdminReports.jsx`; `/admin/peeks` → `AdminPeeks.jsx`; `/admin/listings` → `AdminListings.jsx`; `/admin/users` → `AdminUsers.jsx` (`BanUserDialog.jsx`); `/admin/audit-log` → `AdminAuditLog.jsx` (`audit_logs`).
Tour report/restore: `0034_v1_tour_moderation_and_reports.sql:367-368` sets `moderation_status='reported', published_at=null` **only where the row was `'approved'`** — a correctly guarded transition.

## Assessment
| Aspect | State |
|---|---|
| Report submission | `reports_create` INSERT policy |
| Report visibility | PASS — `reports_reporter_or_admin_read`: `is_active_user() and (reporter_id = auth.uid() or is_admin())`; reporters cannot read others' reports |
| Decision path | `reports_admin_update` — `is_admin()` only |
| Report-driven removal/restoration | Present for Peeks (`0034:146,185,367`) |
| Audit | `audit_logs` table + admin audit route |
| Post-publication model | PASS — safety acts after publication; no routine pre-approval |

## Gaps
- **F-027 (P1)** — every one of these destructive capabilities is reachable with an aal1 token, since no admin path requires aal2.
- **F-001** — "helping keep FindIt safe" (`ReportListingDialog.jsx:44`) and "block … from using FindIt" (`BanUserDialog.jsx:45`).
- Reason-required and confirmation guardrails on each destructive action are assessed in Phase 16.
