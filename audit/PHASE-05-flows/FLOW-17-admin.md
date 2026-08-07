# FLOW-17 — Admin operations
**Audited ref:** `origin/main` @ `ee6f212` · Trace evidence is `file:line` on canonical main. Hosted behaviour unverified (E-003/E-004).

## Trace
10 routes under `ProtectedRoute requiredRole="admin"` + `AdminLayout` (`App.jsx:199-211`): `/admin`, `/admin/listings`, `/admin/peeks`, `/admin/users`, `/admin/reports`, `/admin/support`, `/admin/categories`, `/admin/business-applications`, `/admin/managed-listings`, `/admin/audit-log`.
Authorization: `authService.hasRequiredRole('admin')` → `supabase.rpc('is_admin')` → `private.is_admin()`.

## Assessment
| Aspect | State |
|---|---|
| Server authorization | PASS — RPC-resolved, re-checked per mount, fails closed |
| Self-assignment | PASS — `protect_user_managed_fields()` blocks `role`/`super_admin`; delegation disabled (`0030:124`) |
| **Assurance level** | **FAIL — F-027** |
| Bounded pagination | Admin RPCs use cursor parameters (e.g. `admin_tour_queue_page` takes `p_limit` and cursor fields) |

## Gaps
- **`/admin/peeks` moderation-queue semantics** — `adminRepository.js:31` calls `admin_tour_queue_page` with the error string *"We could not load the Peek moderation queue."* and `AdminPeeks.jsx` imports `moderateAdminTour`. The cursor fields `reportedPriority` and `failedPriority` indicate a **report-and-failure-driven** queue rather than routine pre-publication approval, which is MVP-permitted. Final determination in Phase 16.
- **F-010** — `AdminTourQueue.jsx` is a dead duplicate of the live `AdminPeeks.jsx`.
- **F-001** — `AdminSidebarCollapsible.jsx:24` aria-label "FindIt admin overview".
