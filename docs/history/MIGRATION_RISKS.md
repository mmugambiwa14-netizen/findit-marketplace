# FindIt Migration Risks

Date: 2026-07-25  
Scope: authoritative Phase 2B archive, MD1 discovery review, and specification
Document 2 architecture/security review.

Ratings describe engineering impact, not proven production incidence. Unknown
production behavior is recorded as unknown rather than inferred.

## Active blockers

| ID | Blocker | Evidence | Required resolution |
|---|---|---|---|
| B-01 | Final acceptance requirements were unknown | Documents 1-4 are now reviewed; Document 4 is the release contract | Maintain the Document 4 reports and satisfy their evidence gates before release. |
| B-02 | Production user/data state is unknown | No Base44 tenant export, counts, backups, or storage manifest | Obtain immutable exports and reconciliation inputs; assume active users until disproven. |
| B-03 | Phase 1 local evidence is complete; shared acceptance remains blocked | Clean 28-migration reset, lint and 253 pgTAP assertions pass across 49 RLS-enabled public tables; the earlier disposable restore rehearsal passed | Obtain a current production-like snapshot, run upgrade/import reconciliation, and execute provider recovery/RPO/RTO/traffic-switch evidence. |
| B-04 | Database authorization remains incomplete outside the V1-tested surface | Migration `0013` hardens V1 protected fields, active status, relationships, audit writes, and deferred-table fail-closed policies; broad future-domain workflow/column checks remain | Pass a complete role/action/column matrix before exposing future/deferred domains. |
| B-05 | Retained Base44 source has no identity bridge, deliberately | Supabase sessions do not provide a Base44 token; the recursive active V1 graph and current generated output contain zero Base44, while dormant/future modules still do | Keep retained modules unrouted and the graph/build gates mandatory; migrate or archive a module before any future activation. |
| B-06 | Shared Auth delivery and browser flows remain unaccepted | The recovered local stack passes repeatable signup/confirmation/profile/login/logout/recovery/password-replacement smoke coverage plus targeted valid/invalid recovery, form-error and active super-admin Chromium checks. Staging SMTP/OAuth, refresh/revocation, blocked-user lifecycle, and legacy-user transition inputs remain absent. | Keep the local smoke command green, then complete configured shared-staging provider and lifecycle QA. |
| B-07 | Broad quality coverage is incomplete | Lint, current configured build, 69 contract tests (including recursive active-route, zero-Base44-auth, image sanitization, lifecycle-worker and chart-CSS boundaries), domain API/Edge/Storage smokes including the real lifecycle worker, scoped typecheck, clean 28-migration reset/lint and 253 pgTAP assertions pass. Listing/support/messaging/notification/media-edit browser acceptance is blocked by the current tool environment; broad legacy typecheck and complete E2E/device suites also remain | Run targeted browser acceptance when the environment is available, then expand the green gate domain by domain. |
| B-08 | Capability model implementation is incomplete | The active business/dealer slice now derives presentation from one owner profile without adding a user role; remaining legacy/deferred screens still contain older seller-type concepts | Keep the accepted model at every remaining cutover and test the action matrix. |
| B-09 | Storage cutover lacks production evidence | Two private buckets and trusted product/service/business image paths pass locally; expired-intent claim/finalize/backoff and the real service-authenticated two-bucket cleanup-worker HTTP run pass. The Base44 object/ACL manifest, hosted scheduling/deployment and complete retention/scanning decision remain absent | Obtain the production object manifest, approve privacy/retention controls, then deploy, schedule and observe every V1 image path before launch. |
| B-10 | Listing moderation lifecycle lacks browser/hosted acceptance | The owner publish bypass is closed: protected submit/review/pause/resume/reject transitions pass SQL/API smokes, but no in-app browser instance is available | Execute authenticated owner/admin desktop/mobile state-machine acceptance against deployed Storage/Edge before enabling launch traffic. |

## Risk register

| ID | Category | Risk / evidence | Impact | Status / mitigation |
|---|---|---|---|---|
| A-01 | Architecture | 79 retained files directly import `base44Client`; 40 exported entity contracts and 59 functions remain classified. Recursive `App.jsx` traversal and the generated-output verifier prove zero Base44 in the active V1 runtime locally | Accidental routing/import changes can reactivate legacy dependencies | Keep both gates mandatory; archive or migrate retained modules only with evidence, then verify zero production traffic. |
| A-02 | Architecture | Two purpose-bound upload Edge Functions and one internal cleanup worker exist; most other hosted side effects still depend on Base44 | Privileged and side-effecting behavior cannot yet be preserved across all domains | Continue function-by-function contracts and protected replacements. |
| A-03 | Architecture | Hidden and unrouted pages may represent deployed behavior | Silent feature loss or duplicate workflows | Verify production routes/analytics before removal or activation. |
| A-04 | Reliability | Focused contract and SQL/RLS/Auth tests exist, but no complete component/integration/E2E suite is configured | Regressions outside bounded migrated slices remain difficult to detect | Add tests around each bounded migration step and require them in CI before release. |
| A-05 | Reliability | BrowserRouter rewrite requirements are documented but no target host is configured | Deep links can fail after deployment | Select host, configure fallback, and test representative direct routes in Phase 8. |
| A-06 | Reliability | Auth/profile errors previously collapsed into guest state | A provider outage could appear as logout and hide integrity failures | Fixed in source with explicit unavailable/profile-missing state and retry UI; four contract cases pass. Forced provider-outage browser evidence remains a shared-staging gate. |
| S-01 | Security | Owners could update privileged `users` columns | Role/super-admin/status/verification escalation | Fixed; focused local tests prove allowed profile edit, denied self-promotion, and admin managed update. Full field/service-role matrix remains. |
| S-02 | Security | Four public tables lacked RLS | Unauthorized reads/writes under exposed schema grants | Fixed; the current clean catalog and pgTAP suite prove 49/49 public tables have RLS. The future/deferred-domain action matrix remains. |
| S-03 | Security | Listing views lacked `security_invoker` | View reads could bypass listing RLS | Fixed; all three options and car-view anon/unrelated/owner/admin visibility pass. Other categories and suspended-account behavior remain. |
| S-04 | Security | The retained legacy support ticket/message schema is broader than V1 | Accidental reactivation could restore cross-ticket or staff-field risks | Legacy support tables are admin-only/fail-closed and unrouted. V1 uses the separate narrow `support_requests` RPC boundary; keep the legacy suite dormant until a future redesign. |
| S-05 | Security | The original legal practitioner self-update included verification fields | Self-verification or metadata tampering if the future domain were exposed | Mitigated for V1 by migration `0028`, which removes all browser legal-table grants/policies. A future legal product must add separate submission/reviewer fields and audited operations. |
| S-06 | Security | Active-account enforcement is bounded to migrated V1 data paths | Migration `0013` denies suspended users protected V1 writes and excludes them from admin predicates; legacy Base44 and browser refresh/revocation paths remain | Complete browser expiry/unban/refresh and legacy-path cutover tests before release. |
| S-07 | Security | Retained dormant/future bootstrap code can accept a Base44 token from URL/local storage, although it is absent from the active V1 graph/build | Accidental reactivation could cause token leakage/staleness and identity mismatch | Keep the graph/build gates mandatory and remove the bootstrap when retained source is archived or migrated. |
| S-08 | Security | Phone OTP remains a Base44 function; rate/attempt/storage guarantees are unknown | SMS abuse and account takeover | Blocked pending provider and verified challenge design. |
| S-09 | Security | Original lockfile reported 23 vulnerabilities | Potential vulnerable build/runtime transitive packages | Resolved and locally verified: seven unused direct packages removed; clean install, zero-advisory audit, lint, and build pass. |
| S-10 | Security | Retained privileged legal-admin pages invoke `base44.asServiceRole.entities` from browser code | Hidden elevation semantics or excessive authority could cross the browser trust boundary if reactivated | Mitigated for V1 by route/build isolation and migration `0028` browser denial. Replace the retained code only as part of a separately approved future legal backend. |
| S-11 | Security | Messaging, listing uploads and Contact Support have server-side limits; other public/provider/privileged surfaces and dormant audit behavior remain incomplete | Abuse or unlogged legacy administrative mutation | Add trusted limits and migrate/retire every remaining privileged flow before cutover; supplement Contact Support email limits with production gateway/CAPTCHA controls. |
| S-12 | Security | Product submission/media now have shared plus trusted validation; most remaining forms/uploads rely on local/browser hints | Invalid or hostile data can cross the remaining trust boundaries | Extend shared client schemas plus independent server/database/storage validation domain by domain. |
| S-13 | Security | Supabase default privileges had left internal/service functions executable by browser roles | Trusted notification construction and the listing-expiry worker were directly invocable despite `PUBLIC` revokes | Fixed by migration `0027`; the catalog allowlist is now part of the 253-assertion release gate and must be repeated on production upgrade. |
| S-14 | Security | Legal exclusion existed in UI/repository filters but not every shared-service database policy | Retained active legal services could appear through direct API reads, and owners could mutate a V1 service into the deferred category | Fixed locally by migration `0028`: five legal tables have no browser grants/policies and all shared-service browser policies require a nonlegal category. Production upgrade/reconciliation remains. |
| D-01 | Database | Migration 0004 trigger function had a formal argument | Fresh database initialization failed | Fixed using `TG_ARGV` and verified by clean local reset/pgTAP; production-like upgrade evidence remains. |
| D-02 | Database | Two RLS policies used nonexistent `content_status` value `active` | Fresh initialization failed at migration `0011` | Fixed to `published`; clean reset, database lint, and pgTAP pass. |
| D-02 | Database | Six exported fields lack explicit target parity | Silent data loss or UI contract failure | Profile production data, add mappings/adapters, reconcile counts and samples. |
| D-03 | Database | Email foreign keys become UUIDs without ETL | Orphaned or mis-owned records | Deterministic mapping, exception ledger, and dry-run reconciliation. |
| D-04 | Database | `service_bookings.practitioner_id` is polymorphic/unconstrained | Invalid references and ambiguous authorization | Inspect production values and obtain product decision before constraint. |
| D-05 | Database | Production recovery remains unaccepted | A checked-in local forward-recovery/restore rehearsal succeeds, but no provider backup, PITR, RPO/RTO, or traffic-switch exercise exists | Obtain provider-owner inputs and complete isolated production-like recovery evidence. |
| AU-01 | Authentication | Supabase and Base44 sessions are independent in retained legacy source | No active V1 route imports Base44; manually reactivating a dormant workflow would fail after Supabase-only login | Mitigated for active V1 by the recursive graph/build gates; retain B-05 until repository cleanup and production verification. |
| AU-02 | Authentication | Registration changed custom OTP to confirmation link | User-visible workflow/delivery change | Already documented; obtain acceptance and live accessibility/expiry/resend QA. |
| AU-03 | Authentication | Recovery page formerly treated any session as recovery-ready | Authenticated user could reach password update without recovery proof | Fixed in source: require matching `PASSWORD_RECOVERY`; local valid and no-event callbacks pass. Expired/replay/refresh/multi-tab shared-staging acceptance remains. |
| AU-04 | Authentication | Missing profile row makes a valid auth user appear logged out | Account lockout and hard-to-diagnose integrity failure | Add monitoring/repair only after database behavior is reproducible. |
| M-01 | Data migration | No versioned user/entity ETL exists | Production cutover cannot preserve data | Blocked by export; build dry-run tooling after mapping approval. |
| M-02 | Data migration | Source upload classes are inventoried, but the production storage object/ACL inventory does not exist | Broken links or exposure of identity/credential documents | Use `docs/STORAGE_MIGRATION_INVENTORY.md` as the collection schema; obtain objects, checksums, ownership, and visibility before Phase 4. |
| I-01 | Integrations | Email/OAuth configuration is unknown | Signup and recovery may not deliver or redirect safely | Configure staging providers and audit allowlists/templates/rate limits. |
| I-02 | Integrations | SMS, transactional email, scheduler, and notification providers are not independent | Side effects silently stop after Base44 removal | Phase 6 provider adapters with outbox, retries, idempotency, monitoring. |
| I-03 | Integrations | AI agents remain hosted and provider/privacy controls are absent | Data leakage, unsafe decisions, cost abuse | Keep feature flags off; server-only provider design and human review. |
| P-01 | Payments | Payment/escrow/subscription code is retained but gateway/webhooks are absent | False payment state or financial loss if enabled | Keep flags off until idempotent server intents/webhooks/reconciliation exist. |
| O-01 | Operations | No CI/CD, IaC, monitoring, backups, or rollback runbook | Unrecoverable/unobservable releases | Required Phase 8 release gate. |
| O-02 | Operations | Build succeeds with environment-dependent runtime paths untested | False confidence from compilation | Require configured staging soak and zero unexpected Base44 traffic before release. |
| C-01 | Compliance | Identity, verification, chat, support, and payment retention/access rules are unknown | Privacy and regulatory exposure | Obtain policy/legal input before storage/data cutover. |

## Data migration gates

Before any production row or object is transformed:

1. Freeze and hash an immutable export.
2. Record per-entity counts, identifiers, null/unique distributions, and
   timestamps.
3. Approve a field-level mapping for all 40 entities and every relationship.
4. Reconcile every email reference to exactly one auth/user UUID or quarantine
   it with an explicit disposition.
5. Inventory every stored object, owner, purpose, MIME type, size, checksum,
   URL use, and visibility.
6. Dry-run into an isolated database and compare counts, critical totals, and
   representative record hashes.
7. Run the complete RLS/auth matrix using migrated identities.
8. Rehearse cutover, forward fix, rollback, and restore with measured timing.
9. Preserve an exception ledger; never discard an unmapped row silently.

## Release gates

- Accepted complete specification and behavior baseline.
- Clean or explicitly baselined build, lint, typecheck, dependency, and test
  checks with no new failures.
- Migrations apply from empty state and from the previous production-like
  state.
- Anon/user/owner/participant/admin/super-admin/suspended RLS matrix passes.
- Critical browser workflows pass with representative data and screenshots.
- Enabled email/SMS/payment/AI provider paths pass sandbox tests.
- Storage privacy, upload abuse, malware, and signed-access tests pass.
- Monitoring, backups, restore, ownership, incident, and rollback procedures
  are exercised.
- A staging soak shows zero unexplained Base44 requests before dependency
  removal.
- Data and object reconciliation has no unexplained loss.

## Current decision

The specification's stop conditions apply to broad auth/service migration,
production data work, destructive cleanup, and release. Safe additive
documentation, test scaffolding, export/inventory work, and reviewed SQL
forward-fix design may continue.
