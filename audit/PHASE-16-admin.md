# PHASE 16 — ADMIN & INTERNAL OPERATIONS

**Audited ref:** `origin/main` @ `ee6f212`

## 16.1 Active admin surface

10 routes under `ProtectedRoute requiredRole="admin"` + `AdminLayout` (`App.jsx:199-211`):

| Route | Page | Purpose | MVP-aligned? |
|---|---|---|---|
| `/admin` | `AdminDashboard` | Overview, `AdminOperationalHealth` | Yes |
| `/admin/business-applications` | `AdminBusinessApplications` | Verification decisions | **Yes — core MVP** |
| `/admin/reports` | `AdminReports` | Report triage | **Yes — core MVP** |
| `/admin/users` | `AdminUsers` | Suspension / ban (`BanUserDialog`) | **Yes** |
| `/admin/listings` | `AdminListings` | Listing takedown | **Yes — post-publication safety** |
| `/admin/peeks` | `AdminPeeks` | Peek queue | **See §16.2** |
| `/admin/support` | `AdminSupportRequests` | Support | Yes |
| `/admin/audit-log` | `AdminAuditLog` | `audit_logs` | Yes |
| `/admin/categories` | `AdminCategories` | Taxonomy management | Yes |
| `/admin/managed-listings` | `AdminManagedListings` | Managed listing requests | Yes |

## 16.2 `/admin/peeks` — determination: report-driven, **not** obsolete MVP drift

Deferred from Phase 0 and resolved here.

The surface *looks* like a moderation queue: `adminRepository.js:31` calls `admin_tour_queue_page` with the
customer error string *"We could not load the Peek moderation queue."*, and `AdminPeeks.jsx:17` imports
`moderateAdminTour`.

The determining evidence is what the queue is **ordered by** and what the transitions **guard on**:

- Cursor fields are `p_cursor_reported_priority` and `p_cursor_failed_priority` (`adminRepository.js:31`) — the queue surfaces **reported** and **processing-failed** Peeks, not newly uploaded ones awaiting approval.
- Publication does not wait for it: `0033:515` publishes on `status='ready' and moderation_status='approved' and deleted_at is null`, and the processing pipeline sets `'approved'` automatically.
- The report transition is guarded to only *demote already-published* Peeks: `0034:367-368` sets `moderation_status='reported', published_at=null` **`where id = tour.id and moderation_status = 'approved'`**.
- Restoration exists (`0034:146`).

**Conclusion: this is report-and-failure-driven post-publication safety, which the MVP explicitly permits.**
No routine pre-publication approval queue is reachable. Appendix C
**"No routine listing/Peek approval dependency" = PASS.**

The residue is vocabulary: the RPC name, the error string and `moderation_status` all read as pre-approval
even though the behaviour is not. → **F-052 (P3)**

Correspondingly, `AdminTourQueue.jsx` is confirmed as a **dead duplicate** superseded by `AdminPeeks.jsx`
(**F-010**).

## 16.3 Guardrails

| Control | State |
|---|---|
| Server authorization | PASS — `is_admin()` RPC, re-checked per mount, fails closed |
| **Assurance level** | **FAIL — F-027.** Every destructive admin action is reachable with an aal1 token |
| Bounded pagination | PASS — admin RPCs take `p_limit` and cursor fields |
| Confirmation dialogs | Present — e.g. `BanUserDialog.jsx` |
| Audit logging | PASS — `audit_logs`, `business_review_events`, `/admin/audit-log` |
| Restoration | PASS for Peeks (`0034:146`) |
| Self-assignment | PASS — trigger-protected; delegation disabled (`0030:124`) |

## 16.4 Non-engineer operability

| Task | Self-service? |
|---|---|
| Category management | **Yes** — `/admin/categories` + `admin_category_rows` |
| Business category approvals | **Yes** |
| Report triage, takedown, ban, support | **Yes** |
| Feature flags | **No** — `VITE_FEATURE_*` are build-time; changing one requires a redeploy |
| Safety reason taxonomy | Not evidenced as editable |

Feature flags being build-time is a real operational cost: disabling a misbehaving capability in an incident
requires a full rebuild and redeploy, and **deployment is currently failing on `main`** (F-012). There *is*
a `marketplace_feature_controls` table (deny-all) and `marketplace_operational_controls`, suggesting a
runtime control plane was intended. → **F-053 (P2)**

## 16.5 Findings

| ID | Sev | Confidence | Title |
|---|---|---|---|
| F-052 | P3 | CONFIRMED | Admin Peek queue uses pre-approval vocabulary for what is actually report-driven safety |
| F-053 | P2 | CONFIRMED | Feature flags are build-time only, so incident response requires a redeploy on a pipeline that is currently red |
