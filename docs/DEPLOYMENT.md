# Deployment

## Current deployment status — 2026-07-26

Supabase staging is deployed and accepted. GitHub repository variables and
three secrets are configured, scheduler credentials are rotated, and workflows
exist for migration gates, staging Pages deployment, hourly media cleanup and
daily listing expiry.

GitHub Actions is enabled and allows all actions, but push, pull-request and
manual-dispatch runs currently end as `startup_failure` before GitHub creates a
job. The workflow files pass `actionlint`; the complete gate passes from a clean
checkout. Resolve the account/billing/policy restriction before treating CI or
worker schedules as operational.

GitHub rejected Pages enablement because the repository is private and the
current plan does not support private-repository Pages. Select public Pages,
upgrade GitHub, or connect another static host. The Vite build and Router are
subpath-safe through `VITE_BASE_PATH`; Auth redirects include the intended Pages
subpath. Do not claim a live frontend until the chosen host deploys the exact
commit and deep-link/browser acceptance passes.

Status: backend deployable; frontend host externally blocked. The canonical operational procedure is
[`DEPLOYMENT_RUNBOOK.md`](DEPLOYMENT_RUNBOOK.md).

FindIt now has a private GitHub repository and an empty hosted Supabase staging
project with all migrations and four Edge Functions deployed. It still has no
approved frontend host, production domain/project, verified deployment
pipeline, or release owner. Do not treat a passing Vite build or staging
database deployment as authorisation to launch.

Before deployment, every pre-deployment, data/rollback, security, storage and
workflow gate in the runbook must pass. Current clean-checkout and hosted
staging evidence proves full typecheck, Base44 elimination, Auth/RLS,
marketplace domains, private V1 media and worker behavior. Remaining blockers
are GitHub Actions/hosting, deployed-browser acceptance, production SMTP,
monitoring, provider-native recovery, a separate production project/domain and
the fresh-launch versus legacy-data decision.
