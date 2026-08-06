# FindIt Migration Ledger

## Rules

- Migration files become canonical only after merge to `main`.
- Hosted status must be recorded separately for staging and production.
- A feature is not staging-complete merely because its SQL exists in the repository.
- Rollback or corrective-forward strategy must be documented before production application.

## Curated business marketplace

| Migration | Purpose | Repository | Staging | Production | Verification |
|---|---|---|---|---|---|
| `20260806041500_curated_business_marketplace_foundation.sql` | Core curated business entities and application foundation | Merged to `main` | Pending confirmation | Not applied/unknown | `v1_curated_business_marketplace.sql` |
| `20260806053000_curated_business_marketplace_operations.sql` | Review and publishing operations | Merged to `main` | Pending confirmation | Not applied/unknown | Database certification required |
| `20260806064500_curated_business_marketplace_applicant_followup.sql` | Applicant follow-up lifecycle | Merged to `main` | Pending confirmation | Not applied/unknown | Database certification required |
| `20260806070000_enforce_curated_publishing_at_database_boundary.sql` | Prevent unauthorized publishing at database boundary | Merged to `main` | Pending confirmation | Not applied/unknown | Security and contract tests required |
| `20260806073000_lock_curated_business_function_privileges.sql` | Restrict privileged function access | Merged to `main` | Pending confirmation | Not applied/unknown | Privilege audit required |
| `20260806074500_queue_legacy_publishers_for_review.sql` | Queue existing publishers for review | Merged to `main` | Pending confirmation | Not applied/unknown | Data reconciliation required |
| `20260806093000_curated_business_notifications.sql` | Application and publishing notifications | Merged to `main` | Pending confirmation | Not applied/unknown | Notification smoke test required |
| `20260806094500_allow_curated_notification_routes.sql` | Permit curated notification routes | Merged to `main` | Pending confirmation | Not applied/unknown | Route contract test required |
| `20260806100000_extend_alert_event_types_for_curated_marketplace.sql` | Add curated alert event types | Merged to `main` | Pending confirmation | Not applied/unknown | Alert contract test required |
| `20260806110000_preserve_suspended_business_categories.sql` | Preserve category state through suspension | Merged to `main` | Pending confirmation | Not applied/unknown | Suspension lifecycle test required |

## Superseded migration work

| Migration | Status | Reason |
|---|---|---|
| `0124_live_conversation_updates.sql` from `feature/peek-threads-phase-3` | Not canonical | Current frontend intentionally disables Supabase Realtime and uses polling/focus/reconnect refresh |

## Environment recording template

When a migration is applied, record:

- exact environment/project identifier,
- migration SHA,
- application timestamp,
- operator,
- command or workflow run,
- test result,
- rollback or corrective-forward result,
- linked release or pull request.
