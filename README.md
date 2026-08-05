# FindIt Marketplace

FindIt is a Zimbabwe-focused marketplace for discovering, advertising,
evaluating and contacting sellers of products and services. V1 is an
independent React/Vite and Supabase application with no Base44 runtime or source
dependency.

## Run locally

Prerequisites: Node.js 24, npm, Docker Desktop and Supabase CLI 2.109+.

```powershell
npm ci --ignore-scripts
supabase start
supabase db reset --local --no-seed
supabase db lint --local
supabase test db
Copy-Item .env.example .env
npm run validate:env
npm run dev
```

Populate `.env` with the local public Supabase URL/key from `supabase status`.
Never place a service-role key in a `VITE_` variable.

## Verify

```powershell
npm run audit:production
npm run lint
npm run typecheck
npm run typecheck:migration
npm run typecheck:active
npm run test            # contract suite + behavioural suite
npm run verify:hygiene
npm run verify:source-graph
npm run test:pgtap-local   # pgTAP without Docker; see the doc for its limits
npm run verify:base44-elimination
npm run build
```

`npm test` runs two suites with different jobs:

- `npm run test:contracts` (`node --test tests/*.test.mjs`) reads source files
  as text and asserts on their structure, wiring and migration boundaries.
- `npm run test:behaviour` (`vitest run tests/behaviour/`) imports the real
  modules and renders the real components, so it catches regressions that leave
  the source text intact. Use `npm run test:behaviour:watch` while developing.

New product behaviour belongs in the behavioural suite. A text assertion cannot
tell a working component from a deleted one.

Hosted disposable acceptance is run through
`scripts/run-hosted-acceptance.ps1`; worker credentials and schedules are set
through `scripts/configure-staging.ps1`. Both scripts require authenticated
local CLIs and never print secret values.

## Architecture

- React 18, Vite and React Router.
- Supabase Auth and PostgreSQL with RLS.
- Private listing, marketplace, Peek source, playback, and thumbnail storage.
- Edge Functions cover trusted media, Peek, recommendations, notifications,
  expiry, cleanup, health, and maintenance boundaries.
- Domain services/repositories isolate UI from provider calls.
- GitHub Actions cover clean database gates, the full Peek production build,
  staging deployment, hosted acceptance, and bounded worker schedules.

## Status and handover

Read these before deployment:

- [Project status](PROJECT_STATUS.md)
- [Production readiness](PRODUCTION_READINESS_REPORT.md)
- [Migration completion](MIGRATION_COMPLETION_REPORT.md)
- [Architecture snapshot (generated)](docs/ARCHITECTURE_SNAPSHOT.md)
- [Recommendation endpoint migration](docs/RECOMMENDATION_ENDPOINT_MIGRATION.md)
- [Clean-database findings, 2026-08-05](docs/CLEAN_DATABASE_FINDINGS_2026-08-05.md)
- [Architecture](ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Supabase setup](docs/SUPABASE_SETUP.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Backup and recovery](docs/BACKUP_AND_RECOVERY.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Google and Apple OAuth setup](docs/OAUTH_SETUP.md)
- [FindIt authentication email templates](docs/EMAIL_TEMPLATES.md)
- [QA](QA_STATUS.md) and [security review](docs/SECURITY_REVIEW.md)
- [Solo founder guide](SOLO_FOUNDER_GUIDE.md)

Completed migration, milestone and audit records are archived under
[`docs/history/`](docs/history/).

The accepted staging release is deployed at
`https://mmugambiwa14-netizen.github.io/findit-marketplace/`. Peek is enabled in
the bottom navigation and backend, its workers are active, and all seven
recommendation policies are enabled on staging. Production remains a separate,
explicit rollout: its Supabase project is intentionally unchanged and still
requires a named migration/function window, production secrets and domain,
SMTP, monitoring, recovery ownership, and final browser/device acceptance.
