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
npm run test:contracts
npm run verify:base44-elimination
npm run build
```

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

The accepted staging release is deployed at
`https://mmugambiwa14-netizen.github.io/findit-marketplace/`. Peek is enabled in
the bottom navigation and backend, its workers are active, and all seven
recommendation policies are enabled on staging. Production remains a separate,
explicit rollout: its Supabase project is intentionally unchanged and still
requires a named migration/function window, production secrets and domain,
SMTP, monitoring, recovery ownership, and final browser/device acceptance.
