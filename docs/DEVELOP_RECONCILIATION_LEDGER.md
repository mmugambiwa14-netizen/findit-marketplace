# PeekaListing Develop Reconciliation Ledger

**Canonical branch:** `main`
**Legacy branch under review:** `develop`
**Status:** Classified; direct merge prohibited

## Decision

`develop` is not a valid source-of-truth branch. It is 40 commits ahead and 27 commits behind `main`, and mixes valuable hardening work with obsolete UI, branding, generated artifacts and recommendation rewrites. It must never be merged wholesale.

## Port to `main`

### Database and security

- `20260805090000_restore_private_schema_usage_for_wrappers.sql`
- `20260805100000_services_contact_column_allowlist_authenticated.sql`
- `20260805110000_reject_disposable_signup_emails.sql`
- `20260806120000_restore_private_schema_usage_for_policy_helpers.sql`
- `20260806130000_align_notification_projections_with_alert_events.sql`
- `20260806140000_close_default_public_execute_and_table_grants.sql`
- associated pgTAP suites and contract tests

These require clean-database certification and staging verification before promotion.

### Authentication and account security

- disposable-email policy
- MFA challenge screen
- MFA settings screen
- MFA service methods
- protected-route MFA handling
- authentication configuration hardening
- account-deletion support where not already superseded

These must be adapted to the current app shell and current Supabase client rather than copied blindly.

### Test and release infrastructure

- behaviour tests for admin authorization
- contact reveal
- listing submission boundaries
- messaging/profile input
- text injection
- pagination/search
- protected routes
- MFA
- local pgTAP harness
- clean migration certification improvements
- hosted smoke runner
- architecture snapshot generator

### Repository hygiene

- generated audit and milestone artifacts should stop being committed
- historical documents should move under `docs/history/`
- current authoritative documents remain at top-level/current paths
- `.gitignore` should exclude generated certification outputs

### PWA and branding fixes

Port only after comparison with current `main`:

- real PNG install icons
- maskable icon
- safe private-mode session-storage access
- correct PeekaListing manifest identity
- base-path-safe brand asset resolution

## Do not port directly

### Peek catalogue removals

Do not import deletion of:

- `ImmersivePeekCard.jsx`
- `TourCard.jsx`
- `TourCatalogueHeader.jsx`
- `TourCategoryChips.jsx`

Current `main` contains the active Peek product. Any redesign must be handled as a separate product PR with visual and functional acceptance.

### Recommendation rewrite

Do not import the consolidated recommendation Edge Function or remove existing recommendation endpoints until:

- current endpoint usage is mapped,
- compatibility adapters exist,
- staging traffic is replayed,
- rollback is proven.

### Package replacement

Do not replace current `package.json` or lockfile wholesale. Dependency and script changes must be introduced incrementally.

### Supabase configuration replacement

Do not replace `supabase/config.toml` wholesale. Port only individually reviewed settings.

### Old deployment and branding assumptions

Do not import old Vercel, preview, release-branch or legacy naming assumptions that conflict with current GitHub Pages/Cloudflare staging work.

## Required reconciliation sequence

1. Database/security migration package
2. Security tests and clean-database certification
3. MFA and auth package
4. Behaviour-test package
5. PWA/branding corrections
6. Repository artifact cleanup
7. Recommendation endpoint review as a separate milestone
8. Archive `develop` after all accepted work is merged or explicitly rejected

## Completion gate

`develop` may be retired only when every unique file is marked as one of:

- ported,
- superseded,
- intentionally rejected,
- historical-only.

No feature is considered part of PeekaListing until it is merged into `main`, enabled in the intended environment, backed by migrations where required and verified in staging.
