# Technical Debt Register

Reviewed: 2026-07-26
Scope: final approved V1 repository and hosted staging backend

Base44 cleanup, full typechecking, V1 service/repository cutover, private V1
media, search correctness and dependency cleanup are complete. The remaining
items below are real launch operations or intentional post-launch hardening.

| ID | Description | Impact | Priority | Recommended action | Effort | Status |
|---|---|---|---|---|---|---|
| TD-001 | GitHub Actions returns `startup_failure` before jobs on push, PR and manual runs | Shared CI and worker schedules are not operational | Critical | Resolve GitHub account/billing/policy restriction, rerun all workflows and retain green evidence | External | Blocked |
| TD-002 | No approved frontend host/domain | No public app or deep-link evidence | Critical | Select host, deploy merged immutable revision, configure SPA fallback and DNS/TLS | Medium | Blocked |
| TD-003 | Deployed browser/device/accessibility matrix is absent | Browser-specific, mobile and assistive-technology regressions may remain | Critical | Test core guest/user/seller/admin journeys on supported devices and screen readers | Medium | Blocked by host/browser |
| TD-004 | Production SMTP and Auth delivery lifecycle are unverified | Users may not confirm or recover accounts reliably | Critical | Configure authenticated mail domain, templates, quotas and confirmation/recovery tests | Medium | Open |
| TD-005 | Optional OAuth has no provider credentials or lifecycle evidence | OAuth cannot be safely enabled | High | Keep disabled until callback, denial, replay, refresh and account-link tests pass | Medium | Deferred |
| TD-006 | Native isolated restore/PITR and numeric RPO/RTO are absent | Recovery time/data loss cannot be promised | Critical | Run provider-native backup/restore drill and record owners, timing and evidence | High | Open |
| TD-007 | Monitoring, alert routing and incident ownership are not connected | Failures may go undetected or unowned | Critical | Configure redacted frontend/backend metrics, alerts, runbooks and responders | Medium | Open |
| TD-008 | No Base44 data/object export was supplied | Existing production continuity cannot be claimed | Critical if legacy data exists | Approve fresh launch or obtain immutable exports and execute dry-run reconciliation | External/High | Decision required |
| TD-009 | Client forms do not share one validation schema system | Feedback and edge-case handling can drift | High | Consolidate high-risk forms incrementally while retaining server/database validation | Medium | Open |
| TD-010 | Anonymous support/Auth abuse controls need production gateway evidence | Attackers can rotate identities beyond database limits | High | Add gateway/IP controls, optional CAPTCHA, observable denials and response thresholds | Medium | Open |
| TD-011 | Media lacks malware scanning, full pixel re-encoding and derivatives | Defense in depth and image performance can improve | Medium | Measure launch traffic/risk, then add processing only where justified | High | Future hardening |
| TD-012 | Production-scale search/query-plan evidence is absent | Staging correctness may not predict large-volume latency | High | Capture query plans and latency at representative volume; tune indexes from evidence | Medium | Open |
| TD-013 | Named technical/incident owners are not stored in repository metadata | Handover tasks may lack accountability | High | Assign primary and backup owners before production sign-off | Small | Open |

No item is silently accepted. “Blocked” means the repository cannot resolve it
without an account, provider, data or owner decision.
