# F-065 — Initialize auth.uid in post-boundary RLS policies

Status: **PARTIAL until clean-database CI passes**

## Failure

After the historical 22-RPC snapshot was corrected, the clean database applied every migration and then failed `v1_rls_auth_initialization_plans.sql`. Five policies introduced after the original 43-policy boundary still evaluated `auth.uid()` once per candidate row.

## Affected policies

- `business_applications_owner_read`
- `category_approvals_owner_read`
- `managed_listing_requests_owner_read`
- `business_application_responses_owner_read`
- `peek_request_fulfilments_owner_read`

## Repair

Migration `20260807041000_initialize_post_audit_rls_auth_calls.sql` preserves each ownership/admin predicate and changes only direct `auth.uid()` calls to `(select auth.uid())`.

The locked database suite now enumerates all 48 initialized policies and still requires zero remaining per-row calls.

## Deliberately not done

- No policy was broadened or removed.
- No ownership predicate changed.
- No administrator bypass was introduced.
- The performance contract was expanded rather than weakened.
