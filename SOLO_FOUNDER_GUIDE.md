# Solo Founder Guide

Status: handover guide for the V1 engineering-complete repository. External
production launch gates remain in `PROJECT_STATUS.md`.

## Project structure

- `src/` — React/Vite application. Pages preserve user workflows; components
  provide reusable UI; `services/` is the Supabase service boundary.
- `supabase/migrations/` — ordered PostgreSQL schema and RLS migrations.
- `supabase/tests/` — focused database/Auth/RLS checks.
- `supabase/functions/` — reviewed Edge Functions: trusted V1 product and
  marketplace-profile uploads plus the internal expired-media cleanup worker.
- Git commit `55a5807` — immutable recovery archive for removed legacy and
  non-MVP source.
- `docs/` — database, auth, feature-flag, environment, setup, deployment,
  backup, security, storage, and observability records.

## Add a feature safely

1. Check `docs/history/FEATURE_INVENTORY.md`, `docs/history/BEHAVIOUR_BASELINE.md`, feature flags, bugs,
   and the Base44 dependency map before changing a route or workflow.
2. Preserve the current page contract. Add a narrow service/repository rather
   than calling Supabase directly from a page or component.
3. Put trusted/privileged/multi-row/provider work in a reviewed server
   boundary; never expose a service-role or provider secret in the browser.
4. Add migration, RLS, and positive/negative tests for every data operation.
5. Update the relevant migration, QA, security, debt, changelog, and handover
   documents in the same change.

## Local development and database updates

Follow `docs/SUPABASE_SETUP.md`. Add new migrations; do not edit an applied
migration on a real environment. Test clean apply, database lint, upgrade,
rollback/forward-fix, and RLS before promotion. Never run destructive data
work without an immutable export, reconciliation plan, and approved owner.

## Feature flags

Feature flags live in `src/lib/featureFlags.js` and are documented in
`docs/FEATURE_FLAGS.md`. Keep payments and AI off by default. A flag is not an
authorisation control: disabled server-side providers must also be protected.

## Operate the V1 support inbox

The public `/help/contact` form writes to a private `support_requests` inbox.
Open **Admin → Reports → Support requests** at least once each operating day,
keep the default Open filter, prioritize Safety requests, and resolve a request
only after recording a useful internal note. Quote the `FIT-...` reference in
any email reply. The user cannot view request status or reply in the app.

This repository does not claim email delivery or an emergency response time.
Before launch, assign the named founder/operator, publish an honest response
expectation, add gateway/CAPTCHA abuse protection, define retention/deletion,
and alert when open requests exceed the accepted age. Never ask for passwords,
payment details or identity documents through this form. The legacy support
ticket/chat/agent pages are not the V1 inbox and must stay unrouted.

## Operate image cleanup

The trusted scheduler must call `media-lifecycle-cleanup` with the Supabase
server secret as its bearer credential; this is never a browser task. Monitor
claimed/cleaned/retry counts, expired backlog, stale claims and oldest orphan
age. A retry is expected after a transient Storage failure; repeated attempts
or claims older than 15 minutes require investigation. Never delete directly
from `storage.objects` to clear a dashboard number, and never clean an attached
path. Before launch, run `npm.cmd run test:media-lifecycle-local`, configure the
hosted schedule/alerts, and record the evidence.

## Dependencies

Use the lockfile and `npm.cmd ci` for reproducible installs. Run `npm.cmd
audit`, lint, typecheck, build, and appropriate database tests after changes.
The Base44 package is removed and guarded absent. Record any dependency
addition/removal in `CHANGELOG.md` and review
licensing, bundle, and security impact.

## Deploy and restore

Do not onboard real users until external release gates are met. Use
`docs/DEPLOYMENT_RUNBOOK.md`. Use `docs/BACKUP_AND_DISASTER_RECOVERY.md` for
incident/restore procedures; restore first to an isolated target and reconcile
before switching traffic.

## Troubleshooting

| Symptom | First check |
|---|---|
| App fails at startup | `npm.cmd run validate:env`; verify public Supabase URL/key names, not values |
| Local database test fails | `supabase status`, then clean reset/lint and inspect the named migration/test |
| User can log in but workflow fails | Run the active graph/build gates and inspect the migrated service. A dormant legacy page must never be manually routed: it can still require Base44 until migrated or archived. |
| Admin route denied | Verify the Supabase profile role and the `is_admin()` predicate; do not bypass the route guard |
| Upload behavior is missing/broken | Product photos use `listing-image-upload`; service photos and business/dealer logos use `marketplace-image-upload`. Do not add direct browser uploads or reuse either bucket for documents. |
| Expired image backlog grows | Check the cleanup schedule, safe count response, stale claims and retry codes. Do not log object paths or expose the server credential. |
| Support request is missing | Search the founder inbox by the exact `FIT-...` reference or contact email; browser roles cannot query the table directly. Check rate-limit denials and database health without copying message content into logs. |
| Deployment question | Stop and follow the runbook; no approved deployment target exists |

## Onboard a future engineer

Start with `PROJECT_STATUS.md`, `ARCHITECTURE.md`, `docs/history/MIGRATION.md`, and
`QA_STATUS.md`. Assign a bounded vertical slice, require an owner for its
contract/data/RLS/rollback evidence, and keep any production-data or provider
decision separate from ordinary source changes.
